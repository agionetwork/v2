import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { handlePaidAction } from "./paid"
import { getAgentPublicKey, getOwnerByAgentPublicKey } from "@/lib/agent/redis"
import { resolveOwner } from "@/lib/resolve-owner"
import { signAndSendTransaction } from "@/lib/agent/privy"
import { executeSwap, resolveTokenMint } from "@/lib/agent/jupiter"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { parseLoanAccounts, LoanStatus, calculateInterest, calculateFullRepayAmount } from "@/lib/loan-utils"
import { TOKEN_MINTS, TOKEN_DECIMALS, roundUi, getTokenProgram, resolveTokenProgram } from "@/lib/token-mints"
import {
  buildCreateLendOfferTx,
  buildCreateBorrowRequestTx,
  buildAcceptBorrowRequestTx,
  buildAcceptLendOfferTx,
  buildRepayLoanTx,
  buildForecloseLoanTx,
  buildRescindBorrowOfferTx,
  buildRescindLendOfferTx,
  buildAddCollateralTx,
} from "@/lib/agent/transaction-builder"
import { PublicKey, Connection, Keypair } from "@solana/web3.js"
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { SOLANA_CONFIG } from "@/config/solana"
import type { ParsedLoan } from "@/lib/loan-utils"
import { sanitizeError } from "@/lib/mcp/errors"
import { calculateFee } from "@/lib/fees/fee-calculator"
import { convertToUsd } from "@/lib/fees/price-oracle"
import { fetchTokenPrices } from "@/lib/token-prices"
import { SECURITY_CONFIG } from "@/lib/security-config"
import { PYTH_FEED_IDS } from "@/lib/token-prices"
import { postPriceUpdatesForMints } from "@/lib/pyth-poster"
import { jsonResult } from "./shared"
import {
  searchProfiles as searchProfilesServer,
  postLoanActivity,
} from "@/lib/tapestry-server"
import {
  notifyLoanAccepted,
  notifyLoanRepaid,
  notifyLoanForeclosed,
  notifyNetworkLoanCreated,
  notifyCollateralAdded,
} from "@/lib/dialect"

function isDevnet(): boolean {
  return (
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
    !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")
  )
}

async function fetchLoan(loanPublicKey: string): Promise<ParsedLoan | null> {
  const connection = createConnection()
  const program = createReadonlyProgram(connection)
  const allAccounts = await (program.account as any).loan.all()
  const loans = parseLoanAccounts(allAccounts)
  return loans.find((l) => l.publicKey === loanPublicKey) || null
}

async function getAgentBalance(
  agentPk: PublicKey,
  tokenSymbol: string,
): Promise<number> {
  const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")
  try {
    if (tokenSymbol === "SOL") {
      const balance = await connection.getBalance(agentPk)
      return balance / 1e9
    }
    const mint = TOKEN_MINTS[tokenSymbol]
    if (!mint) return 0

    // Dynamically resolve the token program from the on-chain mint account
    const tokenProgramId = await resolveTokenProgram(connection, mint)

    // For Token-2022 mints, check default derivation first — most wallets use it
    if (!tokenProgramId.equals(TOKEN_PROGRAM_ID)) {
      try {
        const defaultAta = getAssociatedTokenAddressSync(mint, agentPk, true)
        const info = await connection.getTokenAccountBalance(defaultAta)
        if (info.value.uiAmount) return info.value.uiAmount
      } catch { /* default ATA doesn't exist, try canonical */ }
    }

    const ata = getAssociatedTokenAddressSync(mint, agentPk, true, tokenProgramId)
    const info = await connection.getTokenAccountBalance(ata)
    return info.value.uiAmount || 0
  } catch {
    return 0
  }
}

function loadBotKeypair(): Keypair {
  const raw = process.env.FORECLOSURE_BOT_KEYPAIR
  if (!raw) throw new Error("FORECLOSURE_BOT_KEYPAIR env var required for oracle price posting")
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
}

/**
 * Post Pyth price updates for two token symbols and return the on-chain
 * PriceUpdateV2 account addresses. Caller must invoke cleanup() after
 * the consuming transaction confirms.
 */
export async function postPricesForTokens(
  connection: Connection,
  debtToken: string,
  collateralToken: string,
): Promise<{
  collateralPriceUpdate: PublicKey
  debtPriceUpdate: PublicKey
  cleanup: () => Promise<void>
}> {
  const collateralFeedId = PYTH_FEED_IDS[collateralToken]
  const debtFeedId = PYTH_FEED_IDS[debtToken]
  if (!collateralFeedId || !debtFeedId) {
    throw new Error(`No Pyth feed ID for ${!collateralFeedId ? collateralToken : debtToken}`)
  }

  const botKeypair = loadBotKeypair()
  const feedIds = [collateralFeedId, debtFeedId]
  // Deduplicate if same token (e.g., USDC/USDC — unlikely but safe)
  const uniqueFeedIds = [...new Set(feedIds)]

  const { priceUpdateAccounts, cleanup } = await postPriceUpdatesForMints(
    connection,
    botKeypair,
    uniqueFeedIds,
  )

  const collateralPriceUpdate = priceUpdateAccounts[collateralFeedId]
  const debtPriceUpdate = priceUpdateAccounts[debtFeedId]

  if (!collateralPriceUpdate || !debtPriceUpdate) {
    // Clean up any accounts that were posted
    await cleanup().catch(() => {})
    throw new Error("Failed to post Pyth price updates — missing price update account")
  }

  return { collateralPriceUpdate, debtPriceUpdate, cleanup }
}

