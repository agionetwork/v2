import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  verifyX402Payment,
  settleX402Payment,
  createPaymentRequirement,
  checkRateLimit,
} from "@/lib/mcp/x402-verify"
import { getToolPrice } from "@/lib/mcp/pricing"
import { calculateFee, calculateBatchFee, BATCH_DISCOUNT } from "@/lib/fees/fee-calculator"
import { recordReceipt } from "@/lib/mcp/receipts"
import {
  hasAgent,
  getAgentConfig,
  setAgentConfig,
  createDefaultConfig,
  getAgentPublicKey,
  addActiveAgent,
  removeActiveAgent,
  getAgentApiKey,
} from "@/lib/agent/redis"
import { createAgentWallet } from "@/lib/agent/privy"
import {
  findOrCreateProfile,
  updateProfile,
  searchProfiles,
  followUser,
  unfollowUser,
} from "@/lib/tapestry-server"
import { jsonResult } from "./shared"

/**
 * Supported batch operations and their handlers.
 * Each handler receives the wallet and operation args, returns a result object.
 */
const BATCH_HANDLERS: Record<
  string,
  (wallet: string, args: Record<string, any>) => Promise<any>
> = {
  "create-profile": async (wallet, args) => {
    const profile = await findOrCreateProfile(wallet, args.username)
    return { tool: "create-profile", result: { profile } }
  },

  "create-agent": async (wallet) => {
    if (await hasAgent(wallet)) {
      throw new Error("Agent already exists for this wallet")
    }
    const { publicKey } = await createAgentWallet(wallet)
    const config = await createDefaultConfig(wallet)
    return { tool: "create-agent", result: { agentPublicKey: publicKey, config } }
  },

  "configure-agent": async (wallet, args) => {
    const config = await getAgentConfig(wallet)
    if (!config) throw new Error("Agent not found. Create one first.")
    const newConfig = { ...config }
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && key in config) {
        ;(newConfig as any)[key] = value
      }
    }
    await setAgentConfig(wallet, newConfig)
    return { tool: "configure-agent", result: { config: newConfig } }
  },

  "activate-agent": async (wallet) => {
    const config = await getAgentConfig(wallet)
    if (!config) throw new Error("Agent not found")
    if (!config.lendEnabled && !config.borrowEnabled) {
      throw new Error("Enable at least one mode before activating")
    }
    config.enabled = true
    await setAgentConfig(wallet, config)
    await addActiveAgent(wallet)
    return { tool: "activate-agent", result: { message: "Agent activated" } }
  },

  "deactivate-agent": async (wallet) => {
    const config = await getAgentConfig(wallet)
    if (!config) throw new Error("Agent not found")
    config.enabled = false
    await setAgentConfig(wallet, config)
    await removeActiveAgent(wallet)
    return { tool: "deactivate-agent", result: { message: "Agent deactivated" } }
  },

  "update-profile": async (wallet, args) => {
    const result = await searchProfiles(wallet, 1, 0)
    const existing = result.profiles[0]
    if (!existing) throw new Error("Profile not found. Create one first.")
    const properties: { key: string; value: string }[] = []
    if (args.displayName) properties.push({ key: "displayName", value: args.displayName })
    if (args.bio) properties.push({ key: "bio", value: args.bio })
    if (args.profileImage) properties.push({ key: "profileImage", value: args.profileImage })
    if (properties.length === 0) throw new Error("No properties to update.")
    const updated = await updateProfile(existing.profile.id, properties)
    // Preserve walletAddress from the original profile (same fix as direct update-profile)
    if (updated.profile && !updated.profile.walletAddress) {
      updated.profile.walletAddress = existing.profile.walletAddress || wallet
    }
    return { tool: "update-profile", result: { profile: updated } }
  },

  "follow-user": async (wallet, args) => {
    if (!args.targetWallet) throw new Error("targetWallet is required")
    const [myResult, targetResult] = await Promise.all([
      searchProfiles(wallet, 1, 0),
      searchProfiles(args.targetWallet, 1, 0),
    ])
    const myProfile = myResult.profiles[0]
    const targetProfile = targetResult.profiles[0]
    if (!myProfile) throw new Error("Your profile not found. Create one first.")
    if (!targetProfile) throw new Error("Target profile not found.")
    await followUser(myProfile.profile.id, targetProfile.profile.id)
    return { tool: "follow-user", result: { message: `Followed ${args.targetWallet}` } }
  },

  "unfollow-user": async (wallet, args) => {
    if (!args.targetWallet) throw new Error("targetWallet is required")
    const [myResult, targetResult] = await Promise.all([
      searchProfiles(wallet, 1, 0),
      searchProfiles(args.targetWallet, 1, 0),
    ])
    const myProfile = myResult.profiles[0]
    const targetProfile = targetResult.profiles[0]
    if (!myProfile) throw new Error("Your profile not found.")
    if (!targetProfile) throw new Error("Target profile not found.")
    await unfollowUser(myProfile.profile.id, targetProfile.profile.id)
    return { tool: "unfollow-user", result: { message: `Unfollowed ${args.targetWallet}` } }
  },
}

