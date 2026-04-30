import { SECURITY_CONSTANTS, LOAN_LIMITS } from "@/constants/validation"
import { TokenType, LoanFormData } from "@/types/loan"

export function sanitizeNumber(value: string): number {
  if (!SECURITY_CONSTANTS.SAFE_NUMBER_REGEX.test(value)) {
    return 0
  }
  const num = parseFloat(value)
  return isNaN(num) ? 0 : Number(num.toFixed(SECURITY_CONSTANTS.MAX_DECIMALS))
}

export function sanitizeAddress(address: string): string {
  return address.trim().toLowerCase()
}

export function validateAddress(address: string): boolean {
  return SECURITY_CONSTANTS.ADDRESS_REGEX.test(address)
}

export function validateCollateralRatio(loanAmount: number, collateralAmount: number): boolean {
  const ratio = (collateralAmount / loanAmount) * 100
  return ratio >= LOAN_LIMITS.MIN_COLLATERAL_RATIO && ratio <= LOAN_LIMITS.MAX_COLLATERAL_RATIO
}

export function validateTokenPair(token: TokenType, collateralToken: TokenType): boolean {
  // Implement token pair validation logic here
  // For example, preventing certain token combinations
  if (token === collateralToken) return true
  
  const validPairs: Record<TokenType, TokenType[]> = {
    SOL: ["USDC", "USDT", "mSOL"],
    USDC: ["SOL", "mSOL"],
    USDT: ["SOL", "mSOL"],
    mSOL: ["SOL", "USDC", "USDT"]
  }
  
  return validPairs[token].includes(collateralToken)
}

export function validateInput(value: string): boolean {
  return value.length <= SECURITY_CONSTANTS.MAX_INPUT_LENGTH &&
         !value.includes("<") &&
         !value.includes(">") &&
         !value.includes("script")
}

let lastRequestTimestamp = 0
export function checkRateLimit(): boolean {
  const now = Date.now()
  if (now - lastRequestTimestamp < LOAN_LIMITS.MIN_TERM) {
    return false
  }
  lastRequestTimestamp = now
  return true
}

export function validateLoanParameters(data: LoanFormData): boolean {
  return data.loanAmount >= LOAN_LIMITS.MIN_AMOUNT &&
         data.loanAmount <= LOAN_LIMITS.MAX_AMOUNT &&
         data.loanTerm >= LOAN_LIMITS.MIN_TERM &&
         data.loanTerm <= LOAN_LIMITS.MAX_TERM &&
         data.apy >= LOAN_LIMITS.MIN_APY &&
         data.apy <= LOAN_LIMITS.MAX_APY &&
         validateCollateralRatio(data.loanAmount, data.collateralAmount) &&
         validateTokenPair(data.token, data.tokenCollateral) &&
         validateAddress(data.receiverAddress)
} 