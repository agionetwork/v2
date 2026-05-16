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
 * Separated-threshold model (collateral % of total debt):
 *   >= 125% → healthy   (creation minimum / green zone)
 *   115-125% → caution  (warning zone — suggest add-collateral)
 *   110-115% → at-risk  (danger — approaching liquidation)
 *   < 110%   → foreclosure (liquidatable)
 * Acceptance floor matches the creation minimum (125%).
 */
function classify(ratio: number, isPending: boolean): LoanHealthStatus {
  if (!Number.isFinite(ratio) || ratio <= 0) return "unknown"

  if (isPending) {
    return ratio >= 125 ? "pending-ok" : "pending-bad"
  }

  if (ratio >= 125) return "healthy"
  if (ratio >= 115) return "caution"
  if (ratio >= 110) return "at-risk"
  return "foreclosure"
}

const LABELS: Record<LoanHealthStatus, string> = {
  healthy: "Healthy",
  caution: "Caution",
  "at-risk": "At risk",
  foreclosure: "Foreclosure-eligible",
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
  healthy: "At or above 125%. Meets the creation minimum with a healthy buffer over the 110% foreclosure line.",
  caution: "Between 115% and 125% (warning zone). Above foreclosure but consider adding collateral.",
  "at-risk": "Between 110% and 115% (danger zone). Add collateral or repay before the price moves further.",
  foreclosure: "Below 110%. Liquidatable — anyone can foreclose. Add collateral immediately.",
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
 *   ~12%          = 115% — warning
 *   ~37%          = 125% — creation minimum (green zone starts)
 *   end    (100%) = 150%+ — comfortable buffer
 */
const PCT_FORECLOSURE = 110
const PCT_WARNING = 115
const PCT_CREATION = 125
const PCT_BAR_END = 150
function pctToBarPos(pct: number): number {
  if (pct <= PCT_FORECLOSURE) return 0
  if (pct >= PCT_BAR_END) return 100
  return ((pct - PCT_FORECLOSURE) / (PCT_BAR_END - PCT_FORECLOSURE)) * 100
}
const WARNING_BAR_POS = pctToBarPos(PCT_WARNING)
const CREATION_BAR_POS = pctToBarPos(PCT_CREATION)

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
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500">
        {/* 115% warning tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${WARNING_BAR_POS}%` }}
          aria-hidden
          title="Warning (115%)"
        />
        {/* 125% creation-minimum tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: `${CREATION_BAR_POS}%` }}
          aria-hidden
          title="Creation minimum (125%)"
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
          <span>110%</span>
          <span className="text-[9px]">Foreclosure</span>
        </div>
        <div
          className="absolute top-0 flex flex-col items-center leading-tight text-yellow-600 dark:text-yellow-500 font-medium"
          style={{ left: `${WARNING_BAR_POS}%`, transform: "translateX(-50%)" }}
        >
          <span>115%</span>
          <span className="text-[9px]">Warning</span>
        </div>
        <span
          className="absolute top-0"
          style={{ left: `${CREATION_BAR_POS}%`, transform: "translateX(-50%)" }}
        >
          125%
        </span>
        <span className="absolute top-0 right-0">150%+</span>
      </div>
    </div>
  )
}
