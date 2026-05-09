import {
  LIQUIDATION_THRESHOLD,
  SECONDS_PER_YEAR,
  MAX_APY_BPS,
  maxDebtUsd,
  minCollateralUsd,
  isLoanSafe,
  maxApyBps,
  worstCasePriceDropPct,
  safetyRatio,
  safetyZone,
  COLLATERAL_PRESETS,
  getCollateralPreset,
} from '../loan-math'

const DAY = 86_400
const YEAR = SECONDS_PER_YEAR

describe('maxDebtUsd', () => {
  test('zero APY → just the principal', () => {
    expect(maxDebtUsd(1000, 0, 30 * DAY)).toBeCloseTo(1000, 6)
  })

  test('5% APY for 1 year → principal × 1.05', () => {
    expect(maxDebtUsd(1000, 500, YEAR)).toBeCloseTo(1050, 6)
  })

  test('30% APY for 30 days → principal × (1 + 0.3 × 30/365)', () => {
    expect(maxDebtUsd(1000, 3000, 30 * DAY)).toBeCloseTo(1000 * (1 + 0.3 * (30 / 365)), 4)
  })
})

describe('minCollateralUsd', () => {
  test('zero APY → 1.2× principal exactly', () => {
    expect(minCollateralUsd(1000, 0, 30 * DAY)).toBeCloseTo(1200, 6)
  })

  test('5% APY 1 year → 1.2 × 1050 = 1260', () => {
    expect(minCollateralUsd(1000, 500, YEAR)).toBeCloseTo(1260, 6)
  })
})

describe('isLoanSafe', () => {
  test('150 USDC collateral, 100 USDC principal, 20% APY, 30 days → safe', () => {
    expect(isLoanSafe(150, 100, 2000, 30 * DAY)).toBe(true)
  })

  test('exactly at threshold → safe', () => {
    const principal = 100
    const apyBps = 1000 // 10%
    const duration = 90 * DAY
    const min = minCollateralUsd(principal, apyBps, duration)
    expect(isLoanSafe(min, principal, apyBps, duration)).toBe(true)
  })

  test('one cent below threshold → unsafe', () => {
    const principal = 100
    const apyBps = 1000
    const duration = 90 * DAY
    const min = minCollateralUsd(principal, apyBps, duration)
    expect(isLoanSafe(min - 0.01, principal, apyBps, duration)).toBe(false)
  })

  test('zero principal → unsafe', () => {
    expect(isLoanSafe(1000, 0, 500, 30 * DAY)).toBe(false)
  })

  test('zero duration → unsafe', () => {
    expect(isLoanSafe(1000, 100, 500, 0)).toBe(false)
  })
})

describe('maxApyBps', () => {
  test('collateral exactly 1.2× principal → max APY = 0', () => {
    expect(maxApyBps(120, 100, 30 * DAY)).toBe(0)
  })

  test('collateral below 1.2× principal → max APY = 0 (already unsafe)', () => {
    expect(maxApyBps(100, 100, 30 * DAY)).toBe(0)
  })

  test('150 collateral, 100 principal, 1 year → ~25% APY', () => {
    // 150 = 1.2 × 100 × (1 + apy × 1) → apy = 0.25
    expect(maxApyBps(150, 100, YEAR)).toBe(2500)
  })

  test('caps at MAX_APY_BPS regardless of how generous the math allows', () => {
    // 10× collateral, 1 day → math says huge APY, but cap kicks in
    expect(maxApyBps(1000, 100, DAY)).toBe(MAX_APY_BPS)
  })

  test('round-trip: maxApyBps result is still safe (no off-by-one)', () => {
    const collateral = 200
    const principal = 100
    const duration = 60 * DAY
    const apyBps = maxApyBps(collateral, principal, duration)
    expect(isLoanSafe(collateral, principal, apyBps, duration)).toBe(true)
  })
})

describe('worstCasePriceDropPct', () => {
  test('exactly at threshold → 0% headroom', () => {
    const min = minCollateralUsd(100, 0, 30 * DAY)
    expect(worstCasePriceDropPct(min, 100, 0, 30 * DAY)).toBeCloseTo(0, 6)
  })

  test('2× the minimum → 50% drop tolerated', () => {
    const min = minCollateralUsd(100, 0, 30 * DAY)
    expect(worstCasePriceDropPct(min * 2, 100, 0, 30 * DAY)).toBeCloseTo(50, 4)
  })

  test('already below threshold → 0', () => {
    expect(worstCasePriceDropPct(50, 100, 0, 30 * DAY)).toBe(0)
  })
})

describe('safetyRatio + safetyZone', () => {
  test('ratio = collateral / max_debt', () => {
    // 150 collateral, 100 principal, 0% APY → debt = 100, ratio = 1.5
    expect(safetyRatio(150, 100, 0, 30 * DAY)).toBeCloseTo(1.5, 6)
  })

  test('ratio < 1.2 → liquidation zone', () => {
    expect(safetyZone(1.1)).toBe('liquidation')
    expect(safetyZone(1.19)).toBe('liquidation')
  })

  test('1.2 ≤ ratio < 1.5 → stressed zone', () => {
    expect(safetyZone(1.2)).toBe('stressed')
    expect(safetyZone(1.49)).toBe('stressed')
  })

  test('ratio ≥ 1.5 → safe zone', () => {
    expect(safetyZone(1.5)).toBe('safe')
    expect(safetyZone(3.0)).toBe('safe')
  })
})

describe('COLLATERAL_PRESETS', () => {
  test('drops xStock and agioSOL aliases', () => {
    expect(COLLATERAL_PRESETS).not.toHaveProperty('xStock')
    expect(COLLATERAL_PRESETS).not.toHaveProperty('agioSOL')
    expect(COLLATERAL_PRESETS).toHaveProperty('bSOL')
  })

  test('every preset has min ≤ default', () => {
    for (const [, p] of Object.entries(COLLATERAL_PRESETS)) {
      expect(p.minCollateralPct).toBeLessThanOrEqual(p.defaultCollateralPct)
    }
  })

  test('unknown token falls back to a conservative preset', () => {
    const fallback = getCollateralPreset('NOPE')
    expect(fallback.minCollateralPct).toBeGreaterThanOrEqual(150)
  })
})

describe('LIQUIDATION_THRESHOLD constant', () => {
  test('matches the on-chain 12_000 bps', () => {
    expect(LIQUIDATION_THRESHOLD).toBe(1.2)
  })
})
