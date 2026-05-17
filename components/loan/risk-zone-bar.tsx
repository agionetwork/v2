"use client"

import {
  GREEN_THRESHOLD,
  CREATION_THRESHOLD,
  WARNING_THRESHOLD,
  FORECLOSURE_THRESHOLD,
  safetyRatio,
  healthZone,
} from "@/lib/loan-math"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
  collateralValueUsd: number
  principalUsd: number
  apyBps: number
  durationSeconds: number
  className?: string
}

/**
 * V1 health meter. Ratio = collateral_value / debt_total_at_maturity.
 *   < 1.15        red    — critical
 *   1.15 – 1.25   orange — danger, add collateral
 *   1.25 – 1.50   yellow — moderate (loans open at 1.25 → start yellow)
 *   ≥ 1.50        green  — safe
 *
 * Bar runs from the 1.10 foreclosure line to a 1.75 comfortable cap.
 */
const RATIO_BAR_START = FORECLOSURE_THRESHOLD // 1.10
const RATIO_BAR_END = 1.75

function ratioToBarPct(r: number): number {
  if (r <= RATIO_BAR_START) return 0
  if (r >= RATIO_BAR_END) return 100
  return ((r - RATIO_BAR_START) / (RATIO_BAR_END - RATIO_BAR_START)) * 100
}

const WARNING_PCT = ratioToBarPct(WARNING_THRESHOLD) // 1.15
const CREATION_PCT = ratioToBarPct(CREATION_THRESHOLD) // 1.25
const GREEN_PCT = ratioToBarPct(GREEN_THRESHOLD) // 1.50

export function RiskZoneBar({
  collateralValueUsd,
  principalUsd,
  apyBps,
  durationSeconds,
  className,
}: Props) {
  const ratio = safetyRatio(collateralValueUsd, principalUsd, apyBps, durationSeconds)
  const zone = healthZone(ratio)
  const markerPct = ratioToBarPct(ratio)

  const zoneLabel =
    zone === "green"
      ? "Safe"
      : zone === "yellow"
        ? "Moderate"
        : zone === "orange"
          ? "Danger"
          : "Critical"

  const zoneColor =
    zone === "green"
      ? "text-emerald-600 dark:text-emerald-500"
      : zone === "yellow"
        ? "text-yellow-600 dark:text-yellow-500"
        : zone === "orange"
          ? "text-orange-600 dark:text-orange-500"
          : "text-red-600 dark:text-red-500"

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-foreground">LOAN HEALTH</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-transparent dark:bg-blue-950">
                <p>
                  Health factor = collateral value ÷ total debt (principal + worst-case interest). Green ≥ 150% (safe), yellow ≥ 125% (moderate — loans open here), orange ≥ 115% (add collateral), red below. Foreclosure triggers under 110%.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className={cn("font-medium tabular-nums", zoneColor)}>
          {zoneLabel} · {(ratio * 100).toFixed(0)}%
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 to-emerald-500">
        {/* 125% creation-minimum tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${CREATION_PCT}%` }}
          aria-hidden
          title="Creation minimum (125%)"
        />
        {/* 150% green-zone tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${GREEN_PCT}%` }}
          aria-hidden
          title="Green zone (150%)"
        />
        {/* Live marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-1.5 rounded-sm bg-foreground shadow-md transition-[left] duration-200 ease-out"
          style={{ left: `${markerPct}%` }}
          aria-label={`Current health factor ${(ratio * 100).toFixed(0)}%`}
        />
      </div>
      <div className="relative h-8 text-[10px] text-muted-foreground tabular-nums">
        <div className="absolute left-0 top-0 flex flex-col items-start leading-tight text-red-500 font-medium">
          <span>115%</span>
          <span className="text-[9px]">Danger</span>
        </div>
        <span
          className="absolute top-0"
          style={{ left: `${CREATION_PCT}%`, transform: "translateX(-50%)" }}
        >
          125%
        </span>
        <div
          className="absolute top-0 flex flex-col items-center leading-tight text-emerald-600 dark:text-emerald-500 font-medium"
          style={{ left: `${GREEN_PCT}%`, transform: "translateX(-50%)" }}
        >
          <span>150%</span>
          <span className="text-[9px]">Safe</span>
        </div>
        <span className="absolute top-0 right-0">175%+</span>
      </div>
    </div>
  )
}
