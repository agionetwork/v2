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

// Separated loan-safety thresholds (game-theory compliant).
//   CREATION    (1.25 / 125%) — minimum collateral to open a loan
//   WARNING     (1.15 / 115%) — suggest add-collateral
//   FORECLOSURE (1.10 / 110%) — liquidatable
// All ratios are collateral_value_usd / debt_total_usd.
export const CREATION_THRESHOLD = 1.25
export const WARNING_THRESHOLD = 1.15
export const FORECLOSURE_THRESHOLD = 1.1

// On foreclosure the collateral is swapped to the debt token and split:
// lender gets the debt, protocol takes a 5% fee, borrower keeps the rest.
// The swap reverts if Jupiter slippage exceeds 5%.
export const LIQUIDATION_FEE_BPS = 500
export const MAX_SWAP_SLIPPAGE_BPS = 500

// Back-compat: `LIQUIDATION_THRESHOLD` historically meant the creation floor
// (minCollateralUsd uses it). Keep it pinned to the creation threshold so the
// existing math and tests stay numerically identical.
export const LIQUIDATION_THRESHOLD = CREATION_THRESHOLD
export const SECONDS_PER_YEAR = 31_536_000

// Protocol-wide APY ceiling. The on-chain `apy` field is u8, and the form
// caps user input at this value. Keep aligned with `DEFAULT_MAX_APY` in the
// Anchor program (currently 200 there for legacy reasons; product cap is 30).
export const MAX_APY_PCT = 30
export const MAX_APY_BPS = MAX_APY_PCT * 100

// Boundaries used by RiskZoneBar to color the meter.
// Ratio = collateral_value / max_debt_at_maturity.
export const RATIO_LIQUIDATION = FORECLOSURE_THRESHOLD // < 1.10 → red
export const RATIO_WARNING = WARNING_THRESHOLD // 1.10–1.15 → orange
export const RATIO_CREATION = CREATION_THRESHOLD // 1.15–1.25 → yellow, ≥ 1.25 → green
// Deprecated alias kept so older importers/tests keep compiling.
export const RATIO_STRESSED = 1.5

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

/**
 * @deprecated Three-state zone tied to the old single-threshold model.
 * Use {@link healthZone} for the 125/115/110 model. Kept for back-compat.
 */
export function safetyZone(ratio: number): SafetyZone {
  if (ratio < RATIO_STRESSED && ratio >= CREATION_THRESHOLD) return "stressed"
  if (ratio < CREATION_THRESHOLD) return "liquidation"
  return "safe"
}

export type HealthZone = "green" | "yellow" | "orange" | "red"

/**
 * Health factor = collateral_value_usd / debt_total_usd.
 * `debtTotalUsd` is principal + interest accrued for the period.
 */
export function healthFactor(collateralValueUsd: number, debtTotalUsd: number): number {
  if (debtTotalUsd <= 0) return 0
  return collateralValueUsd / debtTotalUsd
}

/**
 * green  ≥ 1.25 (healthy, can create)
 * yellow ≥ 1.15 (warning, suggest add-collateral)
 * orange ≥ 1.10 (danger, approaching liquidation)
 * red    < 1.10 (liquidatable)
 */
export function healthZone(hf: number): HealthZone {
  if (hf >= CREATION_THRESHOLD) return "green"
  if (hf >= WARNING_THRESHOLD) return "yellow"
  if (hf >= FORECLOSURE_THRESHOLD) return "orange"
  return "red"
}

/**
 * % drop in collateral price that brings the loan down to `thresholdRatio`
 * of its total debt. 0 means it's already at/under that line.
 */
export function calculateDropToThreshold(
  collateralValueUsd: number,
  debtTotalUsd: number,
  thresholdRatio: number,
): number {
  if (collateralValueUsd <= 0) return 0
  const thresholdValue = debtTotalUsd * thresholdRatio
  if (collateralValueUsd <= thresholdValue) return 0
  return ((collateralValueUsd - thresholdValue) / collateralValueUsd) * 100
}

/** % collateral-price drop until the loan enters the WARNING zone (115%). */
export function priceDropToWarning(
  collateralValueUsd: number,
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): number {
  return calculateDropToThreshold(
    collateralValueUsd,
    maxDebtUsd(principalUsd, apyBps, durationSeconds),
    WARNING_THRESHOLD,
  )
}

/** % collateral-price drop until the loan becomes FORECLOSABLE (110%). */
export function priceDropToForeclosure(
  collateralValueUsd: number,
  principalUsd: number,
  apyBps: number,
  durationSeconds: number,
): number {
  return calculateDropToThreshold(
    collateralValueUsd,
    maxDebtUsd(principalUsd, apyBps, durationSeconds),
    FORECLOSURE_THRESHOLD,
  )
}

/**
 * Estimated foreclosure distribution given the USD value recovered from
 * swapping the collateral. lender ≤ debt_total (never profits); protocol
 * takes up to 5% of debt from the excess; borrower keeps the remainder.
 */
export function foreclosureDistribution(
  swapProceedsUsd: number,
  debtTotalUsd: number,
): { lender: number; protocol: number; borrower: number } {
  const lender = Math.min(swapProceedsUsd, debtTotalUsd)
  const feeCap = (debtTotalUsd * LIQUIDATION_FEE_BPS) / 10_000
  const protocol = Math.min(feeCap, Math.max(0, swapProceedsUsd - lender))
  const borrower = Math.max(0, swapProceedsUsd - lender - protocol)
  return { lender, protocol, borrower }
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
