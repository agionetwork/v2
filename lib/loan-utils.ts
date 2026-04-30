import { PublicKey } from '@solana/web3.js'
import { TOKEN_MINTS, TOKEN_DECIMALS, roundUi } from '@/lib/token-mints'

// Loan status enum matching the on-chain program (state/loan.rs)
export enum LoanStatus {
  Pending = 0,      // Offer is open, waiting for counterparty
  Accepted = 1,     // Both parties matched, loan is active
  Rescinded = 2,    // Offer was cancelled
  Repaid = 3,       // Loan fully repaid
  Foreclosed = 4,   // Loan was foreclosed (expired)
  Liquidated = 5,   // Loan was liquidated (under-collateralized)
}

// Offer type determined by which party created the offer
export type OfferType = 'lend' | 'borrow'

export interface ParsedLoan {
  publicKey: string
  version: number
  createKey: string
  bump: number
  lender: string | null
  borrower: string | null
  debtMint: string
  collateralMint: string
  debtAmount: number        // raw amount (with decimals)
  collateralAmount: number  // raw amount (with decimals)
  debtAmountUi: number      // UI amount (divided by decimals)
  collateralAmountUi: number
  start: number | null      // unix timestamp
  duration: number          // seconds
  apy: number               // 0-100
  privateStatus: number
  status: LoanStatus
  debtTokenSymbol: string
  collateralTokenSymbol: string
  offerType: OfferType      // 'lend' if lender created, 'borrow' if borrower created
}

// Reverse lookup: mint address → symbol
const MINT_TO_SYMBOL: Record<string, string> = {}
for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
  MINT_TO_SYMBOL[mint.toBase58()] = symbol
}

function getMintSymbol(mintAddress: string): string {
  return MINT_TO_SYMBOL[mintAddress] || mintAddress.slice(0, 4) + '...'
}

function getMintDecimals(mintAddress: string): number {
  const symbol = MINT_TO_SYMBOL[mintAddress]
  if (symbol && TOKEN_DECIMALS[symbol]) return TOKEN_DECIMALS[symbol]
  return 9 // default
}

// Determine offer type based on which fields are populated:
// - create_lend_offer sets borrower (borrower creates, wants to find lender → borrow request)
// - create_borrow_offer sets lender (lender creates, wants to find borrower → lend offer)
function getOfferType(lender: string | null, borrower: string | null): OfferType {
  if (lender && !borrower) return 'lend'    // Lender posted, needs borrower
  if (borrower && !lender) return 'borrow'  // Borrower posted, needs lender
  // Both set = accepted/active loan, default to 'lend'
  return 'lend'
}

export function parseLoanAccount(pubkey: PublicKey, account: any): ParsedLoan {
  const debtMint = account.debtMint.toBase58()
  const collateralMint = account.collateralMint.toBase58()
  const debtDecimals = getMintDecimals(debtMint)
  const collateralDecimals = getMintDecimals(collateralMint)

  const debtAmount = account.debtAmount.toNumber()
  const collateralAmount = account.collateralAmount.toNumber()
  // Option<Pubkey> may deserialize as null or as the zero pubkey (system program)
  const ZERO_PK = '11111111111111111111111111111111'
  const rawLender = account.lender ? account.lender.toBase58() : null
  const rawBorrower = account.borrower ? account.borrower.toBase58() : null
  const lender = rawLender && rawLender !== ZERO_PK ? rawLender : null
  const borrower = rawBorrower && rawBorrower !== ZERO_PK ? rawBorrower : null

  // Determine on-chain status
  let status = account.status as LoanStatus

  // Legacy fix: Active loans with debtAmount=0 were repaid before FIX-006
  // (interest calculation fix) but the contract didn't transition the status.
  // Treat them as Repaid at the API layer so they display correctly.
  if (status === LoanStatus.Accepted && debtAmount === 0) {
    status = LoanStatus.Repaid
  }

  return {
    publicKey: pubkey.toBase58(),
    version: account.version,
    createKey: account.createKey.toBase58(),
    bump: account.bump,
    lender,
    borrower,
    debtMint,
    collateralMint,
    debtAmount,
    collateralAmount,
    debtAmountUi: roundUi(debtAmount / (10 ** debtDecimals), getMintSymbol(debtMint)),
    collateralAmountUi: roundUi(collateralAmount / (10 ** collateralDecimals), getMintSymbol(collateralMint)),
    start: account.start ? account.start.toNumber() : null,
    duration: account.duration.toNumber(),
    apy: account.apy,
    privateStatus: account.privateStatus,
    status,
    debtTokenSymbol: getMintSymbol(debtMint),
    collateralTokenSymbol: getMintSymbol(collateralMint),
    offerType: getOfferType(lender, borrower),
  }
}

// Parse raw Anchor accounts into ParsedLoan[]
export function parseLoanAccounts(allAccounts: any[]): ParsedLoan[] {
  return allAccounts.map((acc: any) =>
    parseLoanAccount(acc.publicKey, acc.account)
  )
}

/** Format duration in seconds into a human-readable string (e.g. "30 days", "2h", "5min") */
export function formatDuration(seconds: number): string {
  const days = seconds / 86400
  if (days >= 1) return `${Math.round(days)} days`
  const hours = seconds / 3600
  if (hours >= 1) return `${Math.round(hours)}h`
  return `${Math.round(seconds / 60)}min`
}

/**
 * Calculate the total interest owed for a loan, matching the on-chain formula exactly.
 * On-chain: interest = debt_amount * apy * duration / APY_DIVISOR
 * where APY_DIVISOR = 100 * 365 * 86400 = 3,153,600,000
 *
 * Note: The on-chain program charges FULL-TERM interest regardless of when
 * you repay. Early repayment still owes the full term's interest.
 */
export function calculateInterest(loan: ParsedLoan): number {
  const APY_DIVISOR = 100 * 365 * 86400 // 3,153,600,000
  return loan.debtAmountUi * loan.apy * loan.duration / APY_DIVISOR
}

/**
 * Calculate the total amount the borrower needs in their wallet for full repayment.
 * This is principal + interest, used for BALANCE CHECKS only.
 *
 * The actual repay_amount parameter sent to the on-chain program must be
 * <= loan.debtAmountUi (the remaining principal). The program adds interest
 * internally when closing the loan.
 */
export function calculateFullRepayAmount(loan: ParsedLoan): number {
  const interest = calculateInterest(loan)
  return loan.debtAmountUi + interest
}

export function getStatusLabel(status: LoanStatus): string {
  switch (status) {
    case LoanStatus.Pending: return 'Pending'
    case LoanStatus.Accepted: return 'Active'
    case LoanStatus.Rescinded: return 'Rescinded'
    case LoanStatus.Repaid: return 'Repaid'
    case LoanStatus.Foreclosed: return 'Foreclosed'
    case LoanStatus.Liquidated: return 'Liquidated'
    default: return 'Unknown'
  }
}
