"use client"

import { ReactNode } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FairTier } from "@/lib/fairscale"

interface BadgeProps {
  score: number
  tier: FairTier
  subOnchain?: number | null
  subSocial?: number | null
  subBehavioral?: number | null
  size?: "sm" | "md"
  className?: string
}

const TIER_STYLES: Record<FairTier, string> = {
  platinum: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/30",
  gold: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  silver: "bg-slate-400/10 text-slate-500 dark:text-slate-300 border-slate-400/30",
  bronze: "bg-orange-700/10 text-orange-700 dark:text-orange-400 border-orange-700/30",
  unrated: "bg-muted text-muted-foreground border-border/40",
}

const TIER_LABEL: Record<FairTier, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  unrated: "Unrated",
}

function formatScore(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "—"
  return s.toFixed(2)
}

function SubScoreLine({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value.toFixed(2)}</span>
    </div>
  )
}

/**
 * Compact pill: "Star · 3.42 · Gold". Hover tooltip shows the 3 sub-scores
 * (onchain / social / behavioral) when provided.
 */
export function FairScoreBadge({
  score,
  tier,
  subOnchain,
  subSocial,
  subBehavioral,
  size = "md",
  className,
}: BadgeProps) {
  const styles = TIER_STYLES[tier]
  const label = TIER_LABEL[tier]
  const compact = size === "sm"

  const inner: ReactNode = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium cursor-help",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        styles,
        className,
      )}
    >
      <Star className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} fill="currentColor" />
      <span className="font-semibold">{formatScore(score)}</span>
      {!compact && (
        <>
          <span className="opacity-70">·</span>
          <span>{label}</span>
        </>
      )}
    </span>
  )

  if (subOnchain == null && subSocial == null && subBehavioral == null) {
    return inner
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="bottom" className="w-48 space-y-1">
          <div className="text-xs font-semibold mb-1">{label} tier</div>
          <SubScoreLine label="On-chain" value={subOnchain} />
          <SubScoreLine label="Social" value={subSocial} />
          <SubScoreLine label="Behavioral" value={subBehavioral} />
          <div className="pt-1 mt-1 border-t border-border/30 text-[10px] text-muted-foreground">
            Powered by Fairscale
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface CardProps {
  score: number
  tier: FairTier
  subOnchain?: number | null
  subSocial?: number | null
  subBehavioral?: number | null
  className?: string
}

/**
 * Bigger reputation card for profile pages: score number, tier label,
 * and the three sub-score bars.
 */
export function FairScoreCard({
  score,
  tier,
  subOnchain,
  subSocial,
  subBehavioral,
  className,
}: CardProps) {
  const styles = TIER_STYLES[tier]
  const label = TIER_LABEL[tier]
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center justify-center h-9 w-9 rounded-full border",
              styles,
            )}
          >
            <Star className="h-4 w-4" fill="currentColor" />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              FairScale reputation
            </div>
            <div className="text-2xl font-bold leading-tight">
              {formatScore(score)}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ 5.00</span>
            </div>
          </div>
        </div>
        <span className={cn("text-xs font-medium px-2 py-1 rounded-full border", styles)}>
          {label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <SubBar label="On-chain" value={subOnchain} />
        <SubBar label="Social" value={subSocial} />
        <SubBar label="Behavioral" value={subBehavioral} />
      </div>

      <p className="text-[10px] text-muted-foreground pt-1">
        External, on-chain reputation provider. Scores are derived from publicly verifiable signals
        and refresh roughly every 6 hours.
      </p>
    </div>
  )
}

function SubBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value != null && Number.isFinite(value) ? value : 0
  const pct = Math.max(0, Math.min(100, (v / 5) * 100))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value != null ? value.toFixed(2) : "—"}</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
