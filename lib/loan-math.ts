/**
 * Shared loan-safety math. Mirrors `agio-program/programs/agio/src/utils/safety.rs`
 * so the frontend's slider clamps and the on-chain validation never disagree.
 *
 * The single constraint:
 *
 *   collateral_value_usd ≥ LIQUIDATION_THRESHOLD × principal_usd × (1 + apy_decimal × duration_years)
 *
 * Everything else in this file is a rearrangement of that inequality.
 */

// 1.25 = 125% collateral/debt = LTV 80%. Matches DEFAULT_LIQUIDATION_THRESHOLD_BPS
// in the Anchor program (12_500). Vaults created before the bump may still hold
// 12_000 on-chain until an admin runs update_liquidation_threshold; the form's
// safety hint will be slightly stricter than the deployed reality in that window.
export const LIQUIDATION_THRESHOLD = 1.25
export const SECONDS_PER_YEAR = 31_536_000

// Protocol-wide APY ceiling. The on-chain `apy` field is u8, and the form
// caps user input at this value. Keep aligned with `DEFAULT_MAX_APY` in the
// Anchor program (currently 200 there for legacy reasons; product cap is 30).
export const MAX_APY_PCT = 30
export const MAX_APY_BPS = MAX_APY_PCT * 100

// Boundaries used by RiskZoneBar to color the meter.
// Ratio = collateral_value / max_debt_at_maturity.
export const RATIO_LIQUIDATION = LIQUIDATION_THRESHOLD // ≤ 1.2 → red
export const RATIO_STRESSED = 1.5 // 1.2–1.5 → yellow, > 1.5 → green

export function maxDebtUsd(
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): number {
  const apyDecimal = apyBps / 10_000
  const durationYears = durationSeconds / SECONDS_PER_YEAR
  return principalUsd * (1 + apyDecimal * durationYears)
}

export function minCollateralUsd(
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): number {
  return LIQUIDATION_THRESHOLD * maxDebtUsd(principalUsd, apyBps, durationSeconds)
}

export function isLoanSafe(
  collateralValueUsd: number,
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): boolean {
  if (principalUsd <= 0 || durationSeconds <= 0 || apyBps < 0) return false
  return collateralValueUsd >= minCollateralUsd(principalUsd, apyBps, durationSeconds)
}

/**
 * Largest APY (in bps) that keeps the loan safe given the chosen collateral
 * and duration. Returns 0 if even APY=0 would already be unsafe (i.e. the
 * collateral is below 1.2× the principal).
 */
export function maxApyBps(
  collateralValueUsd: number,
  principalUsd: number,
  durationSeconds: number,
): number {
  if (principalUsd <= 0 || durationSeconds <= 0) return 0
  const ratio = collateralValueUsd / (LIQUIDATION_THRESHOLD * principalUsd) - 1
  if (ratio <= 0) return 0
  const bps = Math.floor((ratio * 10_000 * SECONDS_PER_YEAR) / durationSeconds)
  return Math.min(bps, MAX_APY_BPS)
}

/**
 * Smallest collateral value (USD) that keeps the loan safe. Same as
 * `minCollateralUsd` but named for the slider's "snap up" path.
 */
export function minSafeCollateralUsd(
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): number {
  return minCollateralUsd(principalUsd, apyBps, durationSeconds)
}

/**
 * The % drop in collateral price that would push the loan over the
 * liquidation line. 0 means the loan is already at/under the line.
 */
export function worstCasePriceDropPct(
  collateralValueUsd: number,
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): number {
  if (collateralValueUsd <= 0) return 0
  const minNeeded = minCollateralUsd(principalUsd, apyBps, durationSeconds)
  return Math.max(0, (1 - minNeeded / collateralValueUsd) * 100)
}

/**
 * collateral / max_debt — the raw collateralization ratio at maturity.
 * RiskZoneBar uses this against RATIO_LIQUIDATION / RATIO_STRESSED.
 */
export function safetyRatio(
  collateralValueUsd: number,
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): number {
  const debt = maxDebtUsd(principalUsd, apyBps, durationSeconds)
  if (debt <= 0) return 0
  return collateralValueUsd / debt
}

export type SafetyZone = "safe" | "stressed" | "liquidation"

export function safetyZone(ratio: number): SafetyZone {
  if (ratio < RATIO_LIQUIDATION) return "liquidation"
  if (ratio < RATIO_STRESSED) return "stressed"
  return "safe"
}

/**
 * Default + minimum collateral percentages per token category. Used to seed
 * the form when the user picks a collateral token. The dynamic safety check
 * still governs — these are just sensible starting points, not guarantees
 * (a 105% USDC default is unsafe at high APY/duration combos).
 *
 * `agioSOL` from the spec is just a display alias for `bSOL`, so the entry
 * lives under the on-chain symbol. `xStock` doesn't exist in the protocol
 * yet and was dropped.
 */
export const COLLATERAL_PRESETS: Record<
  string,
  { defaultCollateralPct: number; minCollateralPct: number }
> = {
  USDC: { defaultCollateralPct: 110, minCollateralPct: 105 },
  EURC: { defaultCollateralPct: 115, minCollateralPct: 105 },
  bSOL: { defaultCollateralPct: 125, minCollateralPct: 120 },
  SOL: { defaultCollateralPct: 150, minCollateralPct: 130 },
}

export function getCollateralPreset(
  symbol: string,
): { defaultCollateralPct: number; minCollateralPct: number } {
  return COLLATERAL_PRESETS[symbol] ?? { defaultCollateralPct: 200, minCollateralPct: 180 }
}
