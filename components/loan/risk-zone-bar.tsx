"use client"

import {
  RATIO_LIQUIDATION,
  RATIO_STRESSED,
  safetyRatio,
  safetyZone,
} from "@/lib/loan-math"
import { cn } from "@/lib/utils"

interface Props {
  collateralValueUsd: number
  principalUsd: number
  apyBps: number
  durationSeconds: number
  className?: string
}

/**
 * Three-zone collateralization meter:
 *   ratio < 1.2  → 🔴 liquidation
 *   1.2 ≤ < 1.5  → 🟡 stressed
 *   ratio ≥ 1.5  → 🟢 safe
 *
 * The zones are colored bands of the bar; a vertical marker shows where
 * the current loan parameters land. Position uses the same `safetyRatio`
 * that drives `isLoanSafe`, so what the user sees and what the contract
 * accepts agree by construction.
 */
export function RiskZoneBar({
  collateralValueUsd,
  principalUsd,
  apyBps,
  durationSeconds,
  className,
}: Props) {
  const ratio = safetyRatio(collateralValueUsd, principalUsd, apyBps, durationSeconds)
  const zone = safetyZone(ratio)

  // Map ratio → 0-100% bar position. Cap at 2.0× (anything above is "very safe").
  const RATIO_MAX_DISPLAY = 2.0
  const markerPct = Math.min(100, Math.max(0, (ratio / RATIO_MAX_DISPLAY) * 100))

  // Boundary ticks (12000bps and 15000bps) shown as hairline marks.
  const liquidationTickPct = (RATIO_LIQUIDATION / RATIO_MAX_DISPLAY) * 100
  const stressedTickPct = (RATIO_STRESSED / RATIO_MAX_DISPLAY) * 100

  const zoneLabel =
    zone === "liquidation"
      ? "Liquidation risk"
      : zone === "stressed"
        ? "Stressed"
        : "Safe"

  const zoneColor =
    zone === "liquidation"
      ? "text-red-500"
      : zone === "stressed"
        ? "text-yellow-500"
        : "text-emerald-500"

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Collateral health</span>
        <span className={cn("font-medium tabular-nums", zoneColor)}>
          {zoneLabel} · {ratio.toFixed(2)}×
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500/80 via-yellow-500/80 to-emerald-500/80">
        {/* Boundary hairlines */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/30 dark:bg-white/30"
          style={{ left: `${liquidationTickPct}%` }}
          aria-hidden
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-black/30 dark:bg-white/30"
          style={{ left: `${stressedTickPct}%` }}
          aria-hidden
        />
        {/* Live marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-1.5 rounded-sm bg-foreground shadow-md transition-[left] duration-200 ease-out"
          style={{ left: `${markerPct}%` }}
          aria-label={`Current ratio ${ratio.toFixed(2)}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>1.0×</span>
        <span style={{ marginLeft: `${liquidationTickPct - 8}%` }}>1.2×</span>
        <span style={{ marginLeft: `${stressedTickPct - liquidationTickPct - 8}%` }}>1.5×</span>
        <span>2.0×</span>
      </div>
    </div>
  )
}