/** Pre-validate loan terms against protocol limits (collateral ratio, APY, min debt).
 *  mode: 'create' uses MIN_COLLATERAL_RATIO (150%), 'accept' uses MIN_ACCEPT_COLLATERAL_RATIO (130%). */
export async function validateLoanTerms(params: {
  debtToken: string
  collateralToken: string
  debtAmount: number
  collateralAmount: number
  apy: number
  mode?: 'create' | 'accept'
}): Promise<string | null> {
  const {
    MIN_COLLATERAL_RATIO,
    MIN_ACCEPT_COLLATERAL_RATIO,
    MAX_APY,
    MIN_DEBT_USD,
  } = SECURITY_CONFIG.VALIDATION
  const effectiveMinRatio = params.mode === 'accept' ? MIN_ACCEPT_COLLATERAL_RATIO : MIN_COLLATERAL_RATIO

  // Same-token check
  if (params.debtToken === params.collateralToken) {
    return `Debt and collateral must be different tokens (both are ${params.debtToken}).`
  }

  // APY check
  if (params.apy > MAX_APY) {
    return `APY ${params.apy}% exceeds protocol maximum of ${MAX_APY}%.`
  }

  // Fetch current oracle prices
  const prices = await fetchTokenPrices()

  // Min debt value check (round to cents to avoid oracle price variance rejecting exact minimums)
  const debtPrice = prices[params.debtToken] ?? 1
  const debtValueUsd = params.debtAmount * debtPrice
  if (Math.round(debtValueUsd * 100) / 100 < MIN_DEBT_USD) {
    return `Debt amount ${params.debtAmount} ${params.debtToken} ($${debtValueUsd.toFixed(2)}) is below minimum $${MIN_DEBT_USD.toFixed(2)}.`
  }

  // Collateral ratio check.
  // We tolerate a small drift between the client's price snapshot and ours
  // (server fetches Hermes/Pyth at validation time; client read minutes
  // earlier). Without this, 150% on the slider becomes 149.6% on the server
  // and the loan is wrongly rejected. The on-chain program still enforces
  // its hard threshold against the freshly-posted Pyth oracle.
  const PRICE_DRIFT_TOLERANCE_BPS = 100 // 1.0%
  const tolerantMinRatio = effectiveMinRatio - PRICE_DRIFT_TOLERANCE_BPS / 100
  const collateralPrice = prices[params.collateralToken] ?? 1
  const collateralValueUsd = params.collateralAmount * collateralPrice
  const ratio = debtValueUsd > 0 ? (collateralValueUsd / debtValueUsd) * 100 : 0
  if (ratio < tolerantMinRatio) {
    const minCollateral = (params.debtAmount * debtPrice * effectiveMinRatio) / (100 * collateralPrice)
    return (
      `Collateral ratio ${ratio.toFixed(1)}% is below protocol minimum of ${effectiveMinRatio}%. ` +
      `Required: at least ${minCollateral.toFixed(4)} ${params.collateralToken} ` +
      `for ${params.debtAmount} ${params.debtToken} (at current price $${collateralPrice.toFixed(2)}/${params.collateralToken}).`
    )
  }

  return null // valid
}

/** Resolve owner wallet → Tapestry profile ID, then post loan activity. Fire-and-forget. */
async function postActivityForWallet(
  ownerWallet: string,
  event: "created" | "accepted" | "repaid" | "foreclosed",
  details: {
    loanType?: string
    debtToken?: string
    collateralToken?: string
    amount?: number
    collateralAmount?: number
    apy?: number
    duration?: number
    txSignature?: string
  },
): Promise<void> {
  try {
    // Safety: if an agent wallet is passed, resolve to owner wallet first
    const resolved = await resolveOwner(ownerWallet)
    const result = await searchProfilesServer(resolved, 1, 0)
    const profile = result.profiles?.[0]
    if (!profile?.profile?.id) return
    await postLoanActivity(profile.profile.id, event, details)
  } catch {
    // Non-critical: don't let feed posting break the tool response
  }
}

