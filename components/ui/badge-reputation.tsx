"use client"

import { getReputationColor } from "@/lib/utils"

interface ReputationBadgeProps {
  score: number
}

export function ReputationBadge({ score }: ReputationBadgeProps) {
  return (
    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getReputationColor(score)}`}>
      {score}/100
    </div>
  )
}