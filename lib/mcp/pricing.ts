import { getRedis, isRedisConfigured } from "@/lib/agent/redis"
import { isFreeOperation, calculateFee, FEE_CONFIG } from "@/lib/fees/fee-calculator"
import { isProportionalPricingEnabled } from "@/lib/fees/feature-flags"

export { isFreeOperation, calculateFee, FEE_CONFIG }
export { convertToUsd, getTokenPriceUsd } from "@/lib/fees/price-oracle"
export { isProportionalPricingEnabled, getPricingVersion } from "@/lib/fees/feature-flags"

/**
 * MCP tool pricing configuration — v2 (proportional fees).
 *
 * Most operations are now FREE. Fees only apply to value-generating
 * operations (lending, settlement, swap) and are proportional to volume.
 * See lib/fees/fee-calculator.ts for the canonical fee configuration.
 *
 * DEFAULT_PRICES below serve as the v2 lookup table.
 * V1_PRICES is the legacy flat-fee fallback (activated via PRICING_VERSION=1).
 * Actual fees for proportional tools are computed via calculateFee().
 * Prices can still be overridden at runtime via Redis.
 */

/** v1 legacy flat prices (for PRICING_VERSION=1 rollback) */
const V1_PRICES: Record<string, number> = {
  "create-profile": 0.005,
  "update-profile": 0.005,
  "create-agent": 0.05,
  "configure-agent": 0.005,
  "activate-agent": 0.005,
  "deactivate-agent": 0.005,
  "run-agent-cycle": 0.01,
  "withdraw-funds": 0.005,
  "create-lend-offer": 0.01,
  "create-borrow-request": 0.01,
  "accept-lend-offer": 0.01,
  "accept-borrow-request": 0.01,
  "repay-loan": 0.01,
  "foreclose-loan": 0.01,
  "swap-tokens": 0.01,
  "rescind-offer": 0.005,
  "add-collateral": 0.005,
  "follow-user": 0.005,
  "unfollow-user": 0.005,
  "send-friend-request": 0.005,
  "respond-friend-request": 0.005,
  "post-activity": 0.005,
  "batch-execute": 0,
}

const DEFAULT_PRICES: Record<string, number> = {
  // --- FREE operations (v2: scan, onboard, config, social, risk mgmt) ---
  "list-loans": 0,
  "get-loan": 0,
  "get-agent-status": 0,
  "get-agent-history": 0,
  "get-leaderboard": 0,
  "get-profile": 0,
  "get-platform-info": 0,
  "get-activity-feed": 0,
  "get-payment-history": 0,
  "get-events": 0,
  "fund-agent-wallet": 0,
  "devnet-airdrop": 0,
  "devnet-token-faucet": 0,

  // v2: Now free (previously paid)
  "create-profile": 0,
  "update-profile": 0,
  "configure-agent": 0,
  "activate-agent": 0,
  "deactivate-agent": 0,
  "run-agent-cycle": 0,
  "withdraw-funds": 0,
  "rescind-offer": 0,
  "add-collateral": 0,
  "follow-user": 0,
  "unfollow-user": 0,
  "send-friend-request": 0,
  "respond-friend-request": 0,
  "post-activity": 0,

  // --- PAID operations (v2: proportional or flat) ---
  // Placeholder values for legacy compat. Real fees computed by calculateFee().
  "create-agent": 0.10,         // flat $0.10
  "create-lend-offer": 0,       // proportional (0.1% of debtAmount)
  "create-borrow-request": 0,   // proportional (0.1% of debtAmount)
  "accept-lend-offer": 0,       // proportional (0.1% of debtAmount)
  "accept-borrow-request": 0,   // proportional (0.1% of debtAmount)
  "repay-loan": 0,              // proportional (0.05% of amount)
  "foreclose-loan": 0,          // proportional (0.05% of collateral)
  "swap-tokens": 0,             // proportional (0.05% of amount)

  // Batch (computed at runtime with 10% discount)
  "batch-execute": 0,
}

export type ToolName = keyof typeof DEFAULT_PRICES

/**
 * Get the static/flat price for a tool. Checks Redis override first.
 *
 * v2 (default): proportional tools return 0 here — actual fee computed by calculateFee().
 * v1 (PRICING_VERSION=1): returns legacy flat prices for all tools.
 */
export async function getToolPrice(name: string): Promise<number> {
  if (isRedisConfigured()) {
    try {
      const override = await getRedis().get<number>(`mcp:pricing:${name}`)
      if (override !== null && override !== undefined) return override
    } catch {
      // Fall through to default
    }
  }
  const prices = isProportionalPricingEnabled() ? DEFAULT_PRICES : V1_PRICES
  return prices[name] ?? 0
}

/**
 * Set a dynamic price override for a tool (persisted in Redis).
 */
export async function setToolPrice(name: string, price: number): Promise<void> {
  await getRedis().set(`mcp:pricing:${name}`, price)
}

/**
 * Check if a tool requires payment.
 * Uses the fee-calculator (not just static price) to determine this.
 */
export async function isPaidTool(name: string): Promise<boolean> {
  // Tools in FEE_CONFIG with type != 'free' are paid
  if (!isFreeOperation(name)) return true
  // Also check static price for backward compat / Redis overrides
  return (await getToolPrice(name)) > 0
}

/**
 * Get all tool prices (defaults merged with any Redis overrides).
 * For display purposes — proportional tools show 0 here.
 */
export async function getAllPrices(): Promise<Record<string, number>> {
  const prices = { ...DEFAULT_PRICES }
  if (isRedisConfigured()) {
    try {
      const redis = getRedis()
      for (const name of Object.keys(DEFAULT_PRICES)) {
        const override = await redis.get<number>(`mcp:pricing:${name}`)
        if (override !== null && override !== undefined) {
          prices[name] = override
        }
      }
    } catch {
      // Use defaults
    }
  }
  return prices
}
