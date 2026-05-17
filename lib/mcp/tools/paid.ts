import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { sanitizeError } from "@/lib/mcp/errors"
import {
  verifyX402Payment,
  settleX402Payment,
  createPaymentRequirement,
  checkRateLimit,
  getSolanaNetworkCaip2,
} from "@/lib/mcp/x402-verify"
import { getToolPrice, isFreeOperation } from "@/lib/mcp/pricing"
import {
  hasAgent,
  getAgentConfig,
  setAgentConfig,
  createDefaultConfig,
  getAgentPublicKey,
  addActiveAgent,
  removeActiveAgent,
  getAgentApiKey,
  setAgentApiKey,
  generateApiKey,
} from "@/lib/agent/redis"
import { createAgentWallet, signAndSendTransaction } from "@/lib/agent/privy"
import { executeAgentCycle } from "@/lib/agent/executor"
import {
  findOrCreateProfile,
  updateProfile,
  searchProfiles,
} from "@/lib/tapestry-server"
import { SOLANA_CONFIG } from "@/config/solana"
import { TOKEN_MINTS, TOKEN_DECIMALS, resolveTokenProgram } from "@/lib/token-mints"
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token"
import { recordReceipt } from "@/lib/mcp/receipts"
import { jsonResult, validateWalletAddress } from "./shared"

/**
 * Extract payment proof from either _meta["x402/payment"] transport
 * (x402 v2 standard) or the legacy paymentProof tool argument.
 */
function extractPaymentProof(
  paymentProofArg: string | undefined,
  extra?: { _meta?: Record<string, any> },
): string | undefined {
  // Prefer x402 standard _meta transport
  const metaPayment = extra?._meta?.["x402/payment"]
  if (typeof metaPayment === "string" && metaPayment.length > 0) {
    return metaPayment
  }
  // Fallback to legacy paymentProof arg
  return paymentProofArg
}

/**
 * Check if we are running on devnet with free tools enabled.
 * When true, paid tools can be called with just a `wallet` param
 * (no x402 payment required) — useful for external agent testing.
 */
function isDevnetFreeMode(): boolean {
  // SECURITY: Free mode requires BOTH the explicit flag AND a devnet cluster.
  // The RPC URL check ensures this is impossible on mainnet even if
  // DEVNET_FREE_TOOLS is accidentally left as "true".
  const isDevnetCluster =
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
    !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")
  const isMainnet =
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ||
    (process.env.NEXT_PUBLIC_SOLANA_RPC_URL && !process.env.NEXT_PUBLIC_SOLANA_RPC_URL.includes("devnet"))
  // Explicit mainnet guard — never allow free mode on mainnet
  if (isMainnet) return false
  return process.env.DEVNET_FREE_TOOLS === "true" && isDevnetCluster
}

/**
 * Common pattern for paid tools (x402 v2 — deferred settlement):
 *
 * 1. If no paymentProof → return payment requirement
 * 2. Verify payment (local only, NO broadcast)
 * 3. Execute action
 * 4. Settle payment (broadcast + confirm) — only if action succeeded
 *
 * This ensures users are NOT charged if the tool execution fails.
 *
 * In devnet free mode (DEVNET_FREE_TOOLS=true), requires API key per wallet
 * (returned by create-agent) to prevent wallet impersonation.
 * On mainnet, wallet is extracted from the verified x402 paymentProof
 * signature, making impersonation impossible.
 */
