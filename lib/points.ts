import { type ParsedLoan, LoanStatus } from '@/lib/loan-utils'

// Points System V2 — Volume-Weighted, Outcome-Differentiated Scoring
//
// Per wallet, per qualifying loan (Accepted / Repaid / Foreclosed):
//
//   Match phase:  (MATCH_BASE + volumeUsd × MATCH_VOLUME_RATE) × durationWeight
//   Outcome:
//     Repaid:              (REPAY_BASE + volumeUsd × REPAY_VOLUME_RATE) × durationWeight
//     Foreclosed (lender):  FORECLOSE_LENDER_BASE × durationWeight
//     Foreclosed (borrower):FORECLOSE_BORROWER_BASE × durationWeight
//     Active (Accepted):    0  (no outcome yet)
//   Diversity:  +DIVERSITY_BONUS per unique counterparty (lifetime)
//
// Anti-wash-trading protections (unchanged from V1):
//   - Self-loans (lender === borrower) earn zero points
//   - Maximum 10 loans per unique counterparty pair (top 10 by volume)
//   - Duration-weighted: 5-min loan earns ~0.3% of 1-day loan
//   - Minimum debt amount of 0.01 for volume contribution
//
// Monotonicity guarantee:
//   - Top-N-by-volume pair selection ensures new loans never displace higher ones
//   - High-water-mark floor in Redis (versioned: points:floor:v2:) prevents decreases
//
// No negative points — foreclosure is legitimate, earns less than repay
//
// Typical points per completed 1-day repaid loan:
//   $1 USDC:   ~9 pts  (match: 2.5, repay: 5.75, diversity: bonus if new counterparty)
//   $10 USDC:  ~20 pts (match: 7, repay: 12.5, + diversity)
//   $100 USDC: ~132 pts (match: 52, repay: 80, + diversity)

// --- V2 scoring constants ---
const MAX_LOANS_PER_PAIR = 10
const MIN_DURATION_WEIGHT = 86400 // 1 day in seconds
const MIN_DEBT_AMOUNT = 0.01

const MATCH_BASE = 2               // averaged from create=1, accept=3
const MATCH_VOLUME_RATE = 0.5      // per USD of volume
const REPAY_BASE = 5
const REPAY_VOLUME_RATE = 0.75     // per USD of volume
const FORECLOSE_LENDER_BASE = 2
const FORECLOSE_BORROWER_BASE = 1
const DIVERSITY_BONUS_PER_COUNTERPARTY = 5

const DEFAULT_TOKEN_PRICES: TokenPrices = { SOL: 150, USDC: 1, EURC: 1 }

/** Redis floor version — bump to invalidate stale floors from old formula */
export const POINTS_FLOOR_VERSION = 'v2'

// --- Types ---

export type TokenPrices = Record<string, number>

export interface PointsBreakdown {
  total: number
  matchPoints: number           // base + volume from match phase
  outcomePoints: number         // base + volume from outcome phase
  diversityBonus: number        // counterparties × DIVERSITY_BONUS_PER_COUNTERPARTY
  qualifyingLoans: number       // loans that earned points
  uniqueCounterparties: number  // distinct counterparties
}

// --- Helpers (unchanged from V1) ---

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function isWashTrade(loan: ParsedLoan): boolean {
  if (loan.lender && loan.borrower && loan.lender === loan.borrower) return true
  return false
}

function loanDurationElapsed(loan: ParsedLoan): number {
  if (!loan.start) return 0
  const end = (loan.status === LoanStatus.Repaid || loan.status === LoanStatus.Foreclosed)
    ? loan.start + loan.duration
    : Date.now() / 1000
  return Math.max(0, end - loan.start)
}

interface QualifyingLoan {
  loan: ParsedLoan
  isBorrower: boolean
}

// --- Core V2 scoring ---

/**
 * Detailed points breakdown for a single wallet across all their loans.
 * Callers can optionally pass live token prices for USD volume conversion.
 * Without prices, uses safe defaults (USDC/EURC=$1, SOL=$150).
 */
