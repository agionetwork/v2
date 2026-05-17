"use client"

import { cn } from "@/lib/utils"

export type LoanHealthStatus = "healthy" | "caution" | "at-risk" | "foreclosure" | "pending-ok" | "pending-bad" | "unknown"

interface Props {
  /** Live collateral ratio as a percentage (e.g. 145 means 145%). */
  ratio: number
  /** Whether the loan is still a pending offer (uses acceptance-floor thresholds) or already accepted (uses foreclosure thresholds). */
  isPending?: boolean
  /** Optional className to extend or override styling. */
  className?: string
  /** Compact mode: just the colored pill, no text label. */
  compact?: boolean
}

/**
 * V1 health zones (collateral % of total debt):
 *   >= 150% → healthy   (green — safe, low liquidation risk)
 *   125-150% → caution  (yellow — moderate; loans open at 125% land here)
 *   115-125% → at-risk  (orange — add collateral now)
 *   < 115%   → foreclosure (red — critical, trigger is < 110%)
 * Acceptance floor matches the creation minimum (125%).
 */
function classify(ratio: number, isPending: boolean): LoanHealthStatus {
  if (!Number.isFinite(ratio) || ratio <= 0) return "unknown"

  if (isPending) {
    return ratio >= 125 ? "pending-ok" : "pending-bad"
  }

  if (ratio >= 150) return "healthy"
  if (ratio >= 125) return "caution"
  if (ratio >= 115) return "at-risk"
  return "foreclosure"
}

const LABELS: Record<LoanHealthStatus, string> = {
  healthy: "Safe",
  caution: "Moderate",
  "at-risk": "Danger",
  foreclosure: "Critical",
  "pending-ok": "Acceptable",
  "pending-bad": "Below acceptance floor",
  unknown: "Unknown",
}

const STYLES: Record<LoanHealthStatus, string> = {
  healthy: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  caution: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  "at-risk": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  foreclosure: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40",
  "pending-ok": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  "pending-bad": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40",
  unknown: "bg-muted text-muted-foreground border-border/40",
}

const TOOLTIPS: Record<LoanHealthStatus, string> = {
  healthy: "At or above 150%. Safe — low liquidation risk for the loan duration.",
  caution: "Between 125% and 150%. Moderate risk — loans open here; consider adding collateral.",
  "at-risk": "Between 115% and 125%. Danger — add collateral now to avoid foreclosure.",
  foreclosure: "Below 115%. Critical — foreclosure triggers under 110%. Add collateral immediately.",
  "pending-ok": "At or above the 125% creation minimum. The offer is acceptable.",
  "pending-bad": "Below the 125% creation minimum. The offer cannot be accepted as-is.",
  unknown: "Oracle prices unavailable, ratio not computable.",
}

export function LoanHealthBadge({ ratio, isPending = false, className, compact = false }: Props) {
  const status = classify(ratio, isPending)
  const label = LABELS[status]
  const styles = STYLES[status]
  const tooltip = TOOLTIPS[status]
  const ratioStr = Number.isFinite(ratio) && ratio > 0 ? `${ratio.toFixed(0)}%` : "—"

  if (compact) {
    return (
      <span
        title={tooltip}
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
          styles,
          className,
        )}
      >
        {ratioStr}
      </span>
    )
  }

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles,
        className,
      )}
    >
      <span className="font-semibold">{ratioStr}</span>
      <span className="opacity-80">·</span>
      <span>{label}</span>
    </span>
  )
}

/**
 * Bar variant: visuals match the RiskZoneBar on the borrow/lend form so a
 * loan looks the same color across creation and the dashboard modal.
 *
 * Scale (in collateral % terms):
 *   start  (0%)   = 110% — foreclosure boundary (liquidatable below)
 *   ~11%          = 125% — creation minimum (yellow zone)
 *   ~62%          = 150% — green zone (safe)
 *   end    (100%) = 175%+ — comfortable buffer
 */
const PCT_FORECLOSURE = 110
const PCT_CREATION = 125
const PCT_GREEN = 150
const PCT_BAR_END = 175
function pctToBarPos(pct: number): number {
  if (pct <= PCT_FORECLOSURE) return 0
  if (pct >= PCT_BAR_END) return 100
  return ((pct - PCT_FORECLOSURE) / (PCT_BAR_END - PCT_FORECLOSURE)) * 100
}
const CREATION_BAR_POS = pctToBarPos(PCT_CREATION)
const GREEN_BAR_POS = pctToBarPos(PCT_GREEN)

export function LoanHealthBar({ ratio, isPending = false, className }: Props) {
  const status = classify(ratio, isPending)
  const styles = STYLES[status]
  const tooltip = TOOLTIPS[status]
  const safe = Number.isFinite(ratio) && ratio > 0 ? ratio : 0
  const markerPct = pctToBarPos(safe)

  return (
    <div title={tooltip} className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{safe > 0 ? `${safe.toFixed(1)}%` : "Ratio unavailable"}</span>
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", styles)}>{LABELS[status]}</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 to-emerald-500">
        {/* 125% creation-minimum tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${CREATION_BAR_POS}%` }}
          aria-hidden
          title="Creation minimum (125%)"
        />
        {/* 150% green-zone tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${GREEN_BAR_POS}%` }}
          aria-hidden
          title="Green zone (150%)"
        />
        {safe > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-1.5 rounded-sm bg-foreground shadow-md transition-[left] duration-200 ease-out"
            style={{ left: `${markerPct}%` }}
            aria-label={`Current health factor ${safe.toFixed(1)}%`}
          />
        )}
      </div>
      <div className="relative h-8 text-[10px] text-muted-foreground tabular-nums">
        <div className="absolute left-0 top-0 flex flex-col items-start leading-tight text-red-500 font-medium">
          <span>115%</span>
          <span className="text-[9px]">Danger</span>
        </div>
        <span
          className="absolute top-0"
          style={{ left: `${CREATION_BAR_POS}%`, transform: "translateX(-50%)" }}
        >
          125%
        </span>
        <div
          className="absolute top-0 flex flex-col items-center leading-tight text-emerald-600 dark:text-emerald-500 font-medium"
          style={{ left: `${GREEN_BAR_POS}%`, transform: "translateX(-50%)" }}
        >
          <span>150%</span>
          <span className="text-[9px]">Safe</span>
        </div>
        <span className="absolute top-0 right-0">175%+</span>
      </div>
    </div>
  )
}
