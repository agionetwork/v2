/**
 * Agio MCP Fee Calculator — Pricing v2 (Proportional Fees)
 *
 * The platform only charges when value-generating operations are executed.
 * Scanning, onboarding, configuration, social, and risk management are free.
 *
 * Formula: fee = max(MIN_FEE, min(MAX_FEE, volume_usd * rate))
 * Fee is always in USDC.
 */

export interface FeeConfig {
  rate: number         // Percentage as decimal (0.001 = 0.1%)
  type: 'proportional' | 'flat' | 'free'
  baseField: string    // Which request field to use as volume base
  flat?: number        // For flat fee type only
}

export const MIN_FEE_USDC = 0.01
export const MAX_FEE_USDC = 10.00
export const BATCH_DISCOUNT = 0.10 // 10%

/**
 * Fee configuration — single source of truth.
 * Tools NOT listed here are FREE (fee = 0).
 *
 * Lending operations are free in MCP — the 1% origination fee is
 * collected on-chain when offers are accepted (deducted from disbursement).
 */
export const FEE_CONFIG: Record<string, FeeConfig> = {
  // --- Lending operations: FREE in MCP (on-chain 1% origination fee) ---
  'create-lend-offer':     { rate: 0, type: 'free', baseField: 'debtAmount' },
  'create-borrow-request': { rate: 0, type: 'free', baseField: 'debtAmount' },
  'accept-lend-offer':     { rate: 0, type: 'free', baseField: 'debtAmount' },
  'accept-borrow-request': { rate: 0, type: 'free', baseField: 'debtAmount' },
  'repay-loan':            { rate: 0, type: 'free', baseField: 'amount' },
  'foreclose-loan':        { rate: 0, type: 'free', baseField: 'collateralAmount' },
  'rescind-offer':         { rate: 0, type: 'free', baseField: '' },
  'add-collateral':        { rate: 0, type: 'free', baseField: '' },

  // --- Proportional fees (non-lending — 0.05%) ---
  'swap-tokens':           { rate: 0.0005, type: 'proportional', baseField: 'amount' },

  // --- Flat fee (one-time onboarding) ---
  'create-agent':          { rate: 0, type: 'flat', baseField: '', flat: 0.10 },
}

/**
 * Calculate the fee for a given tool and USD volume.
 * Returns 0 for free operations.
 */
export function calculateFee(tool: string, volumeUsd: number): number {
  const config = FEE_CONFIG[tool]
  if (!config || config.type === 'free') return 0
  if (config.type === 'flat') return config.flat ?? 0

  // Proportional: fee = clamp(volume * rate, MIN, MAX)
  const rawFee = volumeUsd * config.rate
  return Math.round(
    Math.max(MIN_FEE_USDC, Math.min(MAX_FEE_USDC, rawFee)) * 100
  ) / 100
}

/**
 * Calculate the total batch fee with 10% discount.
 * Free operations contribute 0 to the total.
 */
export function calculateBatchFee(
  operations: Array<{ tool: string; volumeUsd: number }>
): number {
  const total = operations.reduce(
    (sum, op) => sum + calculateFee(op.tool, op.volumeUsd),
    0,
  )
  if (total === 0) return 0
  return Math.round(total * (1 - BATCH_DISCOUNT) * 100) / 100
}

/**
 * Check if a tool is free (no x402 payment required).
 */
export function isFreeOperation(tool: string): boolean {
  const config = FEE_CONFIG[tool]
  if (!config) return true // Not listed → free
  return config.type === 'free'
}

/**
 * Check if a tool has a proportional fee.
 */
export function isProportionalFee(tool: string): boolean {
  const config = FEE_CONFIG[tool]
  return config?.type === 'proportional' || false
}

/**
 * Get the fee rate description for a tool (for human-readable display).
 */
export function getFeeDescription(tool: string, volumeUsd?: number): string {
  const config = FEE_CONFIG[tool]
  if (!config || config.type === 'free') return 'Free — no payment required.'
  if (config.type === 'flat') return `Flat fee: $${(config.flat ?? 0).toFixed(2)} USDC.`

  const pct = (config.rate * 100).toFixed(2)
  if (volumeUsd !== undefined) {
    const fee = calculateFee(tool, volumeUsd)
    return `${pct}% of $${volumeUsd.toFixed(2)} = $${fee.toFixed(2)} USDC (min $${MIN_FEE_USDC}, max $${MAX_FEE_USDC}).`
  }
  return `${pct}% of volume (min $${MIN_FEE_USDC}, max $${MAX_FEE_USDC} USDC).`
}
