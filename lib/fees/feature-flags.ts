/**
 * Pricing v2 feature flags.
 *
 * Environment variable PRICING_VERSION controls which fee model is active:
 *   "2" (default) → proportional fees (v2)
 *   "1"           → legacy flat fees (v1 — backward compat)
 *
 * This allows gradual rollout and instant rollback without code changes.
 */

export function getPricingVersion(): 1 | 2 {
  const v = process.env.PRICING_VERSION
  if (v === "1") return 1
  return 2 // Default to v2
}

export function isProportionalPricingEnabled(): boolean {
  return getPricingVersion() === 2
}
