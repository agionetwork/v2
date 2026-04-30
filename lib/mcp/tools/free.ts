import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { parseLoanAccounts, LoanStatus, getStatusLabel } from "@/lib/loan-utils"
import type { ParsedLoan } from "@/lib/loan-utils"
import {
  getAgentConfig,
  getAgentPublicKey,
  getAgentHistory,
  isRedisConfigured,
  getRedis,
} from "@/lib/agent/redis"
import { resolveOwner, resolveOwners } from "@/lib/resolve-owner"
import {
  getActivityFeed,
  getFollowing,
  searchProfiles,
  getCustomProperty,
} from "@/lib/tapestry-server"
import { calculateAllPoints, calculatePointsDetailed, POINTS_FLOOR_VERSION, type TokenPrices } from "@/lib/points"
import { fetchTokenPrices } from "@/lib/token-prices"
import { SOLANA_CONFIG } from "@/config/solana"
import { TOKEN_MINTS, roundUi, resolveTokenProgram } from "@/lib/token-mints"
import { VALID_TOKENS } from "@/lib/agent/types"
import { getAllPrices } from "@/lib/mcp/pricing"
import { FEE_CONFIG, isFreeOperation, getFeeDescription, MIN_FEE_USDC, MAX_FEE_USDC } from "@/lib/fees/fee-calculator"
import { getReceipts } from "@/lib/mcp/receipts"
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token"
import { checkRateLimit, getSolanaNetworkCaip2 } from "@/lib/mcp/x402-verify"
import { sanitizeError } from "@/lib/mcp/errors"
import { jsonResult } from "./shared"

const STATUS_MAP: Record<string, number> = {
  pending: LoanStatus.Pending,
  active: LoanStatus.Accepted,
  rescinded: LoanStatus.Rescinded,
  repaid: LoanStatus.Repaid,
  foreclosed: LoanStatus.Foreclosed,
}

async function fetchAllLoans(): Promise<ParsedLoan[]> {
  const connection = createConnection()
  const program = createReadonlyProgram(connection)
  const allAccounts = await (program.account as any).loan.all()
  return parseLoanAccounts(allAccounts)
}

