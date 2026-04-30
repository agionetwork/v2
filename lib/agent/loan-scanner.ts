import { Program } from "@coral-xyz/anchor"
import { parseLoanAccounts, type ParsedLoan, LoanStatus } from "@/lib/loan-utils"
import { TOKEN_MINTS } from "@/lib/token-mints"
import { SECURITY_CONFIG } from "@/lib/security-config"
import type { AgentConfig } from "./types"

// Reverse lookup: mint address → symbol
const MINT_TO_SYMBOL: Record<string, string> = {}
for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
  MINT_TO_SYMBOL[mint.toBase58()] = symbol
}

// Cache getProgramAccounts results to avoid hammering the RPC
// The public devnet endpoint rate-limits this heavy call aggressively
let loansCache: { data: ParsedLoan[]; ts: number } | null = null
const CACHE_TTL_MS = 10_000 // 10 seconds

const MAX_RETRIES = 3
const INITIAL_RETRY_MS = 2_000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchAllLoans(program: Program): Promise<ParsedLoan[]> {
  const now = Date.now()
  if (loansCache && now - loansCache.ts < CACHE_TTL_MS) {
    return loansCache.data
  }

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const accounts = await (program.account as any).loan.all()
      const data = parseLoanAccounts(accounts)
      loansCache = { data, ts: now }
      return data
    } catch (err) {
      lastError = err
      // Wait before retrying (2s, 4s, 8s)
      if (attempt < MAX_RETRIES - 1) {
        await sleep(INITIAL_RETRY_MS * Math.pow(2, attempt))
      }
    }
  }

  throw lastError
}

// Pending borrow requests: borrower posted, needs a lender (public + private)
export function filterPendingBorrowRequests(allLoans: ParsedLoan[]): ParsedLoan[] {
  return allLoans.filter(
    (l) =>
      l.status === LoanStatus.Pending &&
      l.offerType === "borrow",
  )
}

// Pending lend offers: lender posted, needs a borrower (public + private)
export function filterPendingLendOffers(allLoans: ParsedLoan[]): ParsedLoan[] {
  return allLoans.filter(
    (l) =>
      l.status === LoanStatus.Pending &&
      l.offerType === "lend",
  )
}

// Expired loans where agent is lender (can foreclose)
export function filterExpiredLoans(
  allLoans: ParsedLoan[],
  agentPubkey: string,
): ParsedLoan[] {
  const now = Math.floor(Date.now() / 1000)

  return allLoans.filter((l) => {
    if (l.status !== LoanStatus.Accepted) return false
    if (l.lender?.toLowerCase() !== agentPubkey.toLowerCase()) return false
    if (!l.start) return false
    return l.start + l.duration < now
  })
}

// Active loans where agent is borrower and close to expiry (within 1 hour)
export function filterLoansToRepay(
  allLoans: ParsedLoan[],
  agentPubkey: string,
): ParsedLoan[] {
  const now = Math.floor(Date.now() / 1000)
  const ONE_HOUR = 3600

  return allLoans.filter((l) => {
    if (l.status !== LoanStatus.Accepted) return false
    if (l.borrower?.toLowerCase() !== agentPubkey.toLowerCase()) return false
    if (!l.start) return false
    const expiry = l.start + l.duration
    // For short-duration loans (devnet), use half the loan duration as the repay window
    const repayWindow = Math.min(ONE_HOUR, Math.max(l.duration * 0.5, 120))
    return expiry - now < repayWindow && expiry > now
  })
}