export function registerLendingTools(server: McpServer) {
  // --- create-lend-offer ---
  server.tool(
    "create-lend-offer",
    "Create a lend offer on Agio. You deposit debt tokens into escrow and wait for a borrower to accept. IMPORTANT: debtToken and collateralToken MUST be different — same-token loans are not supported. Free — 1% origination fee is deducted on-chain when accepted.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      debtToken: z.enum(["USDC", "EURC", "SOL"]).describe("Token you are lending"),
      collateralToken: z.enum(["USDC", "EURC", "SOL"]).describe("Accepted collateral token"),
      debtAmount: z.number().positive().describe("Amount to lend (UI units, e.g. 100.5)"),
      collateralAmount: z.number().positive().describe("Required collateral amount (UI units)"),
      duration: z.number().min(1).max(365).describe("Loan duration in days"),
      apy: z.number().min(0).max(200).describe("Annual percentage yield (0% allowed for Sharia-compliant lending)"),
    },
    async (args, extra) => {
      // Pre-check: same-token loans are not allowed
      if (args.debtToken === args.collateralToken) {
        return jsonResult({
          success: false,
          error: `Debt token and collateral token cannot be the same (${args.debtToken}). Use different tokens for debt and collateral.`,
          errorCode: "SAME_TOKEN_NOT_ALLOWED",
        })
      }

      // Pre-check: reject invalid duration on devnet before any payment processing
      if (isDevnet() && args.duration > 1) {
        return jsonResult({
          success: false,
          error: "Devnet loans are limited to 1 day (86400 seconds). Set duration=1.",
          errorCode: "DEVNET_DURATION_LIMIT",
        })
      }

      // Pre-check: validate loan terms (collateral ratio, APY, min debt)
      const termError = await validateLoanTerms({
        debtToken: args.debtToken,
        collateralToken: args.collateralToken,
        debtAmount: args.debtAmount,
        collateralAmount: args.collateralAmount,
        apy: args.apy,
      })
      if (termError) {
        return jsonResult({ success: false, error: termError, errorCode: "VALIDATION_FAILED" })
      }

      return handlePaidAction(
        "create-lend-offer",
        args.paymentProof,
        "Create a lend offer (free — 1% origination fee on-chain at acceptance)",
        async (wallet) => {

          if (args.debtAmount < 1.0) {
            throw new Error("Minimum loan amount is $1.00")
          }

          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          const agentPk = new PublicKey(agentPubkeyStr)
          const balance = await getAgentBalance(agentPk, args.debtToken)
          if (balance < args.debtAmount) {
            throw new Error(`Insufficient ${args.debtToken} balance: ${balance}. Need ${args.debtAmount}.`)
          }

          const connection = createConnection()
          const program = createReadonlyProgram(connection)

          // Post Pyth price updates (required by on-chain collateral ratio validation)
          const { collateralPriceUpdate, debtPriceUpdate, cleanup } =
            await postPricesForTokens(connection, args.debtToken, args.collateralToken)

          let txHash: string
          try {
            const serializedTx = await buildCreateLendOfferTx(connection, program, agentPk, {
              debtTokenSymbol: args.debtToken,
              collateralTokenSymbol: args.collateralToken,
              debtAmount: args.debtAmount,
              collateralAmount: args.collateralAmount,
              duration: args.duration * 86400,
              apy: args.apy,
            }, {
              collateralPriceUpdate,
              debtPriceUpdate,
            })

            txHash = await signAndSendTransaction(wallet, serializedTx)
          } finally {
            // Reclaim rent from ephemeral price update accounts
            cleanup().catch(() => {})
          }

          // Post activity to Tapestry feed (fire-and-forget)
          postActivityForWallet(wallet, "created", {
            loanType: "lend offer",
            debtToken: args.debtToken,
            collateralToken: args.collateralToken,
            amount: args.debtAmount,
            collateralAmount: args.collateralAmount,
            apy: args.apy,
            duration: args.duration * 86400,
            txSignature: txHash,
          })

          // Notify creator's followers via Dialect (fire-and-forget)
          notifyNetworkLoanCreated(wallet, {
            debtToken: args.debtToken,
            amount: args.debtAmount,
            apy: args.apy,
            loanType: "lend offer",
          }).catch(() => {})

          return {
            txHash,
            message: `Created lend offer: ${args.debtAmount} ${args.debtToken} at ${args.apy}% APY for ${args.duration} days`,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- create-borrow-request ---
  server.tool(
    "create-borrow-request",
    "Create a borrow request on Agio. You deposit collateral into escrow and wait for a lender to accept. IMPORTANT: debtToken and collateralToken MUST be different — same-token loans are not supported. Free — 1% origination fee is deducted on-chain when accepted.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      debtToken: z.enum(["USDC", "EURC", "SOL"]).describe("Token you want to borrow"),
      collateralToken: z.enum(["USDC", "EURC", "SOL"]).describe("Collateral token you deposit"),
      debtAmount: z.number().positive().describe("Amount to borrow (UI units)"),
      collateralAmount: z.number().positive().describe("Collateral to deposit (UI units)"),
      duration: z.number().min(1).max(365).describe("Loan duration in days"),
      apy: z.number().min(0).max(200).describe("Annual percentage yield (0% allowed for Sharia-compliant lending)"),
    },
    async (args, extra) => {
      // Pre-check: same-token loans are not allowed
      if (args.debtToken === args.collateralToken) {
        return jsonResult({
          success: false,
          error: `Debt token and collateral token cannot be the same (${args.debtToken}). Use different tokens for debt and collateral.`,
          errorCode: "SAME_TOKEN_NOT_ALLOWED",
        })
      }

      // Pre-check: reject invalid duration on devnet before any payment processing
      if (isDevnet() && args.duration > 1) {
        return jsonResult({
          success: false,
          error: "Devnet loans are limited to 1 day (86400 seconds). Set duration=1.",
          errorCode: "DEVNET_DURATION_LIMIT",
        })
      }

      // Pre-check: validate loan terms (collateral ratio, APY, min debt)
      const termError = await validateLoanTerms({
        debtToken: args.debtToken,
        collateralToken: args.collateralToken,
        debtAmount: args.debtAmount,
        collateralAmount: args.collateralAmount,
        apy: args.apy,
      })
      if (termError) {
        return jsonResult({ success: false, error: termError, errorCode: "VALIDATION_FAILED" })
      }

      return handlePaidAction(
        "create-borrow-request",
        args.paymentProof,
        "Create a borrow request (free — 1% origination fee on-chain at acceptance)",
        async (wallet) => {

          if (args.debtAmount < 1.0) {
            throw new Error("Minimum loan amount is $1.00")
          }

          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          const agentPk = new PublicKey(agentPubkeyStr)
          const balance = await getAgentBalance(agentPk, args.collateralToken)
          if (balance < args.collateralAmount) {
            throw new Error(`Insufficient ${args.collateralToken} collateral: ${balance}. Need ${args.collateralAmount}.`)
          }

          const connection = createConnection()
          const program = createReadonlyProgram(connection)

          // Post Pyth price updates (required by on-chain collateral ratio validation)
          const { collateralPriceUpdate, debtPriceUpdate, cleanup } =
            await postPricesForTokens(connection, args.debtToken, args.collateralToken)

          let txHash: string
          try {
            const serializedTx = await buildCreateBorrowRequestTx(connection, program, agentPk, {
              debtTokenSymbol: args.debtToken,
              collateralTokenSymbol: args.collateralToken,
              debtAmount: args.debtAmount,
              collateralAmount: args.collateralAmount,
              duration: args.duration * 86400,
              apy: args.apy,
            }, {
              collateralPriceUpdate,
              debtPriceUpdate,
            })

            txHash = await signAndSendTransaction(wallet, serializedTx)
          } finally {
            // Reclaim rent from ephemeral price update accounts
            cleanup().catch(() => {})
          }

          // Post activity to Tapestry feed (fire-and-forget)
          postActivityForWallet(wallet, "created", {
            loanType: "borrow request",
            debtToken: args.debtToken,
            collateralToken: args.collateralToken,
            amount: args.debtAmount,
            collateralAmount: args.collateralAmount,
            apy: args.apy,
            duration: args.duration * 86400,
            txSignature: txHash,
          })

          // Notify creator's followers via Dialect (fire-and-forget)
          notifyNetworkLoanCreated(wallet, {
            debtToken: args.debtToken,
            amount: args.debtAmount,
            apy: args.apy,
            loanType: "borrow request",
          }).catch(() => {})

          return {
            txHash,
            message: `Created borrow request: ${args.debtAmount} ${args.debtToken} with ${args.collateralAmount} ${args.collateralToken} collateral at ${args.apy}% APY`,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- accept-lend-offer ---
  server.tool(
    "accept-lend-offer",
    "Accept an existing lend offer as borrower. You deposit collateral and receive debt tokens minus 1% origination fee. Free MCP call.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      loanPublicKey: z.string().describe("The on-chain loan account public key to accept"),
    },
    async (args, extra) => {
      // Fetch loan before payment to compute proportional fee
      const loan = await fetchLoan(args.loanPublicKey)
      if (!loan) return jsonResult({ success: false, error: "Loan not found", errorCode: "LOAN_NOT_FOUND" })
      if (loan.status !== LoanStatus.Pending) return jsonResult({ success: false, error: "Loan is not pending", errorCode: "LOAN_NOT_PENDING" })
      if (loan.offerType !== "lend") return jsonResult({ success: false, error: "This is not a lend offer. Use accept-borrow-request instead.", errorCode: "WRONG_OFFER_TYPE" })

      // Re-check collateral ratio at current oracle price (accept allows down to 130%)
      const ratioError = await validateLoanTerms({
        debtToken: loan.debtTokenSymbol,
        collateralToken: loan.collateralTokenSymbol,
        debtAmount: loan.debtAmountUi,
        collateralAmount: loan.collateralAmountUi,
        apy: loan.apy,
        mode: 'accept',
      })
      if (ratioError) {
        return jsonResult({ success: false, error: `Cannot accept: ${ratioError}`, errorCode: "VALIDATION_FAILED" })
      }

      return handlePaidAction(
        "accept-lend-offer",
        args.paymentProof,
        "Accept a lend offer (free MCP call — 1% origination fee deducted on-chain)",
        async (wallet) => {
          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          // SEC-001: Block self-lending — check both agent wallet and owner wallet
          if (loan.lender === agentPubkeyStr) {
            throw new Error("Cannot accept your own lend offer. Lender and borrower must be different wallets.")
          }
          const lenderOwner = loan.lender ? await getOwnerByAgentPublicKey(loan.lender) : null
          if (lenderOwner && lenderOwner === wallet) {
            throw new Error("Cannot accept your own lend offer. Lender and borrower must be different wallets.")
          }

          const agentPk = new PublicKey(agentPubkeyStr)
          const collateralBalance = await getAgentBalance(agentPk, loan.collateralTokenSymbol)
          if (collateralBalance < loan.collateralAmountUi) {
            throw new Error(`Insufficient ${loan.collateralTokenSymbol} collateral: ${collateralBalance}. Need ${loan.collateralAmountUi}.`)
          }

          const connection = createConnection()
          const program = createReadonlyProgram(connection)

          // Post Pyth price updates (required by on-chain accept instruction)
          const { collateralPriceUpdate, debtPriceUpdate, cleanup } =
            await postPricesForTokens(connection, loan.debtTokenSymbol, loan.collateralTokenSymbol)

          let txHash: string
          try {
            const serializedTx = await buildAcceptLendOfferTx(connection, program, agentPk, loan, {
              collateralPriceUpdate,
              debtPriceUpdate,
            })
            txHash = await signAndSendTransaction(wallet, serializedTx)
          } finally {
            cleanup().catch(() => {})
          }

          // Post activity to Tapestry feed (fire-and-forget)
          postActivityForWallet(wallet, "accepted", {
            loanType: "lend offer",
            debtToken: loan.debtTokenSymbol,
            collateralToken: loan.collateralTokenSymbol,
            amount: loan.debtAmountUi,
            apy: loan.apy,
            duration: loan.duration,
            txSignature: txHash,
          })

          // Notify lender via Dialect (fire-and-forget)
          if (loan.lender) {
            const lenderWallet = await getOwnerByAgentPublicKey(loan.lender) || loan.lender
            notifyLoanAccepted(lenderWallet, {
              debtToken: loan.debtTokenSymbol,
              amount: loan.debtAmountUi,
              apy: loan.apy,
              loanType: "lend offer",
            }).catch(() => {})
          }

          return {
            txHash,
            message: `Accepted lend offer: borrowed ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY`,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- accept-borrow-request ---
  server.tool(
    "accept-borrow-request",
    "Accept an existing borrow request as lender. You send debt tokens to the borrower. Free MCP call — 1% origination fee deducted on-chain from disbursement.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      loanPublicKey: z.string().describe("The on-chain loan account public key to accept"),
    },
    async (args, extra) => {
      // Fetch loan before payment to compute proportional fee
      const loan = await fetchLoan(args.loanPublicKey)
      if (!loan) return jsonResult({ success: false, error: "Loan not found", errorCode: "LOAN_NOT_FOUND" })
      if (loan.status !== LoanStatus.Pending) return jsonResult({ success: false, error: "Loan is not pending", errorCode: "LOAN_NOT_PENDING" })
      if (loan.offerType !== "borrow") return jsonResult({ success: false, error: "This is not a borrow request. Use accept-lend-offer instead.", errorCode: "WRONG_OFFER_TYPE" })

      // Re-check collateral ratio at current oracle price (accept allows down to 130%)
      const ratioError = await validateLoanTerms({
        debtToken: loan.debtTokenSymbol,
        collateralToken: loan.collateralTokenSymbol,
        debtAmount: loan.debtAmountUi,
        collateralAmount: loan.collateralAmountUi,
        apy: loan.apy,
        mode: 'accept',
      })
      if (ratioError) {
        return jsonResult({ success: false, error: `Cannot accept: ${ratioError}`, errorCode: "VALIDATION_FAILED" })
      }

      return handlePaidAction(
        "accept-borrow-request",
        args.paymentProof,
        "Accept a borrow request (free MCP call — 1% origination fee deducted on-chain)",
        async (wallet) => {
          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          // SEC-001: Block self-lending — check both agent wallet and owner wallet
          if (loan.borrower === agentPubkeyStr) {
            throw new Error("Cannot accept your own borrow request. Lender and borrower must be different wallets.")
          }
          const borrowerOwner = loan.borrower ? await getOwnerByAgentPublicKey(loan.borrower) : null
          if (borrowerOwner && borrowerOwner === wallet) {
            throw new Error("Cannot accept your own borrow request. Lender and borrower must be different wallets.")
          }

          const agentPk = new PublicKey(agentPubkeyStr)
          const debtBalance = await getAgentBalance(agentPk, loan.debtTokenSymbol)
          if (debtBalance < loan.debtAmountUi) {
            throw new Error(`Insufficient ${loan.debtTokenSymbol} balance: ${debtBalance}. Need ${loan.debtAmountUi}.`)
          }

          const connection = createConnection()
          const program = createReadonlyProgram(connection)

          // Post Pyth price updates (required by on-chain accept instruction)
          const { collateralPriceUpdate, debtPriceUpdate, cleanup } =
            await postPricesForTokens(connection, loan.debtTokenSymbol, loan.collateralTokenSymbol)

          let txHash: string
          try {
            const serializedTx = await buildAcceptBorrowRequestTx(connection, program, agentPk, loan, {
              collateralPriceUpdate,
              debtPriceUpdate,
            })
            txHash = await signAndSendTransaction(wallet, serializedTx)
          } finally {
            cleanup().catch(() => {})
          }

          // Post activity to Tapestry feed (fire-and-forget)
          postActivityForWallet(wallet, "accepted", {
            loanType: "borrow request",
            debtToken: loan.debtTokenSymbol,
            collateralToken: loan.collateralTokenSymbol,
            amount: loan.debtAmountUi,
            apy: loan.apy,
            duration: loan.duration,
            txSignature: txHash,
          })

          // Notify borrower via Dialect (fire-and-forget)
          if (loan.borrower) {
            const borrowerWallet = await getOwnerByAgentPublicKey(loan.borrower) || loan.borrower
            notifyLoanAccepted(borrowerWallet, {
              debtToken: loan.debtTokenSymbol,
              amount: loan.debtAmountUi,
              apy: loan.apy,
              loanType: "borrow request",
            }).catch(() => {})
          }

          return {
            txHash,
            message: `Accepted borrow request: lent ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY`,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- repay-loan ---
  server.tool(
    "repay-loan",
    "Repay an active loan as borrower. Sends debt tokens to lender and receives collateral back. Free — no additional fee.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      loanPublicKey: z.string().describe("The loan to repay"),
      amount: z.number().positive().optional().describe("Amount to repay in UI units (defaults to full debt amount)"),
    },
    async (args, extra) => {
      // Fetch loan before payment to compute proportional fee
      const loan = await fetchLoan(args.loanPublicKey)
      if (!loan) return jsonResult({ success: false, error: "Loan not found", errorCode: "LOAN_NOT_FOUND" })
      if (loan.status !== LoanStatus.Accepted) return jsonResult({ success: false, error: "Loan is not active", errorCode: "LOAN_NOT_ACTIVE" })

      // Calculate total owed including interest using the on-chain formula:
      // interest = debt_amount * apy * duration / APY_DIVISOR
      // Note: the on-chain program charges FULL-TERM interest regardless of when you repay
      const interest = calculateInterest(loan)
      const totalOwed = loan.debtAmountUi + interest

      // The on-chain repay_amount parameter must be <= remaining debt_amount (principal).
      // Interest is handled internally by the program on full repay.
      // If user specifies amount >= remaining debt, cap to exact remaining debt (full repay).
      const isFullRepay = !args.amount || args.amount >= loan.debtAmountUi
      const repayAmount = isFullRepay ? loan.debtAmountUi : args.amount!

      return handlePaidAction(
        "repay-loan",
        args.paymentProof,
        "Repay a loan (free — no additional fee)",
        async (wallet) => {
          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          if (loan.borrower?.toLowerCase() !== agentPubkeyStr.toLowerCase()) {
            throw new Error("Agent is not the borrower of this loan")
          }

          const agentPk = new PublicKey(agentPubkeyStr)
          const debtBalance = await getAgentBalance(agentPk, loan.debtTokenSymbol)
          // Full repay: borrower needs principal + interest (program transfers both).
          // Partial repay: borrower needs just the partial amount.
          const minNeeded = isFullRepay ? totalOwed : repayAmount
          if (debtBalance < minNeeded) {
            throw new Error(
              `Insufficient ${loan.debtTokenSymbol} balance: ${debtBalance.toFixed(4)}. ` +
              `Need ${minNeeded.toFixed(4)} (principal: ${loan.debtAmountUi}, interest: ${interest.toFixed(4)}).`
            )
          }

          const connection = createConnection()
          const program = createReadonlyProgram(connection)
          const serializedTx = await buildRepayLoanTx(connection, program, agentPk, loan, repayAmount)
          const txHash = await signAndSendTransaction(wallet, serializedTx)

          // Post activity with actual repay amount (fire-and-forget)
          const activityAmount = isFullRepay ? totalOwed : repayAmount
          postActivityForWallet(wallet, "repaid", {
            debtToken: loan.debtTokenSymbol,
            collateralToken: loan.collateralTokenSymbol,
            amount: activityAmount,
            apy: loan.apy,
            txSignature: txHash,
          })

          // Notify lender via Dialect (fire-and-forget)
          if (loan.lender) {
            const lenderWallet = await getOwnerByAgentPublicKey(loan.lender) || loan.lender
            notifyLoanRepaid(lenderWallet, {
              debtToken: loan.debtTokenSymbol,
              amount: activityAmount,
            }).catch(() => {})
          }

          return {
            txHash,
            message: `Repaid ${activityAmount.toFixed(4)} ${loan.debtTokenSymbol} (principal: ${loan.debtAmountUi}, interest: ${interest.toFixed(4)})`,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- foreclose-loan ---
  server.tool(
    "foreclose-loan",
    "Foreclose an expired loan as lender. Seizes the collateral. Free — no additional fee.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      loanPublicKey: z.string().describe("The expired loan to foreclose"),
    },
    async (args, extra) => {
      // Fetch loan before payment to compute proportional fee
      const loan = await fetchLoan(args.loanPublicKey)
      if (!loan) return jsonResult({ success: false, error: "Loan not found", errorCode: "LOAN_NOT_FOUND" })
      if (loan.status !== LoanStatus.Accepted) return jsonResult({ success: false, error: "Loan is not active", errorCode: "LOAN_NOT_ACTIVE" })

      return handlePaidAction(
        "foreclose-loan",
        args.paymentProof,
        "Foreclose a loan (free — no additional fee)",
        async (wallet) => {
          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          if (loan.lender?.toLowerCase() !== agentPubkeyStr.toLowerCase()) {
            throw new Error("Agent is not the lender of this loan")
          }

          const now = Date.now() / 1000
          if (loan.start && now < loan.start + loan.duration) {
            throw new Error("Loan has not expired yet")
          }

          const agentPk = new PublicKey(agentPubkeyStr)
          const connection = createConnection()
          const program = createReadonlyProgram(connection)
          const serializedTx = await buildForecloseLoanTx(connection, program, agentPk, loan)
          const txHash = await signAndSendTransaction(wallet, serializedTx)

          // Post activity to Tapestry feed (fire-and-forget)
          postActivityForWallet(wallet, "foreclosed", {
            debtToken: loan.debtTokenSymbol,
            collateralToken: loan.collateralTokenSymbol,
            amount: loan.debtAmountUi,
            apy: loan.apy,
            txSignature: txHash,
          })

          // Notify borrower via Dialect (fire-and-forget)
          if (loan.borrower) {
            const borrowerWallet = await getOwnerByAgentPublicKey(loan.borrower) || loan.borrower
            notifyLoanForeclosed(borrowerWallet, {
              debtToken: loan.debtTokenSymbol,
              amount: loan.debtAmountUi,
            }).catch(() => {})
          }

          return {
            txHash,
            message: `Foreclosed loan: seized ${loan.collateralAmountUi} ${loan.collateralTokenSymbol} collateral`,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- rescind-offer ---
  server.tool(
    "rescind-offer",
    "Rescind (cancel) your own pending loan offer. Returns escrowed funds. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      loanPublicKey: z.string().describe("The pending offer to cancel"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "rescind-offer",
        args.paymentProof,
        "Rescind a pending offer on Agio",
        async (wallet) => {
          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          const loan = await fetchLoan(args.loanPublicKey)
          if (!loan) throw new Error("Loan not found")
          if (loan.status !== LoanStatus.Pending) throw new Error("Loan is not pending — cannot rescind")

          const agentPk = new PublicKey(agentPubkeyStr)
          const connection = createConnection()
          const program = createReadonlyProgram(connection)
          let serializedTx: string

          if (loan.offerType === "lend" && loan.lender?.toLowerCase() === agentPubkeyStr.toLowerCase()) {
            // Agent created a lend offer (agent is lender) → rescindBorrowOffer returns debt tokens
            serializedTx = await buildRescindBorrowOfferTx(connection, program, agentPk, loan)
          } else if (loan.offerType === "borrow" && loan.borrower?.toLowerCase() === agentPubkeyStr.toLowerCase()) {
            // Agent created a borrow request (agent is borrower) → rescindLendOffer returns collateral
            serializedTx = await buildRescindLendOfferTx(connection, program, agentPk, loan)
          } else {
            throw new Error("Agent is not the creator of this offer")
          }

          const txHash = await signAndSendTransaction(wallet, serializedTx)
          return {
            txHash,
            message: `Rescinded ${loan.offerType} offer: ${loan.debtAmountUi} ${loan.debtTokenSymbol}`,
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )

  // --- swap-tokens ---
  server.tool(
    "swap-tokens",
    "Swap tokens via Jupiter Aggregator. Supports any token pair with liquidity (e.g. SOL→USDC, USDC→EURC, BONK→USDC). Fee: 0.05% of swap volume ($0.01 min, $10 max).",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed USDC transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      inputToken: z.string().describe("Input token symbol (USDC, EURC, SOL) or Solana mint address"),
      outputToken: z.string().describe("Output token symbol (USDC, EURC, SOL) or Solana mint address"),
      amount: z.number().positive().describe("Amount to swap in UI units (e.g. 1.5 SOL, 100 USDC)"),
      slippageBps: z.number().min(1).max(5000).optional().describe("Slippage tolerance in basis points (default 50 = 0.5%)"),
    },
    async (args, extra) => {
      // Compute proportional fee from swap volume
      const volumeUsd = await convertToUsd(args.amount, args.inputToken)
      const fee = calculateFee("swap-tokens", volumeUsd)

      return handlePaidAction(
        "swap-tokens",
        args.paymentProof,
        `Swap tokens via Jupiter (fee: $${fee.toFixed(2)} — 0.05% of $${volumeUsd.toFixed(2)})`,
        async (wallet) => {
          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          // Resolve token symbols to mints and compute raw amount
          const inputMint = resolveTokenMint(args.inputToken)
          const inputSymbol = args.inputToken.toUpperCase()
          const decimals = TOKEN_DECIMALS[inputSymbol] || 9
          const rawAmount = Math.round(args.amount * 10 ** decimals)

          const result = await executeSwap(
            wallet,
            args.inputToken,
            args.outputToken,
            rawAmount,
            args.slippageBps || 50,
          )

          return {
            txSignature: result.txSignature,
            inputToken: args.inputToken,
            outputToken: args.outputToken,
            inputAmount: args.amount,
            outputAmount: roundUi(Number(result.outAmount) / 10 ** (TOKEN_DECIMALS[args.outputToken.toUpperCase()] || 9), args.outputToken.toUpperCase()),
            priceImpact: result.priceImpactPct,
            message: `Swapped ${args.amount} ${args.inputToken} → ${args.outputToken} via Jupiter`,
          }
        },
        extra,
        args.wallet,
        fee,
      )
    },
  )

  // --- add-collateral ---
  server.tool(
    "add-collateral",
    "Add more collateral to an active loan (borrower only). Reduces liquidation risk. Free — no payment required.",
    {
      paymentProof: z.string().optional().describe("Base64-encoded signed transfer transaction"),
      wallet: z.string().optional().describe("Your Solana wallet address (required on devnet free mode)"),
      apiKey: z.string().optional().describe("API key from create-agent (required on devnet free mode)"),
      loanPublicKey: z.string().describe("The loan account's public key"),
      amount: z.number().positive().describe("Amount of collateral to add (in UI units)"),
    },
    async (args, extra) => {
      return handlePaidAction(
        "add-collateral",
        args.paymentProof,
        "Add collateral to an active loan",
        async (wallet) => {
          const agentPubkeyStr = await getAgentPublicKey(wallet)
          if (!agentPubkeyStr) throw new Error("Agent not found. Create one first with create-agent.")

          const loan = await fetchLoan(args.loanPublicKey)
          if (!loan) throw new Error("Loan not found")
          if (loan.status !== LoanStatus.Accepted) throw new Error("Loan is not active — cannot add collateral")
          if (loan.borrower?.toLowerCase() !== agentPubkeyStr.toLowerCase()) {
            throw new Error("Agent is not the borrower of this loan")
          }

          // Check collateral balance
          const agentPk = new PublicKey(agentPubkeyStr)
          const balance = await getAgentBalance(agentPk, loan.collateralTokenSymbol)
          if (balance < args.amount) {
            throw new Error(
              `Insufficient ${loan.collateralTokenSymbol} balance: have ${balance}, need ${args.amount}`,
            )
          }

          const connection = createConnection()
          const program = createReadonlyProgram(connection)
          const serializedTx = await buildAddCollateralTx(
            connection,
            program,
            agentPk,
            loan,
            args.amount,
          )

          const txHash = await signAndSendTransaction(wallet, serializedTx)

          // Notify lender that borrower added collateral (fire-and-forget)
          if (loan.lender) {
            const lenderWallet = (await getOwnerByAgentPublicKey(loan.lender)) || loan.lender
            notifyCollateralAdded(lenderWallet, {
              collateralToken: loan.collateralTokenSymbol,
              addedAmount: args.amount,
            }).catch(() => {})
          }

          return {
            txHash,
            message: `Added ${args.amount} ${loan.collateralTokenSymbol} collateral to loan`,
            newCollateralTotal: roundUi(loan.collateralAmountUi + args.amount, loan.collateralTokenSymbol),
          }
        },
        extra,
        args.wallet,
        undefined,
        args.apiKey,
      )
    },
  )
}
