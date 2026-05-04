"use client"

import { Bot } from "lucide-react"
import { AgentPanel } from "@/components/agent/agent-panel"

export default function AutoLoanPageClient() {
  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" /> Auto-Loan
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A server-managed wallet that follows the rules you set: scans the marketplace, posts offers, accepts deals, and rebalances 24/7.
        </p>
      </div>

      <AgentPanel />
    </div>
  )
}
