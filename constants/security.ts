export const SECURITY_CONSTANTS = {
  MIN_LOAN_AMOUNT: 1,
  MAX_LOAN_AMOUNT: 1_000_000,
  MIN_LOAN_TERM: 1,
  MAX_LOAN_TERM: 365,
  MIN_APY: 0,
  MAX_APY: 100,
  MIN_COLLATERAL_RATIO: 100, // 100%
  MAX_COLLATERAL_RATIO: 1000, // 1000%
  RATE_LIMIT_REQUESTS: 10,
  RATE_LIMIT_WINDOW_MS: 60_000, // 1 minute
}

export const WALLET_REGEX = {
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
}

export const validateSolanaAddress = (address: string): boolean => {
  if (!WALLET_REGEX.SOL.test(address)) return false;
  if (address.length < 32 || address.length > 44) return false;
  return true;
}

export const ERROR_MESSAGES = {
  INVALID_AMOUNT: "Invalid amount. Please enter a value between {min} and {max}",
  INVALID_TERM: "Invalid term. Please enter a value between {min} and {max} days",
  INVALID_APY: "Invalid APY. Please enter a value between {min}% and {max}%",
  INVALID_WALLET: "Invalid wallet address format",
  INSUFFICIENT_COLLATERAL: "Collateral ratio must be at least {min}%",
  EXCESSIVE_COLLATERAL: "Collateral ratio cannot exceed {max}%",
  RATE_LIMIT: "Too many requests. Please try again in a moment",
  UNAUTHORIZED: "Unauthorized access",
  INVALID_SIGNATURE: "Invalid transaction signature",
  NETWORK_ERROR: "Network error. Please check your connection",
}

export const sanitizeInput = (input: string): string => {
  return input.replace(/[<>]/g, "")
}

export const validateWalletAddress = (address: string): boolean => {
  return WALLET_REGEX.SOL.test(address)
}

export const validateCollateralRatio = (
  loanAmount: number,
  collateralAmount: number,
  collateralPrice: number
): boolean => {
  const ratio = (collateralAmount * collateralPrice / loanAmount) * 100
  return ratio >= SECURITY_CONSTANTS.MIN_COLLATERAL_RATIO && 
         ratio <= SECURITY_CONSTANTS.MAX_COLLATERAL_RATIO
}

export const formatErrorMessage = (message: string, params: Record<string, string | number>): string => {
  return message.replace(/{(\w+)}/g, (_, key) => String(params[key] || ""))
} 