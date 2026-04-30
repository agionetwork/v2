// Consolidated security constants - use constants/security.ts instead
// This file is deprecated and will be removed in future versions
export const LOAN_LIMITS = {
  MIN_AMOUNT: 100,
  MAX_AMOUNT: 1000000,
  MIN_TERM: 1,
  MAX_TERM: 365,
  MIN_APY: 0.1,
  MAX_APY: 100,
  MIN_COLLATERAL_RATIO: 110, // 110% minimum collateral
  MAX_COLLATERAL_RATIO: 1000, // 1000% maximum collateral
}

export const RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 60,
  COOLDOWN_PERIOD_MS: 1000, // 1 second between form submissions
}

// DEPRECATED: Use constants/security.ts instead
export const SECURITY_CONSTANTS = {
  MAX_DECIMALS: 8,
  ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/,
  SAFE_NUMBER_REGEX: /^\d*\.?\d*$/,
  MAX_INPUT_LENGTH: 256,
}

export const ERROR_MESSAGES = {
  AMOUNT_TOO_LOW: `Loan amount must be at least ${LOAN_LIMITS.MIN_AMOUNT}`,
  AMOUNT_TOO_HIGH: `Loan amount cannot exceed ${LOAN_LIMITS.MAX_AMOUNT}`,
  TERM_TOO_SHORT: `Loan term must be at least ${LOAN_LIMITS.MIN_TERM} day`,
  TERM_TOO_LONG: `Loan term cannot exceed ${LOAN_LIMITS.MAX_TERM} days`,
  APY_TOO_LOW: `APY must be at least ${LOAN_LIMITS.MIN_APY}%`,
  APY_TOO_HIGH: `APY cannot exceed ${LOAN_LIMITS.MAX_APY}%`,
  COLLATERAL_TOO_LOW: "Insufficient collateral ratio",
  INVALID_ADDRESS: "Invalid wallet address format",
  INVALID_NUMBER: "Please enter a valid number",
  RATE_LIMIT: "Too many requests. Please try again later",
  INVALID_TOKEN: "Invalid token selection",
  SYSTEM_ERROR: "System error. Please try again later",
  INSUFFICIENT_BALANCE: "Insufficient balance for this operation",
  SESSION_EXPIRED: "Session expired. Please refresh the page",
} 