export function registerFreeTools(server: McpServer) {
  // --- list-loans ---
  server.tool(
    "list-loans",
    "List all loans on the Agio DeFi lending platform with optional filters",
    {
      status: z
        .enum(["pending", "active", "repaid", "foreclosed", "rescinded", "all"])
        .optional()
        .describe("Filter by loan status"),
      offerType: z
        .enum(["lend", "borrow", "all"])
        .optional()
        .describe("Filter by offer type"),
      debtToken: z
        .enum(["USDC", "EURC", "SOL"])
        .optional()
        .describe("Filter by debt token"),
      wallet: z
        .string()
        .optional()
        .describe("Filter by wallet address — returns only loans where this wallet is lender or borrower"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results to return (default 50)"),
    },
    async (args) => {
      let loans = await fetchAllLoans()

      if (args.status && args.status !== "all") {
        const statusNum = STATUS_MAP[args.status]
        if (statusNum !== undefined) {
          loans = loans.filter((l) => l.status === statusNum)
        }
      }

      if (args.offerType && args.offerType !== "all") {
        loans = loans.filter((l) => l.offerType === args.offerType)
      }

      if (args.debtToken) {
        loans = loans.filter((l) => l.debtTokenSymbol === args.debtToken)
      }

      if (args.wallet) {
        // Resolve owner wallet → agent wallet (loans store agent wallets on-chain)
        const agentPubkey = await getAgentPublicKey(args.wallet)
        const filterWallet = agentPubkey || args.wallet
        loans = loans.filter(
          (l) => l.lender === filterWallet || l.borrower === filterWallet,
        )
      }

      const limit = args.limit || 50
      loans = loans.slice(0, limit)

      // Resolve agent wallets → owner wallets
      const allWallets = loans.flatMap((l) => [l.lender, l.borrower].filter(Boolean) as string[])
      const ownerMap = await resolveOwners(allWallets)

      return jsonResult({
        success: true,
        total: loans.length,
        loans: loans.map((l) => ({
          ...l,
          statusLabel: getStatusLabel(l.status),
          lenderOwner: l.lender ? ownerMap.get(l.lender) || l.lender : null,
          borrowerOwner: l.borrower ? ownerMap.get(l.borrower) || l.borrower : null,
        })),
      })
    },
  )

  // --- get-loan ---
  server.tool(
    "get-loan",
    "Get details of a specific loan by its on-chain public key",
    {
      loanPublicKey: z.string().describe("The loan account's Solana public key"),
    },
    async (args) => {
      const loans = await fetchAllLoans()
      const loan = loans.find((l) => l.publicKey === args.loanPublicKey)

      if (!loan) {
        return jsonResult({ success: false, error: "Loan not found", errorCode: "LOAN_NOT_FOUND" })
      }

      // Resolve agent wallets → owner wallets
      const lenderOwner = loan.lender ? await resolveOwner(loan.lender) : null
      const borrowerOwner = loan.borrower ? await resolveOwner(loan.borrower) : null

      return jsonResult({
        success: true,
        loan: { ...loan, statusLabel: getStatusLabel(loan.status), lenderOwner, borrowerOwner },
      })
    },
  )

  // --- get-agent-status ---
  server.tool(
    "get-agent-status",
    "Get the status, configuration, and token balances of a wallet's Agio agent",
    {
      wallet: z.string().describe("Owner wallet address (Solana public key)"),
    },
    async (args) => {
      if (!isRedisConfigured()) {
        return jsonResult({ success: false, error: "Agent services not configured", errorCode: "SERVICE_UNAVAILABLE" })
      }

      const [config, agentPubkey] = await Promise.all([
        getAgentConfig(args.wallet),
        getAgentPublicKey(args.wallet),
      ])

      if (!config || !agentPubkey) {
        return jsonResult({ success: false, error: "Agent not found for this wallet", errorCode: "AGENT_NOT_FOUND" })
      }

      // Fetch balances
      const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")
      const agentPk = new PublicKey(agentPubkey)
      const balances: Record<string, number> = { SOL: 0, USDC: 0, EURC: 0 }

      try {
        const solBalance = await connection.getBalance(agentPk)
        balances.SOL = roundUi(solBalance / 1e9, "SOL")

        for (const symbol of ["USDC", "EURC"] as const) {
          try {
            const mint = TOKEN_MINTS[symbol]
            // Dynamically resolve token program from on-chain mint
            const tokProg = await resolveTokenProgram(connection, mint)

            // Try default derivation first (most wallets use TOKEN_PROGRAM_ID seed)
            if (!tokProg.equals(TOKEN_PROGRAM_ID)) {
              try {
                const defaultAta = getAssociatedTokenAddressSync(mint, agentPk)
                const tokenBalance = await connection.getTokenAccountBalance(defaultAta)
                if (tokenBalance.value.uiAmount) {
                  balances[symbol] = roundUi(tokenBalance.value.uiAmount, symbol)
                  continue
                }
              } catch { /* default ATA doesn't exist */ }
            }

            // Canonical derivation
            const ata = getAssociatedTokenAddressSync(mint, agentPk, false, tokProg)
            const tokenBalance = await connection.getTokenAccountBalance(ata)
            balances[symbol] = roundUi(tokenBalance.value.uiAmount || 0, symbol)
          } catch {
            // ATA doesn't exist = 0 balance
          }
        }
      } catch {
        // Balance fetch failed, return zeros
      }

      return jsonResult({
        success: true,
        config,
        agentPublicKey: agentPubkey,
        balances,
      })
    },
  )

  // --- get-agent-history ---
  server.tool(
    "get-agent-history",
    "Get the action history of a wallet's Agio agent",
    {
      wallet: z.string().describe("Owner wallet address"),
      page: z.number().min(1).optional().describe("Page number (default 1)"),
      pageSize: z.number().min(1).max(50).optional().describe("Items per page (default 20)"),
    },
    async (args) => {
      if (!isRedisConfigured()) {
        return jsonResult({ success: false, error: "Agent services not configured", errorCode: "SERVICE_UNAVAILABLE" })
      }

      const result = await getAgentHistory(args.wallet, args.page || 1, args.pageSize || 20)
      return jsonResult({ success: true, ...result })
    },
  )

  // --- get-leaderboard ---
  server.tool(
    "get-leaderboard",
    "Get the Agio platform points leaderboard ranked by lending/borrowing activity",
    {
      limit: z.number().min(1).max(50).optional().describe("Top N wallets (default 20)"),
    },
    async (args) => {
      const [loans, tokenPrices] = await Promise.all([
        fetchAllLoans(),
        fetchTokenPrices(),
      ])
      const pointsMap = calculateAllPoints(loans, tokenPrices)

      // Merge agent wallet points into their owner's entry
      const wallets = Array.from(pointsMap.keys())
      const ownerMap = await resolveOwners(wallets)
      for (const [wallet, owner] of ownerMap) {
        if (owner !== wallet) {
          const agentPts = pointsMap.get(wallet) || 0
          pointsMap.set(owner, (pointsMap.get(owner) || 0) + agentPts)
          pointsMap.delete(wallet)
        }
      }

      // High-water-mark floor (versioned key — V2 invalidates old phantom floors)
      if (isRedisConfigured()) {
        const redis = getRedis()
        for (const [wallet, calculated] of pointsMap) {
          try {
            const floorKey = `points:floor:${POINTS_FLOOR_VERSION}:${wallet}`
            const stored = await redis.get<number>(floorKey)
            const floor = stored || 0
            if (calculated > floor) {
              redis.set(floorKey, calculated).catch(() => {})
            } else if (floor > calculated) {
              pointsMap.set(wallet, floor)
            }
          } catch {
            // Redis failure: fall through to calculated value
          }
        }
      }

      const entries = Array.from(pointsMap.entries())
        .map(([wallet, points]) => ({ wallet, points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, args.limit || 20)

      return jsonResult({
        success: true,
        total: entries.length,
        leaderboard: entries,
      })
    },
  )

  // --- get-profile ---
  server.tool(
    "get-profile",
    "Get the Tapestry social profile for a Solana wallet address",
    {
      wallet: z.string().describe("Solana wallet address to look up"),
    },
    async (args) => {
      try {
        const [result, loans, tokenPrices] = await Promise.all([
          searchProfiles(args.wallet, 1, 0),
          fetchAllLoans(),
          fetchTokenPrices(),
        ])
        const profile = result.profiles[0]

        if (!profile) {
          return jsonResult({ success: false, error: "No profile found for this wallet", errorCode: "PROFILE_NOT_FOUND" })
        }

        // Points breakdown (owner + agent wallet)
        const ownerBreakdown = calculatePointsDetailed(loans, args.wallet, tokenPrices)
        const agentPubkey = await getAgentPublicKey(args.wallet)
        const agentBreakdown = agentPubkey
          ? calculatePointsDetailed(loans, agentPubkey, tokenPrices)
          : null

        return jsonResult({
          success: true,
          profile: {
            id: profile.profile.id,
            username: profile.profile.username,
            walletAddress: profile.profile.walletAddress,
            displayName: getCustomProperty(profile.profile, "displayName") || profile.profile.username,
            bio: getCustomProperty(profile.profile, "bio") || null,
            profileImage: getCustomProperty(profile.profile, "profileImage") || null,
            twitter: getCustomProperty(profile.profile, "twitter") || null,
            followers: profile.socialCounts?.followers || 0,
            following: profile.socialCounts?.following || 0,
          },
          points: {
            total: ownerBreakdown.total + (agentBreakdown?.total || 0),
            breakdown: {
              matchPoints: ownerBreakdown.matchPoints + (agentBreakdown?.matchPoints || 0),
              outcomePoints: ownerBreakdown.outcomePoints + (agentBreakdown?.outcomePoints || 0),
              diversityBonus: ownerBreakdown.diversityBonus + (agentBreakdown?.diversityBonus || 0),
              qualifyingLoans: ownerBreakdown.qualifyingLoans + (agentBreakdown?.qualifyingLoans || 0),
              uniqueCounterparties: ownerBreakdown.uniqueCounterparties + (agentBreakdown?.uniqueCounterparties || 0),
            },
          },
        })
      } catch (err: any) {
        const { code, message } = sanitizeError(err)
        return jsonResult({ success: false, error: message, errorCode: code })
      }
    },
  )

  // --- get-platform-info ---
  server.tool(
    "get-platform-info",
    "Get Agio platform information including pricing model, tool fees, supported tokens, and the recommended agent setup flow. Call this first to understand how to operate on the platform.",
    {},
    async () => {
      const treasuryWallet = process.env.X402_TREASURY_WALLET || ""
      const isDevnet =
        process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
        !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")
      const legacyPrices = await getAllPrices()

      // Build pricing v2 info: list free and paid operations
      const allToolNames = Object.keys(legacyPrices)
      const freeOperations = allToolNames.filter((t) => isFreeOperation(t))
      const paidOperations = Object.entries(FEE_CONFIG).map(([name, config]) => ({
        tool: name,
        type: config.type,
        rate: config.type === 'proportional' ? `${(config.rate * 100).toFixed(2)}%` : undefined,
        flat: config.type === 'flat' ? config.flat : undefined,
        baseField: config.baseField || undefined,
        description: getFeeDescription(name),
      }))

      return jsonResult({
        success: true,
        platform: "Agio DeFi Protocol",
        pricingModel: "proportional",
        pricingVersion: 2,
        x402Version: 2,
        facilitator: "self",
        caip2Network: getSolanaNetworkCaip2(),
        paymentTransport: ["_meta", "paymentProof"],
        acceptedPaymentTokens: ["USDC", "EURC", "SOL"],
        primaryPaymentToken: "USDC",
        paymentMints: {
          USDC: TOKEN_MINTS.USDC.toBase58(),
          EURC: TOKEN_MINTS.EURC.toBase58(),
          SOL: TOKEN_MINTS.SOL.toBase58(),
        },
        treasuryWallet: treasuryWallet || (isDevnet ? "(not configured on devnet — payments still work via devnet free mode)" : ""),
        supportedLendingTokens: Array.from(VALID_TOKENS),
        swapInstructions: "Use the swap-tokens tool to convert any token to any other via Jupiter Aggregator. Jupiter aggregates liquidity from all Solana DEXs for the best price.",
        agentSetupFlow: [
          "1. Call get-platform-info (this tool) to understand the platform",
          "2. Call create-profile (free) to create a social profile for the owner wallet — this is auto-created by create-agent but you can call it explicitly to set a custom username",
          "3. Call create-agent ($0.10 flat fee) to create an agent with a Privy-managed wallet. This also auto-creates a social profile for the owner wallet if one doesn't exist.",
          "4. Optionally call update-profile (free) to set displayName, bio, and profileImage for the owner wallet",
          "5. Fund the agent wallet: use devnet-airdrop (devnet only) or fund-agent-wallet",
          "6. Call configure-agent (free) to set lending/borrowing parameters",
          "7. Call activate-agent (free) to start automatic cycles",
          "8. Use lending tools (free — 1% origination fee collected on-chain at acceptance) for direct operations",
          "9. Use social tools (all free) to interact with other users",
          "10. Use swap-tokens (0.05% MCP fee) to convert between any tokens as needed",
          "Note: All on-chain activity by the agent wallet is attributed to the owner wallet on the leaderboard and social feed.",
        ],
        feeFormula: `fee = max($${MIN_FEE_USDC}, min($${MAX_FEE_USDC}, volume_usd * rate))`,
        freeOperations,
        paidOperations,
        toolPricing: legacyPrices,
        batchDiscount: "10% off sum of individual fees",
        devnetFreeMode: process.env.DEVNET_FREE_TOOLS === "true" &&
          (process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet") ||
            process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet"),
        scoringFormula: {
          version: 2,
          description: "Points are calculated per qualifying loan (Accepted, Repaid, or Foreclosed). Volume is converted to USD using live token prices.",
          matchPhase: "+2 base + (volumeUsd * 0.5), duration-weighted",
          outcomePhase: {
            repaid: "+5 base + (volumeUsd * 0.75), duration-weighted",
            foreclosedAsLender: "+2 base (no volume bonus)",
            foreclosedAsBorrower: "+1 base (no volume bonus)",
            active: "No outcome points until resolved",
          },
          diversityBonus: "+5 per unique counterparty (lifetime)",
          durationWeight: "min(1, elapsedSeconds / 86400) — scales 0→1 over 24 hours",
          antiWashTrade: [
            "Self-loans (lender === borrower) earn zero points",
            "Maximum 10 loans per unique wallet-pair (top 10 by volume)",
            "Duration-weighted: instant loans earn near-zero points",
          ],
        },
        notes: [
          "Lending operations are FREE in MCP — the 1% origination fee is collected on-chain when an offer is accepted (deducted from borrower's disbursement, sent to treasury)",
          "create-agent: flat $0.10 one-time MCP fee",
          "swap-tokens: 0.05% of swap volume (min $0.01, max $10.00 MCP fee)",
          "All other operations (create offer, rescind, repay, foreclose, social, config) are free",
          "Payment via paymentProof arg or _meta['x402/payment'] (x402 v2 standard) — only needed for paid MCP tools (create-agent, swap-tokens)",
          "Rate limits: 10 req/min for paid tools, 60 req/min for free tools",
          "NFT holder discount on origination fee is available (configured on-chain via VaultAuthority)",
          "DEVNET: When devnetFreeMode is true, all tools can be called with just the 'wallet' param (no x402 payment needed).",
        ],
      })
    },
  )

  // --- get-payment-history ---
  server.tool(
    "get-payment-history",
    "Get your x402 payment receipt history for all paid tool calls. Free — no payment required.",
    {
      wallet: z.string().describe("Your wallet address to look up receipts for"),
      page: z.number().min(1).optional().describe("Page number (default 1)"),
      pageSize: z.number().min(1).max(50).optional().describe("Items per page (default 20)"),
    },
    async (args) => {
      const result = await getReceipts(args.wallet, args.page || 1, args.pageSize || 20)
      return jsonResult({ success: true, ...result })
    },
  )

  // --- fund-agent-wallet ---
  server.tool(
    "fund-agent-wallet",
    "Broadcast a signed transaction that funds your agent wallet with SOL or SPL tokens. " +
    "Free — no x402 payment required. The transaction must be signed by your wallet and " +
    "transfer funds to your agent's wallet address.",
    {
      signedTransaction: z
        .string()
        .describe("Base64-encoded signed Solana transaction that transfers SOL or tokens to the agent wallet"),
      wallet: z
        .string()
        .describe("Your owner wallet address (must match the transaction signer)"),
    },
    async (args) => {
      // Rate limit
      const allowed = await checkRateLimit(args.wallet, false)
      if (!allowed) {
        return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED" })
      }

      // Look up agent wallet
      const agentPubkey = await getAgentPublicKey(args.wallet)
      if (!agentPubkey) {
        return jsonResult({ success: false, error: "Agent not found for this wallet. Create one first with create-agent.", errorCode: "AGENT_NOT_FOUND" })
      }

      // Decode and validate the transaction
      let tx: Transaction
      try {
        const buffer = Buffer.from(args.signedTransaction, "base64")
        tx = Transaction.from(buffer)
      } catch (err: any) {
        return jsonResult({ success: false, error: `Invalid transaction: ${err.message}`, errorCode: "INVALID_TRANSACTION" })
      }

      // Verify fee payer matches the owner wallet
      if (!tx.feePayer || tx.feePayer.toBase58() !== args.wallet) {
        return jsonResult({
          success: false,
          error: "Transaction fee payer must be your owner wallet address.",
          errorCode: "INVALID_FEE_PAYER",
        })
      }

      // Validate that at least one instruction sends funds TO the agent wallet.
      // We check for SOL transfers (SystemProgram) and SPL token transfers.
      const agentPk = new PublicKey(agentPubkey)
      let fundingDetected = false

      for (const ix of tx.instructions) {
        // SOL transfer via SystemProgram
        if (ix.programId.equals(SystemProgram.programId)) {
          if (ix.keys.length >= 2 && ix.keys[1].pubkey.equals(agentPk)) {
            fundingDetected = true
            break
          }
        }
        // SPL / Token-2022 transfer (destination is agent's ATA)
        if (ix.programId.equals(TOKEN_PROGRAM_ID) || ix.programId.equals(TOKEN_2022_PROGRAM_ID)) {
          // For SPL transfers, keys[1] is the destination token account.
          // Check both default and Token-2022 ATA derivations for each token.
          if (ix.keys.length >= 2) {
            const destAccount = ix.keys[1].pubkey
            for (const symbol of ["USDC", "EURC"] as const) {
              const agentAta = getAssociatedTokenAddressSync(TOKEN_MINTS[symbol], agentPk)
              if (destAccount.equals(agentAta)) {
                fundingDetected = true
                break
              }
              // Also check Token-2022 canonical derivation for EURC
              if (symbol === "EURC") {
                const agentAta2022 = getAssociatedTokenAddressSync(TOKEN_MINTS[symbol], agentPk, false, TOKEN_2022_PROGRAM_ID)
                if (destAccount.equals(agentAta2022)) {
                  fundingDetected = true
                  break
                }
              }
            }
            if (fundingDetected) break
          }
        }
      }

      if (!fundingDetected) {
        return jsonResult({
          success: false,
          error: `Transaction does not transfer funds to the agent wallet (${agentPubkey}). ` +
            `Ensure your transaction sends SOL or tokens to this address.`,
          errorCode: "INVALID_FUNDING_TX",
        })
      }

      // Broadcast the already-signed transaction
      try {
        const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")
        const buffer = Buffer.from(args.signedTransaction, "base64")

        const txSignature = await connection.sendRawTransaction(buffer, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed")
        await connection.confirmTransaction(
          { signature: txSignature, blockhash, lastValidBlockHeight },
          "confirmed",
        )

        return jsonResult({
          success: true,
          txSignature,
          agentWallet: agentPubkey,
          message: `Funds sent to agent wallet ${agentPubkey}. Use get-agent-status to check balances.`,
        })
      } catch (err: any) {
        const { code, message } = sanitizeError(err)
        return jsonResult({ success: false, error: `Transaction broadcast failed: ${message}`, errorCode: code })
      }
    },
  )

  // --- devnet-airdrop ---
  server.tool(
    "devnet-airdrop",
    "Airdrop devnet SOL to your agent wallet. Only available on devnet. " +
    "Free — no payment required. Max 2 SOL per request.",
    {
      wallet: z.string().describe("Your owner wallet address"),
      amount: z
        .number()
        .min(0.1)
        .max(2)
        .optional()
        .describe("Amount of SOL to airdrop (default 1, max 2)"),
    },
    async (args) => {
      // Only available on devnet
      const isDevnet =
        process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")
      if (!isDevnet) {
        return jsonResult({
          success: false,
          error: "devnet-airdrop is only available on Solana devnet.",
          errorCode: "DEVNET_ONLY",
        })
      }

      const allowed = await checkRateLimit(args.wallet, false)
      if (!allowed) {
        const retryAfter = new Date(Date.now() + 60_000).toISOString()
        return jsonResult({
          success: false,
          error: "Rate limit exceeded. Try again in 60 seconds.",
          errorCode: "RATE_LIMITED",
          retryAfter,
          suggestion: `Wait until ${retryAfter} before retrying.`,
        })
      }

      // Look up agent wallet
      const agentPubkey = await getAgentPublicKey(args.wallet)
      if (!agentPubkey) {
        return jsonResult({
          success: false,
          error: "Agent not found for this wallet. Create one first with create-agent.",
          errorCode: "AGENT_NOT_FOUND",
        })
      }

      const amountSol = args.amount ?? 1
      const lamports = Math.round(amountSol * LAMPORTS_PER_SOL)

      try {
        // Use the public devnet RPC for airdrops (Helius/custom RPCs may not support requestAirdrop)
        const airdropConnection = new Connection("https://api.devnet.solana.com", "confirmed")
        const agentPk = new PublicKey(agentPubkey)

        const txSignature = await airdropConnection.requestAirdrop(agentPk, lamports)

        // Confirm on the airdrop connection
        const { blockhash, lastValidBlockHeight } =
          await airdropConnection.getLatestBlockhash("confirmed")
        await airdropConnection.confirmTransaction(
          { signature: txSignature, blockhash, lastValidBlockHeight },
          "confirmed",
        )

        // Fetch updated SOL balance from main RPC
        const mainConnection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")
        const balanceLamports = await mainConnection.getBalance(agentPk)
        const balanceSol = balanceLamports / LAMPORTS_PER_SOL

        return jsonResult({
          success: true,
          txSignature,
          agentWallet: agentPubkey,
          airdropAmount: amountSol,
          newBalanceSol: balanceSol,
          message: `Airdropped ${amountSol} SOL to agent wallet ${agentPubkey}. New balance: ${balanceSol} SOL.`,
        })
      } catch (err: any) {
        const msg = err.message || err.toString() || "Unknown error"
        const isRateLimit =
          msg.includes("429") ||
          msg.includes("rate") ||
          msg.includes("Rate") ||
          msg.includes("Too Many") ||
          msg.includes("too many") ||
          (msg.includes("airdrop") && msg.includes("failed")) ||
          (err as any).code === 429

        if (isRateLimit) {
          const retryAfter = new Date(Date.now() + 10 * 60_000).toISOString()
          return jsonResult({
            success: false,
            error: "Solana devnet faucet rate limit reached.",
            errorCode: "FAUCET_RATE_LIMITED",
            retryAfter,
            suggestion: `Rate limited by the Solana devnet faucet. Try again after ${retryAfter}.`,
          })
        }

        return jsonResult({
          success: false,
          error: `Airdrop failed: ${msg}`,
          errorCode: "AIRDROP_FAILED",
          retryAfter: new Date(Date.now() + 60_000).toISOString(),
          suggestion: "The devnet faucet may be temporarily unavailable. Wait a moment and try again.",
        })
      }
    },
  )

  // --- devnet-token-faucet ---
  server.tool(
    "devnet-token-faucet",
    "Request USDC and/or EURC from Circle's faucet to your agent wallet. " +
    "Only available on devnet. Free — no payment required. " +
    "Requires CIRCLE_API_KEY env variable. Rate limit: 10 requests per 24 hours.",
    {
      wallet: z.string().describe("Your owner wallet address"),
      usdc: z.boolean().optional().describe("Request USDC (default true)"),
      eurc: z.boolean().optional().describe("Request EURC (default true)"),
    },
    async (args) => {
      // Only available on devnet
      const isDevnet =
        process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")
      if (!isDevnet) {
        return jsonResult({
          success: false,
          error: "devnet-token-faucet is only available on Solana devnet.",
          errorCode: "DEVNET_ONLY",
        })
      }

      const allowed = await checkRateLimit(args.wallet, false)
      if (!allowed) {
        return jsonResult({ success: false, error: "Rate limit exceeded. Try again in 60 seconds.", errorCode: "RATE_LIMITED" })
      }

      // Look up agent wallet
      const agentPubkey = await getAgentPublicKey(args.wallet)
      if (!agentPubkey) {
        return jsonResult({
          success: false,
          error: "Agent not found for this wallet. Create one first with create-agent.",
          errorCode: "AGENT_NOT_FOUND",
        })
      }

      const circleApiKey = process.env.CIRCLE_API_KEY
      if (!circleApiKey) {
        return jsonResult({
          success: false,
          error: "CIRCLE_API_KEY not configured. Add it to .env to use the Circle faucet.",
          errorCode: "SERVICE_UNAVAILABLE",
        })
      }

      const requestUsdc = args.usdc !== false
      const requestEurc = args.eurc !== false

      if (!requestUsdc && !requestEurc) {
        return jsonResult({
          success: false,
          error: "At least one of usdc or eurc must be true.",
          errorCode: "INVALID_PARAMS",
        })
      }

      try {
        const res = await fetch("https://api.circle.com/v1/faucet/drips", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${circleApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: agentPubkey,
            blockchain: "SOL-DEVNET",
            native: true,
            usdc: requestUsdc,
            eurc: requestEurc,
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          return jsonResult({
            success: false,
            error: `Circle faucet request failed (HTTP ${res.status}): ${text}`,
            errorCode: "FAUCET_ERROR",
          })
        }

        // Circle may return empty body on success — handle gracefully
        const text = await res.text()
        let data: any = null
        if (text.length > 0) {
          try { data = JSON.parse(text) } catch { data = text }
        }

        // Build summary of tokens received
        const received: string[] = []
        if (requestUsdc) received.push("USDC")
        if (requestEurc) received.push("EURC")

        return jsonResult({
          success: true,
          agentWallet: agentPubkey,
          tokensRequested: received,
          circleResponse: data,
          message: `Requested ${received.join(" and ")} from Circle faucet to agent wallet ${agentPubkey}. ` +
            `Tokens may take a few seconds to arrive. Use get-agent-status to check balances.`,
        })
      } catch (err: any) {
        return jsonResult({
          success: false,
          error: `Circle faucet request failed: ${err.message}`,
          errorCode: "FAUCET_ERROR",
        })
      }
    },
  )

  // --- get-events ---
  server.tool(
    "get-events",
    "Get events since a given timestamp — combines on-chain loan activity, agent actions, and social feed. Free — no payment required.",
    {
      wallet: z.string().describe("Wallet address to get events for"),
      since: z.string().optional().describe("ISO timestamp to filter events after (default: last 24 hours)"),
      types: z
        .array(z.enum(["loan", "agent", "social"]))
        .optional()
        .describe("Event types to include (default: all)"),
      limit: z.number().min(1).max(100).optional().describe("Max events to return (default 50)"),
    },
    async (args) => {
      const sinceDate = args.since
        ? new Date(args.since)
        : new Date(Date.now() - 24 * 60 * 60 * 1000)
      const sinceMs = sinceDate.getTime()
      const types = args.types || ["loan", "agent", "social"]
      const maxEvents = args.limit || 50
      const events: any[] = []

      // 1. On-chain loan events (filter loans involving this wallet)
      if (types.includes("loan")) {
        try {
          const loans = await fetchAllLoans()
          const walletLower = args.wallet.toLowerCase()
          // Also check agent wallet (on-chain stores agent wallets, user passes owner wallet)
          const agentPubkey = await getAgentPublicKey(args.wallet)
          const agentLower = agentPubkey?.toLowerCase()
          const relevant = loans.filter(
            (l) => {
              const bLower = l.borrower?.toLowerCase()
              const lLower = l.lender?.toLowerCase()
              return bLower === walletLower || lLower === walletLower ||
                (agentLower && (bLower === agentLower || lLower === agentLower))
            },
          )

          // Resolve owner wallets for all relevant loans
          const allWallets = relevant.flatMap((l) => [l.lender, l.borrower].filter(Boolean) as string[])
          const ownerMap = await resolveOwners(allWallets)

          for (const loan of relevant) {
            // Use loan start time as event timestamp (unix seconds → ms)
            const tsMs = loan.start ? loan.start * 1000 : null
            if (tsMs && tsMs > sinceMs) {
              const bLower = loan.borrower?.toLowerCase()
              const isBorrower = bLower === walletLower || (agentLower && bLower === agentLower)
              events.push({
                type: "loan",
                event: getStatusLabel(loan.status),
                timestamp: new Date(tsMs).toISOString(),
                data: {
                  publicKey: loan.publicKey,
                  offerType: loan.offerType,
                  debtToken: loan.debtTokenSymbol,
                  collateralToken: loan.collateralTokenSymbol,
                  debtAmount: loan.debtAmountUi,
                  collateralAmount: loan.collateralAmountUi,
                  apy: loan.apy,
                  role: isBorrower ? "borrower" : "lender",
                  lenderOwner: loan.lender ? ownerMap.get(loan.lender) || loan.lender : null,
                  borrowerOwner: loan.borrower ? ownerMap.get(loan.borrower) || loan.borrower : null,
                },
              })
            }
          }
        } catch {
          // Skip loan events on error
        }
      }

      // 2. Agent action history
      if (types.includes("agent") && isRedisConfigured()) {
        try {
          const history = await getAgentHistory(args.wallet, 1, 100)
          for (const action of history.actions || []) {
            if (new Date(action.timestamp).getTime() > sinceMs) {
              events.push({
                type: "agent",
                event: action.type,
                timestamp: action.timestamp,
                data: {
                  details: action.details,
                  txHash: action.txHash,
                  status: action.status,
                },
              })
            }
          }
        } catch {
          // Skip agent events on error
        }
      }

      // 3. Social activity feed
      if (types.includes("social")) {
        try {
          const profileRes = await searchProfiles(args.wallet, 1, 0)
          const profile = profileRes.profiles[0]
          if (profile) {
            const profileId = profile.profile.id
            const followingRes = await getFollowing(profileId, 50, 1)
            const followingIds = (followingRes.profiles || []).map(
              (p: any) => p.profile?.id || p.id,
            )
            const feed = await getActivityFeed([profileId, ...followingIds], 50)
            for (const item of feed) {
              if (new Date(item.createdAt).getTime() > sinceMs) {
                events.push({
                  type: "social",
                  event: item.eventType,
                  timestamp: item.createdAt,
                  data: {
                    profileId: item.profileId,
                    message: item.message,
                    debtToken: item.debtToken,
                    amount: item.amount,
                    apy: item.apy,
                  },
                })
              }
            }
          }
        } catch {
          // Skip social events on error
        }
      }

      // Sort by timestamp descending and limit
      events.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )

      return jsonResult({
        success: true,
        since: sinceDate.toISOString(),
        total: events.length,
        events: events.slice(0, maxEvents),
      })
    },
  )
}