// Check if a loan matches the agent config parameters
// Returns null if matches, or a skip reason string if not
export function matchLoanToConfig(
  loan: ParsedLoan,
  config: AgentConfig,
  side: "lend" | "borrow",
  tokenPrices?: Record<string, number>,
): string | null {
  // Reject micro-loans: on-chain contract doesn't enforce min duration,
  // so a malicious actor could create 1-second loans to steal collateral via instant foreclosure
  const MIN_DURATION_SECONDS = 86400 // 1 day
  if (loan.duration < MIN_DURATION_SECONDS) {
    return `duration ${loan.duration}s < minimum 1 day`
  }

  // Protocol-level limits (absolute floor/ceiling regardless of agent config)
  const { MIN_COLLATERAL_RATIO: PROTOCOL_MIN_RATIO, MAX_APY: PROTOCOL_MAX_APY } = SECURITY_CONFIG.VALIDATION

  if (side === "lend") {
    if (!config.lendEnabled) return "lending disabled"
    if (loan.apy < config.lendMinApy) return `APY ${loan.apy}% < min ${config.lendMinApy}%`
    if (loan.apy > PROTOCOL_MAX_APY) return `APY ${loan.apy}% > protocol max ${PROTOCOL_MAX_APY}%`

    // Amount check in USD
    const debtPrice = tokenPrices?.[loan.debtTokenSymbol] ?? 1
    const loanValueUsd = loan.debtAmountUi * debtPrice
    if (loanValueUsd < config.lendMinAmountUsd) return `$${loanValueUsd.toFixed(0)} < min $${config.lendMinAmountUsd}`
    if (loanValueUsd > config.lendMaxAmountUsd) return `$${loanValueUsd.toFixed(0)} > max $${config.lendMaxAmountUsd}`

    const durationDays = loan.duration / 86400
    if (durationDays > config.lendMaxDuration) return `duration ${durationDays.toFixed(1)}d > max ${config.lendMaxDuration}d`

    if (!config.lendTokens.includes(loan.debtTokenSymbol)) return `debt token ${loan.debtTokenSymbol} not in [${config.lendTokens}]`
    if (!config.lendAcceptedCollateral.includes(loan.collateralTokenSymbol)) return `collateral ${loan.collateralTokenSymbol} not in [${config.lendAcceptedCollateral}]`

    // Collateral ratio check (dual range + protocol floor)
    const collPrice = tokenPrices?.[loan.collateralTokenSymbol] ?? 1
    const collValueUsd = loan.collateralAmountUi * collPrice
    const actualRatio = loanValueUsd > 0 ? (collValueUsd / loanValueUsd) * 100 : 0
    const effectiveMinRatio = Math.max(config.lendMinCollateralRatio, PROTOCOL_MIN_RATIO)
    if (actualRatio < effectiveMinRatio) return `ratio ${actualRatio.toFixed(0)}% < min ${effectiveMinRatio}%`
    if (actualRatio > config.lendMaxCollateralRatio) return `ratio ${actualRatio.toFixed(0)}% > max ${config.lendMaxCollateralRatio}%`

    return null // matches
  }

  if (side === "borrow") {
    if (!config.borrowEnabled) return "borrowing disabled"
    if (loan.apy > config.borrowMaxApy) return `APY ${loan.apy}% > max ${config.borrowMaxApy}%`
    if (loan.apy > PROTOCOL_MAX_APY) return `APY ${loan.apy}% > protocol max ${PROTOCOL_MAX_APY}%`

    // Amount check in USD
    const debtPrice = tokenPrices?.[loan.debtTokenSymbol] ?? 1
    const loanValueUsd = loan.debtAmountUi * debtPrice
    if (loanValueUsd < config.borrowMinAmountUsd) return `$${loanValueUsd.toFixed(0)} < min $${config.borrowMinAmountUsd}`
    if (loanValueUsd > config.borrowMaxAmountUsd) return `$${loanValueUsd.toFixed(0)} > max $${config.borrowMaxAmountUsd}`

    const durationDays = loan.duration / 86400
    if (durationDays > config.borrowMaxDuration) return `duration ${durationDays.toFixed(1)}d > max ${config.borrowMaxDuration}d`

    if (!config.borrowTokens.includes(loan.debtTokenSymbol)) return `debt token ${loan.debtTokenSymbol} not in [${config.borrowTokens}]`
    if (!config.borrowCollateralTokens.includes(loan.collateralTokenSymbol)) return `collateral ${loan.collateralTokenSymbol} not in [${config.borrowCollateralTokens}]`

    // Collateral ratio check (dual range + protocol floor)
    const collPrice = tokenPrices?.[loan.collateralTokenSymbol] ?? 1
    const collValueUsd = loan.collateralAmountUi * collPrice
    const actualRatio = loanValueUsd > 0 ? (collValueUsd / loanValueUsd) * 100 : 0
    const effectiveMinRatio = Math.max(config.borrowMinCollateralRatio, PROTOCOL_MIN_RATIO)
    if (actualRatio < effectiveMinRatio) return `ratio ${actualRatio.toFixed(0)}% < min ${effectiveMinRatio}%`
    if (actualRatio > config.borrowMaxCollateralRatio) return `ratio ${actualRatio.toFixed(0)}% > max ${config.borrowMaxCollateralRatio}%`

    return null // matches
  }

  return "invalid side"
}

// Pending lend offers created by this specific agent
export function filterPendingLendOffersByAgent(
  allLoans: ParsedLoan[],
  agentPubkey: string,
): ParsedLoan[] {
  return allLoans.filter(
    (l) =>
      l.status === LoanStatus.Pending &&
      l.offerType === "lend" &&
      l.lender?.toLowerCase() === agentPubkey.toLowerCase(),
  )
}

// Pending borrow requests created by this specific agent
export function filterPendingBorrowRequestsByAgent(
  allLoans: ParsedLoan[],
  agentPubkey: string,
): ParsedLoan[] {
  return allLoans.filter(
    (l) =>
      l.status === LoanStatus.Pending &&
      l.offerType === "borrow" &&
      l.borrower?.toLowerCase() === agentPubkey.toLowerCase(),
  )
}

// Count active loans where agent is lender (for exposure tracking)
export function countActiveLoansAsLender(
  allLoans: ParsedLoan[],
  agentPubkey: string,
): { count: number; totalExposure: number } {
  let count = 0
  let totalExposure = 0

  for (const l of allLoans) {
    if (l.status === LoanStatus.Accepted && l.lender?.toLowerCase() === agentPubkey.toLowerCase()) {
      count++
      totalExposure += l.debtAmountUi
    }
  }

  return { count, totalExposure }
}
