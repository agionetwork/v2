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
  /** Agent won't accept loans whose initial health factor is below this
   *  (e.g. 1.30). Health factor = collateral_value / debt_total. */
  lendMinHealthFactor: number
  /** Agent won't accept loans whose modelled liquidation probability (%)
   *  exceeds this, e.g. 25. */
  lendMaxAcceptableLiquidationProb: number
  lendAutoForeclose: boolean
  lendAutoAcceptOffers: boolean
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
  /** Auto-repay closes a loan when it's within this many hours of expiry. */
  borrowRepayBeforeHours: number
  /** Watches active loans and tops up collateral if the ratio drops. */
  borrowAutoTopUpCollateral: boolean
  /** Trigger when the collateral ratio falls below this %. Default 135 (above
   *  the protocol's 120 % foreclosure floor with a buffer). */
  borrowTopUpThresholdRatio: number
  /** Health-factor level that triggers auto-add-collateral (must be > 1.15,
   *  i.e. above the warning zone). Default 1.20. */
  borrowAddCollateralThreshold: number
  /** If true, the agent repays automatically when a loan enters the
   *  warning zone (health factor < 1.15) instead of waiting for expiry. */
  borrowAutoRepayOnWarning: boolean
  /** Health zone the agent targets when creating borrow requests. */
  borrowTargetZone: "green" | "yellow" | "orange"
  /** If modelled liquidation probability (%) exceeds this, the agent
   *  auto-partial-repays to de-risk. e.g. 40. */
  borrowAutoPartialRepayThreshold: number
  /** How much of the remaining principal to pay down on an auto partial
   *  repay (percentage, e.g. 25 = 25%). */
  borrowPartialRepayPercent: number
  borrowAutoAcceptOffers: boolean
  borrowAutoCreateRequests: boolean

  // Jupiter swap settings
  swapEnabled: boolean
  swapSlippageBps: number // basis points (e.g. 50 = 0.5%)
  swapAutoRebalance: boolean // auto-swap before lending if insufficient balance

  // Social settings
  socialAutoAcceptFriends: boolean

  // Privacy (Cloak ZK lending)
  privacyEnabled: boolean
  privacyMode: PrivacyMode
}

/** Per-loan privacy default for autonomous agents.
 *  - "always": every loan the agent creates/accepts is routed through Cloak.
 *  - "ask":    agent prompts the user before each privacy decision (manual mode only).
 *  - "never":  standard public flow, no ZK overhead. */
export type PrivacyMode = "always" | "ask" | "never"

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
  lendMinHealthFactor: 1.3,
  lendMaxAcceptableLiquidationProb: 25,
  lendAutoForeclose: true,
  lendAutoAcceptOffers: true,
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
  borrowRepayBeforeHours: 1,
  borrowAutoTopUpCollateral: false,
  borrowTopUpThresholdRatio: 135,
  borrowAddCollateralThreshold: 1.2,
  borrowAutoRepayOnWarning: false,
  borrowTargetZone: "yellow",
  borrowAutoPartialRepayThreshold: 40,
  borrowPartialRepayPercent: 25,
  borrowAutoAcceptOffers: true,
  borrowAutoCreateRequests: false,

  swapEnabled: false,
  swapSlippageBps: 50,
  swapAutoRebalance: false,

  socialAutoAcceptFriends: true,

  privacyEnabled: false,
  privacyMode: "never",
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
