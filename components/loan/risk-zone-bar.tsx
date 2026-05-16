"use client"

import {
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
 * Health-factor meter (separated-threshold model):
 *   0%   = 1.10× — foreclosure boundary (liquidatable below this)
 *   ~12% = 1.15× — warning (suggest add-collateral)
 *   ~37% = 1.25× — creation minimum (green zone starts here)
 *   100% = 1.50× — comfortable buffer
 *
 * Ratio = collateral_value / debt_total_at_maturity.
 */
const RATIO_BAR_START = FORECLOSURE_THRESHOLD // 1.10
const RATIO_BAR_END = 1.5

function ratioToBarPct(r: number): number {
  if (r <= RATIO_BAR_START) return 0
  if (r >= RATIO_BAR_END) return 100
  return ((r - RATIO_BAR_START) / (RATIO_BAR_END - RATIO_BAR_START)) * 100
}

const WARNING_PCT = ratioToBarPct(WARNING_THRESHOLD) // 1.15
const CREATION_PCT = ratioToBarPct(CREATION_THRESHOLD) // 1.25

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
        ? "Warning"
        : zone === "orange"
          ? "Danger"
          : "Liquidatable"

  const zoneColor =
    zone === "green"
      ? "text-emerald-600 dark:text-emerald-500"
      : zone === "yellow"
        ? "text-yellow-600 dark:text-yellow-500"
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
                  Health factor = collateral value ÷ total debt (principal + worst-case interest through maturity). Loans open at ≥ 125%, enter the warning zone at 115%, and become foreclosable below 110%. Higher is safer.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className={cn("font-medium tabular-nums", zoneColor)}>
          {zoneLabel} · {(ratio * 100).toFixed(0)}%
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500">
        {/* 115% warning tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${WARNING_PCT}%` }}
          aria-hidden
          title="Warning (115%)"
        />
        {/* 125% creation-minimum tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${CREATION_PCT}%` }}
          aria-hidden
          title="Creation minimum (125%)"
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
          <span>110%</span>
          <span className="text-[9px]">Foreclosure</span>
        </div>
        <div
          className="absolute top-0 flex flex-col items-center leading-tight text-yellow-600 dark:text-yellow-500 font-medium"
          style={{ left: `${WARNING_PCT}%`, transform: "translateX(-50%)" }}
        >
          <span>115%</span>
          <span className="text-[9px]">Warning</span>
        </div>
        <span
          className="absolute top-0"
          style={{ left: `${CREATION_PCT}%`, transform: "translateX(-50%)" }}
        >
          125%
        </span>
        <span className="absolute top-0 right-0">150%+</span>
      </div>
    </div>
  )
}
