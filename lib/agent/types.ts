// Solana CAIP-2 chain identifier for Privy
export const SOLANA_CAIP2 = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" // devnet
// For mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"

export const VALID_TOKENS = ["USDC", "EURC", "SOL"] as const
export type ValidToken = (typeof VALID_TOKENS)[number]

export interface AgentConfig {
  enabled: boolean
  createdAt: string

  // Lending (agent lends funds)
  lendEnabled: boolean
  lendTokens: string[]
  lendMinApy: number
  lendMinAmountUsd: number // min loan amount in USD
  lendMaxAmountUsd: number // max loan amount in USD
  lendMaxDuration: number // days
  lendAcceptedCollateral: string[]
  lendMinCollateralRatio: number // percentage (e.g. 150 = 150%)
  lendMaxCollateralRatio: number // percentage (e.g. 300 = 300%)
  lendAutoForeclose: boolean
  lendAutoCreateOffers: boolean

  // Borrowing (agent borrows funds)
  borrowEnabled: boolean
  borrowTokens: string[]
  borrowMaxApy: number
  borrowMinAmountUsd: number // min loan amount in USD
  borrowMaxAmountUsd: number // max loan amount in USD
  borrowCollateralTokens: string[]
  borrowMinCollateralRatio: number // percentage
  borrowMaxCollateralRatio: number // percentage
  borrowMaxDuration: number // days
  borrowAutoRepay: boolean
  borrowAutoCreateRequests: boolean

  // Jupiter swap settings
  swapEnabled: boolean
  swapSlippageBps: number // basis points (e.g. 50 = 0.5%)
  swapAutoRebalance: boolean // auto-swap before lending if insufficient balance

  // Social settings
  socialAutoAcceptFriends: boolean
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  createdAt: "",

  lendEnabled: false,
  lendTokens: ["USDC"],
  lendMinApy: 5,
  lendMinAmountUsd: 100,
  lendMaxAmountUsd: 5000,
  lendMaxDuration: 30,
  lendAcceptedCollateral: ["SOL"],
  lendMinCollateralRatio: 150,
  lendMaxCollateralRatio: 300,
  lendAutoForeclose: true,
  lendAutoCreateOffers: false,

  borrowEnabled: false,
  borrowTokens: ["USDC"],
  borrowMaxApy: 15,
  borrowMinAmountUsd: 50,
  borrowMaxAmountUsd: 2000,
  borrowCollateralTokens: ["SOL"],
  borrowMinCollateralRatio: 150,
  borrowMaxCollateralRatio: 250,
  borrowMaxDuration: 30,
  borrowAutoRepay: true,
  borrowAutoCreateRequests: false,

  swapEnabled: false,
  swapSlippageBps: 50,
  swapAutoRebalance: false,

  socialAutoAcceptFriends: true,
}

export type AgentActionType =
  | "accepted_borrow_request"
  | "accepted_lend_offer"
  | "created_lend_offer"
  | "created_borrow_request"
  | "rescinded_offer"
  | "foreclosed_loan"
  | "repaid_loan"
  | "swapped_tokens"
  | "accepted_friend_request"
  | "airdrop"
  | "scan"
  | "error"

export interface AgentAction {
  timestamp: string
  type: AgentActionType
  details: string
  txHash: string | null
  status: "success" | "error"
}

export const MAX_HISTORY_ENTRIES = 200

// Redis key helpers
export function agentKey(userWallet: string, suffix: string): string {
  return `agent:${userWallet}:${suffix}`
}

export const AGENTS_ACTIVE_SET = "agents:active"
