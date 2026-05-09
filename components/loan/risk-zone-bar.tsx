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
 * Two-segment collateralization meter:
 *   start  (0%)   = 1.2× — liquidation boundary
 *   middle (50%)  = 1.5× — stressed/safe boundary
 *   end    (100%) = 1.8×+ — comfortably safe
 *
 * Each half maps to the same 0.3× span, so the marker hits the middle
 * exactly when the loan crosses into the "safe" zone. Below 1.2× the
 * marker pins at the start and the zone label flips to "Liquidation risk".
 */
const RATIO_BAR_END = 1.8
function ratioToBarPct(r: number): number {
  if (r <= RATIO_LIQUIDATION) return 0
  if (r >= RATIO_BAR_END) return 100
  if (r <= RATIO_STRESSED) {
    return ((r - RATIO_LIQUIDATION) / (RATIO_STRESSED - RATIO_LIQUIDATION)) * 50
  }
  return 50 + ((r - RATIO_STRESSED) / (RATIO_BAR_END - RATIO_STRESSED)) * 50
}

export function RiskZoneBar({
  collateralValueUsd,
  principalUsd,
  apyBps,
  durationSeconds,
  className,
}: Props) {
  const ratio = safetyRatio(collateralValueUsd, principalUsd, apyBps, durationSeconds)
  const zone = safetyZone(ratio)
  const markerPct = ratioToBarPct(ratio)

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
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500">
        {/* 1.5× boundary tick at the midpoint */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: "50%" }}
          aria-hidden
        />
        {/* Live marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-1.5 rounded-sm bg-foreground shadow-md transition-[left] duration-200 ease-out"
          style={{ left: `${markerPct}%` }}
          aria-label={`Current ratio ${ratio.toFixed(2)}`}
        />
      </div>
      <div className="relative h-3.5 text-[10px] text-muted-foreground tabular-nums">
        <span className="absolute left-0 -translate-x-0 text-red-500 font-medium">
          1.2× Liquidation
        </span>
        <span className="absolute left-1/2 -translate-x-1/2">1.5×</span>
        <span className="absolute right-0">1.8×+</span>
      </div>
    </div>
  )
}
