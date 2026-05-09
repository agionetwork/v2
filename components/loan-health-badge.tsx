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
 * Foreclosure threshold: < 125% (DEFAULT_LIQUIDATION_THRESHOLD = 12500 bps, LTV 80%).
 * Acceptance floor: 130% (offers can be created at 150-300%, accepted at >= 130%).
 */
function classify(ratio: number, isPending: boolean): LoanHealthStatus {
  if (!Number.isFinite(ratio) || ratio <= 0) return "unknown"

  if (isPending) {
    return ratio >= 130 ? "pending-ok" : "pending-bad"
  }

  if (ratio >= 150) return "healthy"
  if (ratio >= 130) return "caution"
  if (ratio >= 125) return "at-risk"
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
  healthy: "At or above 150%. Comfortable buffer over the foreclosure threshold (125%, LTV 80%).",
  caution: "Between 130% and 150%. Above the acceptance floor but watch oracle moves.",
  "at-risk": "Between 125% and 130%. Add collateral or repay before the price moves further.",
  foreclosure: "Below 125% (LTV 80%). Lender can foreclose at any time. Add collateral immediately.",
  "pending-ok": "At or above the 130% acceptance floor. The offer is acceptable.",
  "pending-bad": "Below the 130% acceptance floor. The offer cannot be accepted as-is.",
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
 *   start  (0%)   = 125% collateral — liquidation boundary (LTV 80%)
 *   middle (50%)  = 150% collateral — stressed/safe boundary
 *   end    (100%) = 175%+ collateral — comfortably safe
 *
 * Both halves cover the same 25-point span, so the marker sits exactly in
 * the middle when the loan crosses into safe territory.
 */
const PCT_LIQUIDATION = 125
const PCT_STRESSED = 150
const PCT_BAR_END = 175
function pctToBarPos(pct: number): number {
  if (pct <= PCT_LIQUIDATION) return 0
  if (pct >= PCT_BAR_END) return 100
  if (pct <= PCT_STRESSED) {
    return ((pct - PCT_LIQUIDATION) / (PCT_STRESSED - PCT_LIQUIDATION)) * 50
  }
  return 50 + ((pct - PCT_STRESSED) / (PCT_BAR_END - PCT_STRESSED)) * 50
}

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
        {/* 150% boundary tick at the midpoint */}
        <div
          className="absolute top-0 bottom-0 w-px bg-black/40 dark:bg-white/40"
          style={{ left: "50%" }}
          aria-hidden
        />
        {safe > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-1.5 rounded-sm bg-foreground shadow-md transition-[left] duration-200 ease-out"
            style={{ left: `${markerPct}%` }}
            aria-label={`Current ratio ${safe.toFixed(1)}%`}
          />
        )}
      </div>
      <div className="relative h-3.5 text-[10px] text-muted-foreground tabular-nums">
        <span className="absolute left-0 text-red-500 font-medium">125% Liquidation</span>
        <span className="absolute left-1/2 -translate-x-1/2">150%</span>
        <span className="absolute right-0">175%+</span>
      </div>
    </div>
  )
}