const BATCHABLE_TOOLS = Object.keys(BATCH_HANDLERS)

export function registerBatchTools(server: McpServer) {
  server.tool(
    "batch-execute",
    `Execute multiple tools in a single request (10% discount on total fee). ` +
    `Most batch tools are free. Supported: ${BATCHABLE_TOOLS.join(", ")}. ` +
    `Operations execute sequentially. Max 5 per batch.`,
    {
      paymentProof: z
        .string()
        .optional()
        .describe("Base64-encoded signed transfer transaction. Omit to get price quote."),
      wallet: z
        .string()
        .optional()
        .describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      operations: z
        .array(
          z.object({
            tool: z.string().describe("Tool name to execute"),
            args: z.record(z.string(), z.any()).optional().describe("Tool arguments (excluding paymentProof)"),
          }),
        )
        .min(1)
        .max(5)
        .describe("Array of operations to execute"),
    },
    async (args, extra) => {
      // Validate all operations are supported
      for (const op of args.operations) {
        if (!BATCH_HANDLERS[op.tool]) {
          return jsonResult({
            success: false,
            error: `Tool "${op.tool}" is not supported in batch mode. Supported: ${BATCHABLE_TOOLS.join(", ")}`,
          })
        }
      }

      // Calculate fee for each op using v2 fee calculator
      // Batch tools are flat or free, so volumeUsd=0 is correct
      const ops = args.operations.map((op) => ({ tool: op.tool, volumeUsd: 0 }))
      const breakdown: { tool: string; price: number }[] = ops.map((op) => ({
        tool: op.tool,
        price: calculateFee(op.tool, 0),
      }))
      const totalBeforeDiscount = breakdown.reduce((sum, b) => sum + b.price, 0)
      const finalPrice = totalBeforeDiscount > 0
        ? calculateBatchFee(ops)
        : 0

      // Resolve payment proof from _meta or arg
      const metaPayment = (extra as any)?._meta?.["x402/payment"]
      const resolvedProof =
        typeof metaPayment === "string" && metaPayment.length > 0
          ? metaPayment
          : args.paymentProof

      // Devnet free mode: skip payment, use wallet param directly
      const isDevnetFree =
        process.env.DEVNET_FREE_TOOLS === "true" &&
        (process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet") ||
          process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet")

      if (isDevnetFree && !resolvedProof && args.wallet) {
        // SECURITY: Verify API key to prevent wallet impersonation
        if (!args.apiKey) {
          return jsonResult({
            success: false,
            error: "API key required for devnet free mode. Pass the apiKey returned by create-agent.",
            errorCode: "API_KEY_REQUIRED",
          })
        }
        const storedKey = await getAgentApiKey(args.wallet)
        if (!storedKey || storedKey !== args.apiKey) {
          return jsonResult({
            success: false,
            error: "Invalid API key for this wallet.",
            errorCode: "UNAUTHORIZED",
          })
        }

        const allowed = await checkRateLimit(args.wallet, true)
        if (!allowed) {
          const retryAfter = new Date(Date.now() + 60_000).toISOString()
          return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED", retryAfter })
        }

        const results: any[] = []
        for (const op of args.operations) {
          try {
            const handler = BATCH_HANDLERS[op.tool]
            const result = await handler(args.wallet, op.args || {})
            results.push({ ...result, success: true })
          } catch (err: any) {
            results.push({ tool: op.tool, success: false, error: err.message })
          }
        }

        return jsonResult({
          success: true,
          wallet: args.wallet,
          devnetFreeMode: true,
          results,
        })
      }

      // All ops are free — execute without payment
      if (finalPrice === 0 && args.wallet) {
        const allowed = await checkRateLimit(args.wallet, false)
        if (!allowed) {
          return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED" })
        }
        const results: any[] = []
        for (const op of args.operations) {
          try {
            const handler = BATCH_HANDLERS[op.tool]
            const result = await handler(args.wallet, op.args || {})
            results.push({ ...result, success: true })
          } catch (err: any) {
            results.push({ tool: op.tool, success: false, error: err.message })
          }
        }
        return jsonResult({ success: true, wallet: args.wallet, totalPaid: 0, results })
      }

      // No payment proof → return quote
      if (!resolvedProof) {
        const payment = await createPaymentRequirement(
          finalPrice,
          `Batch execute: ${args.operations.map((o) => o.tool).join(", ")} (${BATCH_DISCOUNT * 100}% discount)`,
        )
        return jsonResult({
          success: false,
          paymentRequired: true,
          totalBeforeDiscount,
          discount: `${BATCH_DISCOUNT * 100}%`,
          finalPrice,
          breakdown,
          payment,
          hint: "Payment accepted in USDC, EURC, or SOL. Check accepts[] (x402 v2) or acceptedPayments[] (legacy) for all options.",
          instructions:
            "Construct a transfer transaction for the finalPrice amount, " +
            "sign it, serialize to base64, and retry with paymentProof or _meta['x402/payment'].",
        })
      }

      // Step 1: Verify payment (local only — NO broadcast)
      const verification = await verifyX402Payment(resolvedProof, finalPrice)
      if (!verification.valid) {
        return jsonResult({ success: false, error: verification.error, errorCode: "PAYMENT_INVALID" })
      }

      // SECURITY: Reject if wallet param doesn't match payment signer
      if (args.wallet && args.wallet !== verification.payerWallet) {
        return jsonResult({
          success: false,
          error: `Wallet mismatch: payment signed by ${verification.payerWallet}, but wallet parameter is ${args.wallet}. You can only operate your own wallet.`,
          errorCode: "WALLET_MISMATCH",
        })
      }

      const allowed = await checkRateLimit(verification.payerWallet, true)
      if (!allowed) {
        const retryAfter = new Date(Date.now() + 60_000).toISOString()
        return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED", retryAfter })
      }

      // Step 2: Execute all operations sequentially (payment NOT yet broadcast)
      const results: any[] = []
      for (const op of args.operations) {
        const receiptId = `batch_${op.tool}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        try {
          const handler = BATCH_HANDLERS[op.tool]
          const result = await handler(verification.payerWallet, op.args || {})
          results.push({ ...result, success: true, receiptId })
        } catch (err: any) {
          results.push({ tool: op.tool, success: false, error: err.message })
        }
      }

      // Step 3: Settle payment (broadcast + confirm) — only after all ops executed
      const settlement = await settleX402Payment(resolvedProof)
      if (!settlement.success) {
        return jsonResult({
          success: false,
          error: `Operations executed but payment settlement failed: ${settlement.error}. You were NOT charged.`,
          results,
        })
      }

      // Record receipts with real txSignature
      for (const op of args.operations) {
        const matchingResult = results.find((r) => r.tool === op.tool)
        const receiptId = `batch_${op.tool}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        await recordReceipt({
          id: receiptId,
          wallet: verification.payerWallet,
          toolName: `batch:${op.tool}`,
          amount: breakdown.find((b) => b.tool === op.tool)?.price || 0,
          token: verification.paymentToken,
          txSignature: settlement.txSignature,
          timestamp: new Date().toISOString(),
          success: matchingResult?.success ?? false,
          error: matchingResult?.error,
          verificationHash: verification.verificationHash,
          settled: true,
        })
      }

      return jsonResult({
        success: true,
        wallet: verification.payerWallet,
        paymentTx: settlement.txSignature,
        totalPaid: finalPrice,
        discount: `${BATCH_DISCOUNT * 100}%`,
        results,
        _meta: {
          "x402/payment-response": {
            txSignature: settlement.txSignature,
            network: settlement.network,
            settled: true,
          },
        },
      })
    },
  )
}
