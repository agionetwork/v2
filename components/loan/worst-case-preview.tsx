"use client"

import { priceDropToWarning, priceDropToForeclosure } from "@/lib/loan-math"
import { cn } from "@/lib/utils"

interface Props {
  collateralValueUsd: number
  principalUsd: number
  apyBps: number
  durationSeconds: number
  collateralSymbol: string
  className?: string
}

/**
 * One-line italic preview of how far the collateral price can fall before the
 * loan enters the warning zone (115%) and before it becomes foreclosable
 * (110%). Uses the same helpers the validator/MCP use, so the headroom shown
 * matches what the protocol enforces.
 */
export function WorstCasePreview({
  collateralValueUsd,
  principalUsd,
  apyBps,
  durationSeconds,
  collateralSymbol,
  className,
}: Props) {
  if (principalUsd <= 0 || collateralValueUsd <= 0) return null

  const warnDrop = priceDropToWarning(
    collateralValueUsd,
    principalUsd,
    apyBps,
    durationSeconds,
  )
  const forecloseDrop = priceDropToForeclosure(
    collateralValueUsd,
    principalUsd,
    apyBps,
    durationSeconds,
  )

  if (forecloseDrop <= 0) {
    return (
      <p className={cn("mt-2 text-xs italic text-red-500", className)}>
        At current settings, this loan is already foreclosable (health factor below 110%).
      </p>
    )
  }

  return (
    <p className={cn("mt-2 text-xs italic text-muted-foreground dark:text-white", className)}>
      If {collateralSymbol} drops{" "}
      <span className="font-medium not-italic text-yellow-600 dark:text-yellow-500">
        {warnDrop.toFixed(1)}%
      </span>{" "}
      it enters the warning zone;{" "}
      <span className="font-medium not-italic text-red-600 dark:text-red-500">
        {forecloseDrop.toFixed(1)}%
      </span>{" "}
      and it becomes foreclosable.
    </p>
  )
}