export async function handlePaidAction(
  toolName: string,
  paymentProof: string | undefined,
  description: string,
  action: (wallet: string, txSignature: string) => Promise<any>,
  extra?: { _meta?: Record<string, any> },
  walletOverride?: string,
  feeOverride?: number,
  apiKey?: string,
) {
  // Validate wallet address format if provided
  if (walletOverride) {
    try {
      validateWalletAddress(walletOverride)
    } catch (err: any) {
      return jsonResult({ success: false, error: err.message, errorCode: "INVALID_WALLET" })
    }
  }

  // Resolve payment proof from _meta or arg
  const resolvedProof = extractPaymentProof(paymentProof, extra)

  // Fee: use caller-provided override (proportional fees) or static price
  const price = feeOverride ?? await getToolPrice(toolName)

  // Devnet free mode: skip payment, verify API key for wallet ownership.
  // create-agent and regenerate-api-key are exempt (they generate/return the key).
  const API_KEY_EXEMPT_TOOLS = ["create-agent", "regenerate-api-key"]
  if (isDevnetFreeMode() && !resolvedProof && walletOverride) {
    if (!API_KEY_EXEMPT_TOOLS.includes(toolName)) {
      if (!apiKey) {
        return jsonResult({
          success: false,
          error: "API key required for devnet free mode. Pass the apiKey returned by create-agent.",
          errorCode: "API_KEY_REQUIRED",
        })
      }
      const storedKey = await getAgentApiKey(walletOverride)
      if (!storedKey || storedKey !== apiKey) {
        return jsonResult({
          success: false,
          error: "Invalid API key for this wallet.",
          errorCode: "UNAUTHORIZED",
        })
      }
    }

    const allowed = await checkRateLimit(walletOverride, true)
    if (!allowed) {
      return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED" })
    }

    try {
      const result = await action(walletOverride, "")
      return jsonResult({
        success: true,
        wallet: walletOverride,
        devnetFreeMode: true,
        ...result,
      })
    } catch (err: any) {
      const { code, message, suggestion, extra } = sanitizeError(err)
      return jsonResult({
        success: false,
        error: message,
        errorCode: code,
        ...(suggestion ? { suggestion } : {}),
        ...extra,
        devnetFreeMode: true,
      })
    }
  }

  // Free tool (price=0): execute without payment settlement.
  // Handles both cases: wallet param only, or backward-compat paymentProof.
  if (price === 0) {
    // Resolve wallet: prefer verified proof, fall back to walletOverride
    let wallet = walletOverride
    if (resolvedProof) {
      try {
        const verification = await verifyX402Payment(resolvedProof, 0)
        if (verification.valid) {
          // SECURITY: If both wallet param and proof exist, they must match
          if (walletOverride && walletOverride !== verification.payerWallet) {
            return jsonResult({
              success: false,
              error: `Wallet mismatch: payment signed by ${verification.payerWallet}, but wallet parameter is ${walletOverride}. You can only operate your own wallet.`,
              errorCode: "WALLET_MISMATCH",
            })
          }
          wallet = verification.payerWallet
        }
      } catch { /* ignore — free tool, proof is optional */ }
    }
    if (!wallet) {
      return jsonResult({
        success: false,
        error: "This tool is free but requires a 'wallet' parameter to identify you.",
        errorCode: "WALLET_REQUIRED",
      })
    }
    const allowed = await checkRateLimit(wallet, false)
    if (!allowed) {
      return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED" })
    }
    try {
      const result = await action(wallet, "")
      return jsonResult({ success: true, wallet, ...result })
    } catch (err: any) {
      const { code, message, suggestion, extra } = sanitizeError(err)
      return jsonResult({ success: false, error: message, errorCode: code, ...(suggestion ? { suggestion } : {}), ...extra })
    }
  }

  // No payment proof → return payment requirements
  if (!resolvedProof) {
    const payment = await createPaymentRequirement(price, description)
    return jsonResult({
      success: false,
      paymentRequired: true,
      price,
      payment,
      hint: "Payment accepted in USDC, EURC, or SOL. Check accepts[] (x402 v2) or acceptedPayments[] (legacy) for all options. If you need to convert tokens, use the swap-tokens tool (Jupiter Aggregator).",
      instructions:
        "To complete this action, construct a token transfer transaction " +
        "to one of the recipient accounts listed above, " +
        "sign it with your wallet, serialize it to base64, and retry this tool " +
        "with the 'paymentProof' argument or _meta['x402/payment'] set to the base64 string.",
    })
  }

  // Step 1: Verify payment (local validation only — NO broadcast)
  const verification = await verifyX402Payment(resolvedProof, price)
  if (!verification.valid) {
    return jsonResult({ success: false, error: verification.error, errorCode: "PAYMENT_INVALID" })
  }

  // SECURITY: Reject if wallet param doesn't match payment signer (defense in depth)
  if (walletOverride && walletOverride !== verification.payerWallet) {
    return jsonResult({
      success: false,
      error: `Wallet mismatch: payment signed by ${verification.payerWallet}, but wallet parameter is ${walletOverride}. You can only operate your own wallet.`,
      errorCode: "WALLET_MISMATCH",
    })
  }

  // Rate limit check
  const allowed = await checkRateLimit(verification.payerWallet, true)
  if (!allowed) {
    return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED" })
  }

  // Step 2: Execute the action (payment NOT yet broadcast)
  const receiptId = `${toolName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    const result = await action(verification.payerWallet, "")

    // Step 3: Settle payment (broadcast + confirm) — only on success
    const settlement = await settleX402Payment(resolvedProof)
    if (!settlement.success) {
      // Tool succeeded but settlement failed — user is NOT charged
      return jsonResult({
        success: false,
        error: `Tool executed but payment settlement failed: ${settlement.error}. You were NOT charged.`,
        errorCode: "SETTLEMENT_FAILED",
      })
    }

    await recordReceipt({
      id: receiptId,
      wallet: verification.payerWallet,
      toolName,
      amount: verification.amountUsdc,
      token: verification.paymentToken,
      txSignature: settlement.txSignature,
      timestamp: new Date().toISOString(),
      success: true,
      verificationHash: verification.verificationHash,
      settled: true,
    })

    return jsonResult({
      success: true,
      wallet: verification.payerWallet,
      paymentTx: settlement.txSignature,
      receiptId,
      ...result,
      _meta: {
        "x402/payment-response": {
          txSignature: settlement.txSignature,
          network: settlement.network,
          settled: true,
        },
      },
    })
  } catch (err: any) {
    // Tool execution failed — payment is NOT settled, user is NOT charged
    const rawMessage = err.message || "An error occurred"
    const { code, message, suggestion, extra } = sanitizeError(err)

    await recordReceipt({
      id: receiptId,
      wallet: verification.payerWallet,
      toolName,
      amount: verification.amountUsdc,
      token: verification.paymentToken,
      txSignature: "",
      timestamp: new Date().toISOString(),
      success: false,
      error: rawMessage,
      verificationHash: verification.verificationHash,
      settled: false,
    })

    return jsonResult({
      success: false,
      error: message,
      errorCode: code,
      ...(suggestion ? { suggestion } : {}),
      ...extra,
      paymentSettled: false,
      hint: "The tool failed before payment was settled. You were NOT charged.",
    })
  }
}

export function registerPaidTools(server: McpServer) {
  // --- create-profile ---
  server.tool(
    "create-profile",
    "Create a Tapestry social profile linked to your Solana wallet. This is automatically called when you create an agent, but you can call it explicitly to set a custom username. Free — no payment required.",
    {
      paymentProof: z
        .string()
        .optional()
        .describe("Base64-encoded signed USDC transfer transaction. Omit to get payment requirements."),
      wallet: z
        .string()
        .optional()
        .describe("Your Solana wallet address (required on devnet free mode, optional with x402 payment)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      username: z
        .string()
        .optional()
        .describe("Desired username (defaults to first 8 chars of wallet)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "create-profile",
        args.paymentProof,
        "Create an Agio social profile",
        async (wallet) => {
          const profile = await findOrCreateProfile(wallet, args.username)
          return { profile }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- update-profile ---
  server.tool(
    "update-profile",
    "Update your Tapestry social profile properties (displayName, bio, profileImage). Updates the profile for the owner wallet — agent wallets do not have separate profiles. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      displayName: z.string().optional().describe("Display name"),
      bio: z.string().optional().describe("Bio text"),
      profileImage: z.string().optional().describe("Profile image URL (HTTPS, IPFS, or Arweave). Base64 data URIs accepted but URLs preferred to reduce payload size)."),
    },
    async (args, extra) => {
      return handlePaidAction(
        "update-profile",
        args.paymentProof,
        "Update Agio profile",
        async (wallet) => {
          // Find the profile first
          const result = await searchProfiles(wallet, 1, 0)
          const existing = result.profiles[0]
          if (!existing) {
            throw new Error("Profile not found. Create one first with create-profile.")
          }

          // Validate profileImage if provided
          if (args.profileImage) {
            const isUrl = /^https?:\/\//.test(args.profileImage) || args.profileImage.startsWith("ipfs://") || args.profileImage.startsWith("ar://")
            const isBase64 = args.profileImage.startsWith("data:")
            if (!isUrl && !isBase64) {
              throw new Error("profileImage must be a URL (https://, ipfs://, ar://) or a data URI (data:image/...).")
            }
            // Warn on large base64 payloads
            if (isBase64 && args.profileImage.length > 50_000) {
              throw new Error("profileImage base64 data URI exceeds 50KB limit. Please use a hosted URL instead (HTTPS, IPFS, or Arweave).")
            }
          }

          const properties: { key: string; value: string }[] = []
          if (args.displayName) properties.push({ key: "displayName", value: args.displayName })
          if (args.bio) properties.push({ key: "bio", value: args.bio })
          if (args.profileImage) properties.push({ key: "profileImage", value: args.profileImage })

          if (properties.length === 0) {
            throw new Error("No properties to update. Provide at least one of: displayName, bio, profileImage.")
          }

          const updated = await updateProfile(existing.profile.id, properties)
          // Ensure walletAddress is preserved from the original profile
          if (updated.profile && !updated.profile.walletAddress) {
            updated.profile.walletAddress = existing.profile.walletAddress || wallet
          }
          return { profile: updated }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- create-agent ---
  server.tool(
    "create-agent",
    "Create a new DeFi lending/borrowing agent with its own Solana wallet managed by Privy. Also auto-creates a Tapestry social profile for your owner wallet if one doesn't exist. Flat fee: $0.10 USDC.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "create-agent",
        args.paymentProof,
        "Create an Agio DeFi lending agent",
        async (wallet) => {
          if (await hasAgent(wallet)) {
            throw new Error("Agent already exists for this wallet")
          }

          const { publicKey } = await createAgentWallet(wallet)
          const config = await createDefaultConfig(wallet)

          // Generate API key for devnet free mode authentication
          const newApiKey = generateApiKey()
          await setAgentApiKey(wallet, newApiKey)

          // Auto-create Tapestry profile for the owner wallet (non-blocking)
          let profileCreated = false
          try {
            await findOrCreateProfile(wallet, wallet.slice(0, 8).toLowerCase())
            profileCreated = true
          } catch { /* non-blocking — agent still works without profile */ }

          return {
            agentPublicKey: publicKey,
            apiKey: newApiKey,
            config,
            profileCreated,
            message: "Agent created. IMPORTANT: Save your apiKey — it authenticates all subsequent MCP operations in devnet free mode. Fund the agent wallet, use configure-agent, then activate-agent to start.",
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- regenerate-api-key ---
  server.tool(
    "regenerate-api-key",
    "Regenerate the API key for your agent. Use this if you lost your key or want to rotate it. The old key is immediately invalidated. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed transaction (proves wallet ownership)"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "regenerate-api-key",
        args.paymentProof,
        "Regenerate agent API key",
        async (wallet) => {
          if (!(await hasAgent(wallet))) {
            throw new Error("No agent found for this wallet. Use create-agent first.")
          }
          const newApiKey = generateApiKey()
          await setAgentApiKey(wallet, newApiKey)
          return {
            apiKey: newApiKey,
            message: "API key regenerated. The old key is now invalid. Save this new key for subsequent operations.",
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- configure-agent ---
  server.tool(
    "configure-agent",
    "Update the lending/borrowing configuration for your Agio agent. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      lendEnabled: z.boolean().optional(),
      lendTokens: z.array(z.enum(["USDC", "EURC", "SOL"])).optional(),
      lendMinApy: z.number().min(0).max(200).optional(),
      lendMinAmountUsd: z.number().min(0).optional().describe("Min loan amount in USD"),
      lendMaxAmountUsd: z.number().positive().optional().describe("Max loan amount in USD"),
      lendMaxDuration: z.number().min(1).max(365).optional().describe("Max loan duration in days"),
      lendAcceptedCollateral: z.array(z.enum(["USDC", "EURC", "SOL"])).optional(),
      lendMinCollateralRatio: z.number().min(125).max(500).optional().describe("Min collateral %, e.g. 150 (protocol creation minimum 125%)"),
      lendMaxCollateralRatio: z.number().min(125).max(500).optional().describe("Max collateral %, e.g. 300 (protocol creation minimum 125%)"),
      lendMinHealthFactor: z.number().min(1.1).max(5).optional().describe("Won't accept loans whose initial health factor is below this, e.g. 1.30 (>= 1.10 foreclosure threshold)"),
      lendMaxAcceptableLiquidationProb: z.number().min(0).max(100).optional().describe("Won't accept loans whose modelled liquidation probability % exceeds this, e.g. 25"),
      lendAutoForeclose: z.boolean().optional(),
      lendAutoCreateOffers: z.boolean().optional().describe("Auto-create lend offers each cycle (devnet: 5min duration)"),
      borrowEnabled: z.boolean().optional(),
      borrowTokens: z.array(z.enum(["USDC", "EURC", "SOL"])).optional(),
      borrowMaxApy: z.number().min(0).max(200).optional(),
      borrowMinAmountUsd: z.number().min(0).optional().describe("Min borrow amount in USD"),
      borrowMaxAmountUsd: z.number().positive().optional().describe("Max borrow amount in USD"),
      borrowCollateralTokens: z.array(z.enum(["USDC", "EURC", "SOL"])).optional(),
      borrowMinCollateralRatio: z.number().min(125).max(500).optional().describe("Min collateral %, e.g. 150 (protocol creation minimum 125%)"),
      borrowMaxCollateralRatio: z.number().min(125).max(500).optional().describe("Max collateral %, e.g. 300 (protocol creation minimum 125%)"),
      borrowMaxDuration: z.number().min(1).max(365).optional(),
      borrowAutoRepay: z.boolean().optional(),
      borrowAddCollateralThreshold: z.number().gt(1.15).max(5).optional().describe("Health factor that triggers auto-add-collateral, must be > 1.15 (above warning zone), e.g. 1.20"),
      borrowAutoRepayOnWarning: z.boolean().optional().describe("Auto-repay when a loan enters the warning zone (health factor < 1.15)"),
      borrowTargetZone: z.enum(["green", "yellow", "orange"]).optional().describe("Health zone the agent targets when creating borrow requests"),
      borrowAutoPartialRepayThreshold: z.number().min(0).max(100).optional().describe("If modelled liquidation probability % exceeds this, auto partial-repay to de-risk, e.g. 40"),
      borrowPartialRepayPercent: z.number().min(1).max(100).optional().describe("How much of remaining principal to pay down on an auto partial repay, e.g. 25 (%)"),
      borrowAutoCreateRequests: z.boolean().optional().describe("Auto-create borrow requests each cycle (devnet: 5min duration)"),
      socialAutoAcceptFriends: z.boolean().optional().describe("Auto-accept friend requests (default true)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "configure-agent",
        args.paymentProof,
        "Configure Agio agent parameters",
        async (wallet) => {
          const config = await getAgentConfig(wallet)
          if (!config) throw new Error("Agent not found. Create one first with create-agent.")

          // Merge only provided fields
          const { paymentProof: _, wallet: _w, apiKey: _ak, ...updates } = args
          const newConfig = { ...config }
          for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined && key in config) {
              ;(newConfig as any)[key] = value
            }
          }

          await setAgentConfig(wallet, newConfig)
          return { config: newConfig }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- activate-agent ---
  server.tool(
    "activate-agent",
    "Activate your Agio agent to start automatic lending/borrowing cycles. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "activate-agent",
        args.paymentProof,
        "Activate Agio agent",
        async (wallet) => {
          const config = await getAgentConfig(wallet)
          if (!config) throw new Error("Agent not found")
          if (!config.lendEnabled && !config.borrowEnabled) {
            throw new Error("Enable at least one mode (lendEnabled or borrowEnabled) before activating")
          }

          config.enabled = true
          await setAgentConfig(wallet, config)
          await addActiveAgent(wallet)

          return { message: "Agent activated. It will run on the next cron cycle." }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- deactivate-agent ---
  server.tool(
    "deactivate-agent",
    "Deactivate your Agio agent to stop automatic lending/borrowing cycles. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "deactivate-agent",
        args.paymentProof,
        "Deactivate Agio agent",
        async (wallet) => {
          const config = await getAgentConfig(wallet)
          if (!config) throw new Error("Agent not found")

          config.enabled = false
          await setAgentConfig(wallet, config)
          await removeActiveAgent(wallet)

          return { message: "Agent deactivated." }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- run-agent-cycle ---
  server.tool(
    "run-agent-cycle",
    "Manually trigger one lending/borrowing cycle for your Agio agent. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "run-agent-cycle",
        args.paymentProof,
        "Run one agent cycle",
        async (wallet) => {
          const config = await getAgentConfig(wallet)
          if (!config) throw new Error("Agent not found")

          await executeAgentCycle(wallet)
          return { message: "Agent cycle completed. Check get-agent-history for results." }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- withdraw-funds ---
  server.tool(
    "withdraw-funds",
    "Withdraw tokens from your agent wallet back to your owner wallet. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      token: z.enum(["USDC", "EURC", "SOL"]).describe("Token to withdraw"),
      amount: z.number().positive().describe("Amount to withdraw (in UI units, e.g. 10.5 USDC)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "withdraw-funds",
        args.paymentProof,
        "Withdraw funds from agent wallet",
        async (wallet) => {
          const agentPubkey = await getAgentPublicKey(wallet)
          if (!agentPubkey) throw new Error("Agent not found")

          const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")
          const agentPk = new PublicKey(agentPubkey)
          const destPk = new PublicKey(wallet) // Always withdraw to owner

          const tx = new Transaction()
          const { blockhash } = await connection.getLatestBlockhash("confirmed")
          tx.recentBlockhash = blockhash
          tx.feePayer = agentPk

          if (args.token === "SOL") {
            const lamports = Math.round(args.amount * 1e9)
            tx.add(
              SystemProgram.transfer({
                fromPubkey: agentPk,
                toPubkey: destPk,
                lamports,
              }),
            )
          } else {
            const mint = TOKEN_MINTS[args.token as keyof typeof TOKEN_MINTS]
            if (!mint) throw new Error(`Unknown token: ${args.token}`)

            const decimals = TOKEN_DECIMALS[args.token] || 6
            const rawAmount = Math.round(args.amount * 10 ** decimals)

            // Resolve token program from on-chain mint (handles Token-2022 like EURC)
            const tokProg = await resolveTokenProgram(connection, mint)
            const sourceAta = getAssociatedTokenAddressSync(mint, agentPk, false, tokProg)
            const destAta = getAssociatedTokenAddressSync(mint, destPk, false, tokProg)

            tx.add(createAssociatedTokenAccountIdempotentInstruction(agentPk, destAta, destPk, mint, tokProg))
            tx.add(createTransferInstruction(sourceAta, destAta, agentPk, rawAmount, [], tokProg))
          }

          const serialized = tx
            .serialize({ requireAllSignatures: false, verifySignatures: false })
            .toString("base64")

          const txHash = await signAndSendTransaction(wallet, serialized)
          return { txHash, message: `Withdrew ${args.amount} ${args.token} to ${wallet}` }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )
}