export function calculatePointsDetailed(
  loans: ParsedLoan[],
  wallet: string,
  tokenPrices?: TokenPrices,
): PointsBreakdown {
  const prices = tokenPrices ?? DEFAULT_TOKEN_PRICES

  let matchPts = 0
  let outcomePts = 0
  const counterparties = new Set<string>()

  // --- Loan filtering + pair bucketing (same as V1) ---

  const zeroedDebt: QualifyingLoan[] = []
  const pairBuckets = new Map<string, QualifyingLoan[]>()
  const noPairLoans: QualifyingLoan[] = []

  for (const loan of loans) {
    if (
      loan.status !== LoanStatus.Accepted &&
      loan.status !== LoanStatus.Repaid &&
      loan.status !== LoanStatus.Foreclosed
    ) continue

    const isLender = loan.lender === wallet
    const isBorrower = loan.borrower === wallet

    if (!isLender && !isBorrower) continue
    if (isWashTrade(loan)) continue

    const ql: QualifyingLoan = { loan, isBorrower }

    if (loan.debtAmountUi < MIN_DEBT_AMOUNT) {
      zeroedDebt.push(ql)
      continue
    }

    const counterparty = isLender ? loan.borrower : loan.lender
    if (counterparty) {
      const pk = pairKey(wallet, counterparty)
      if (!pairBuckets.has(pk)) pairBuckets.set(pk, [])
      pairBuckets.get(pk)!.push(ql)
    } else {
      noPairLoans.push(ql)
    }
  }

  // Top-N by volume per pair (monotonicity guarantee)
  const selected: QualifyingLoan[] = [...noPairLoans]
  for (const [, bucket] of pairBuckets) {
    bucket.sort((a, b) => b.loan.debtAmountUi - a.loan.debtAmountUi)
    selected.push(...bucket.slice(0, MAX_LOANS_PER_PAIR))
  }

  // --- Score each qualifying loan ---

  const allScored = [...selected, ...zeroedDebt]

  for (const { loan, isBorrower } of allScored) {
    const durationWeight = Math.min(1, loanDurationElapsed(loan) / MIN_DURATION_WEIGHT)
    const isZeroed = loan.debtAmountUi < MIN_DEBT_AMOUNT
    const tokenPrice = prices[loan.debtTokenSymbol] ?? 1
    const volumeUsd = isZeroed ? 0 : loan.debtAmountUi * tokenPrice

    // Match phase — every qualifying loan earns this
    matchPts += (MATCH_BASE + volumeUsd * MATCH_VOLUME_RATE) * durationWeight

    // Outcome phase
    if (loan.status === LoanStatus.Repaid) {
      outcomePts += (REPAY_BASE + volumeUsd * REPAY_VOLUME_RATE) * durationWeight
    } else if (loan.status === LoanStatus.Foreclosed) {
      outcomePts += (isBorrower ? FORECLOSE_BORROWER_BASE : FORECLOSE_LENDER_BASE) * durationWeight
    }
    // Accepted (active): +0 outcome

    // Track counterparties for diversity bonus
    const cp = isBorrower ? loan.lender : loan.borrower
    if (cp) counterparties.add(cp)
  }

  const diversityBonus = counterparties.size * DIVERSITY_BONUS_PER_COUNTERPARTY
  const matchPoints = Math.floor(matchPts)
  const outcomePoints = Math.floor(outcomePts)
  const total = Math.max(0, matchPoints + outcomePoints + diversityBonus)

  return {
    total,
    matchPoints,
    outcomePoints,
    diversityBonus,
    qualifyingLoans: allScored.length,
    uniqueCounterparties: counterparties.size,
  }
}

/**
 * Backward-compatible points calculation — returns total only.
 */
export function calculatePoints(
  loans: ParsedLoan[],
  wallet: string,
  tokenPrices?: TokenPrices,
): number {
  return calculatePointsDetailed(loans, wallet, tokenPrices).total
}

/**
 * Calculate points for all wallets that appear in the loan set.
 */
export function calculateAllPoints(
  loans: ParsedLoan[],
  tokenPrices?: TokenPrices,
): Map<string, number> {
  const walletPoints = new Map<string, number>()

  const relevantLoans = loans.filter(l =>
    l.status === LoanStatus.Accepted ||
    l.status === LoanStatus.Repaid ||
    l.status === LoanStatus.Foreclosed
  )

  const wallets = new Set<string>()
  for (const loan of relevantLoans) {
    if (loan.lender) wallets.add(loan.lender)
    if (loan.borrower) wallets.add(loan.borrower)
  }

  for (const wallet of wallets) {
    walletPoints.set(wallet, calculatePoints(relevantLoans, wallet, tokenPrices))
  }

  return walletPoints
}

export function formatPoints(points: number): string {
  if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`
  if (points >= 1000) return `${(points / 1000).toFixed(1)}K`
  return points.toLocaleString()
}
