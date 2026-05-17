"use client"

import {
  maxDebtUsd,
  liquidationProbabilityPct,
  safetyDays,
  recommendedAdditionalCollateral,
} from "@/lib/loan-math"
import { cn } from "@/lib/utils"

interface Props {
  collateralValueUsd: number
  principalUsd: number
  apyBps: number
  durationSeconds: number
  collateralSymbol: string
  collateralPriceUsd?: number
  className?: string
}

/**
 * One-line preview of the real liquidation probability for the chosen
 * parameters, with a concrete add-collateral recommendation. Uses the same
 * model the MCP preview-loan-safety tool returns.
 */
export function WorstCasePreview({
  collateralValueUsd,
  principalUsd,
  apyBps,
  durationSeconds,
  collateralSymbol,
  collateralPriceUsd,
  className,
}: Props) {
  if (principalUsd <= 0 || collateralValueUsd <= 0) return null

  const debtTotalUsd = maxDebtUsd(principalUsd, apyBps, durationSeconds)
  const durationDays = durationSeconds / 86400
  const prob = liquidationProbabilityPct(
    collateralValueUsd,
    debtTotalUsd,
    durationDays,
    collateralSymbol,
  )
  const sDays = safetyDays(collateralValueUsd, debtTotalUsd, durationDays, collateralSymbol)
  const price = collateralPriceUsd ?? 0
  const rec = recommendedAdditionalCollateral(
    collateralValueUsd,
    debtTotalUsd,
    durationDays,
    collateralSymbol,
    price,
    15,
  )
  const addAmount = rec?.amount
  const days = Math.round(durationDays)
  const p = Math.round(prob)

  let phrase: string
  let tone: string
  if (prob < 5) {
    phrase = `Very low liquidation risk (<5%). Your collateral has a strong margin.`
    tone = "text-emerald-600 dark:text-emerald-500"
  } else if (prob < 15) {
    phrase = `Low risk (~${p}%). Comfortable margin for the ${days}-day duration.`
    tone = "text-emerald-600 dark:text-emerald-500"
  } else if (prob < 30) {
    phrase = `Moderate risk (~${p}%).${addAmount ? ` Consider adding ${addAmount} ${collateralSymbol} to reduce below 15%.` : ""}`
    tone = "text-yellow-600 dark:text-yellow-500"
  } else if (prob < 50) {
    phrase = `⚠ High risk (~${p}%). ${collateralSymbol} volatility may trigger liquidation within ~${Math.round(sDays)} days.${addAmount ? ` Add ${addAmount} ${collateralSymbol} for a safer position.` : ""}`
    tone = "text-orange-600 dark:text-orange-500"
  } else {
    phrase = `⚠ Critical risk (~${p}%). Very likely to be liquidated before the deadline.${addAmount ? ` Add ${addAmount} ${collateralSymbol} or reduce the duration.` : ""}`
    tone = "text-red-600 dark:text-red-500"
  }

  return (
    <p className={cn("mt-2 text-xs italic", tone, className)}>{phrase}</p>
  )
}
