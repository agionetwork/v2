export type TokenType = "SOL" | "USDC" | "USDT" | "mSOL"
export type OperationType = "LEND" | "BORROW"
export type FeedbackType = "success" | "error" | "info" | null
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"

export interface TokenInfo {
  symbol: TokenType
  name: string
  decimals: number
  icon: string
}

export interface FeedbackState {
  type: FeedbackType
  message: string | null
}

export interface LoanFormData {
  loanAmount: number
  loanTerm: number
  apy: number
  token: TokenType
  tokenCollateral: TokenType
  collateralAmount: number
  receiverAddress: string
  operationType: OperationType
}

export interface LoanSummary {
  totalRepayment: number
  interest: number
  dailyInterest: number
}

export interface LoanFormState extends LoanFormData {
  isLoading: boolean
  isSuccess: boolean
  errors: Record<string, string>
}

export interface TokenBalance {
  symbol: string
  balance: number
  usdValue: number
  percentOfTotal: number
}

export interface Badge {
  title: string
  description: string
  variant: BadgeVariant
  className: string
}

export const TOKEN_LIST: Record<TokenType, TokenInfo> = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    icon: "solana"
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "usdc"
  },
  USDT: {
    symbol: "USDT",
    name: "Tether",
    decimals: 6,
    icon: "usdt"
  },
  mSOL: {
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    decimals: 9,
    icon: "msol"
  }
}

export const INITIAL_FORM_STATE: LoanFormState = {
  loanAmount: 1000,
  loanTerm: 30,
  apy: 5,
  token: "SOL",
  tokenCollateral: "USDC",
  collateralAmount: 1000,
  receiverAddress: "",
  operationType: "LEND",
  isLoading: false,
  isSuccess: false,
  errors: {}
}

export const calculateLoanSummary = (data: LoanFormData): LoanSummary => {
  const totalRepayment = data.loanAmount * (1 + (data.apy / 100) * (data.loanTerm / 365))
  const interest = totalRepayment - data.loanAmount
  const dailyInterest = (data.apy / 100) * data.loanAmount / 365

  return {
    totalRepayment,
    interest,
    dailyInterest
  }
} 