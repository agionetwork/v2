"use client"

import { useState, useEffect, useRef } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Copy,
  Check,
  Power,
  PowerOff,
  Loader2,
  ArrowDownToLine,
  ArrowUpToLine,
  EyeOff,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { AgentConfigForm } from "./agent-config-form"
import { AgentHistory } from "./agent-history"
import { AgentWithdrawDialog } from "./agent-withdraw-dialog"
import { AgentFundDialog } from "./agent-fund-dialog"

interface Props {
  wallet: string
  status: {
    config: any
    agentPublicKey: string
    balances: Record<string, number>
  }
  onRefresh: () => void
  authQuery: string
}

export function AgentDashboard({ wallet, status, onRefresh, authQuery }: Props) {
  const { signMessage } = useWallet()
  const [toggling, setToggling] = useState(false)
  const [togglingPrivacy, setTogglingPrivacy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showFund, setShowFund] = useState(false)

  const isActive = status.config.enabled
  const isPrivate = !!status.config.privacyEnabled
  const cycleRunningRef = useRef(false)

  // Auto-polling with exponential backoff: 1s on success, doubles on failure (max 30s)
  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    const backoff = { ms: 1000 }

    async function tick() {
      if (cancelled) return
      if (cycleRunningRef.current) {
        setTimeout(tick, backoff.ms)
        return
      }
      cycleRunningRef.current = true
      try {
        const res = await fetch("/api/agent/cycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        })
        backoff.ms = res.ok ? 1000 : Math.min(backoff.ms * 2, 30000)
      } catch {
        backoff.ms = Math.min(backoff.ms * 2, 30000)
      } finally {
        cycleRunningRef.current = false
        if (!cancelled) setTimeout(tick, backoff.ms)
      }
    }

    tick()
    return () => { cancelled = true }
  }, [isActive, wallet])

  const handleCopy = () => {
    navigator.clipboard.writeText(status.agentPublicKey)
    setCopied(true)
    toast.success("Agent address copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTogglePrivacy = async (next: boolean) => {
    if (!signMessage) return
    setTogglingPrivacy(true)
    try {
      const message = `agio-auth:${wallet}`
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = Buffer.from(signatureBytes).toString("base64")

      const res = await fetch("/api/agent/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          signature,
          message,
          config: {
            privacyEnabled: next,
            privacyMode: next ? "always" : "never",
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      toast.success(next ? "Privacy mode enabled" : "Privacy mode disabled")
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle privacy")
    } finally {
      setTogglingPrivacy(false)
    }
  }

  const handleToggle = async () => {
    if (!signMessage) return
    setToggling(true)
    try {
      const action = isActive ? "deactivate" : "activate"
      const message = `${action} agent for ${wallet} at ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = Buffer.from(signatureBytes).toString("base64")

      const res = await fetch(`/api/agent/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signature, message }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success(isActive ? "Agent deactivated" : "Agent activated")
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle agent")
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="border-2 border-gray-200 dark:border-gray-800 bg-transparent">
        <CardHeader className="pb-3" />
        <CardContent className="space-y-4">
          {/* Agent Wallet */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground flex-shrink-0">Agent Wallet:</span>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
              {status.agentPublicKey}
            </code>
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
            <a
              href={`https://orbmarkets.io/address/${status.agentPublicKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <img src="/images/orbmarkets.png" alt="OrbMarkets" className="h-5 w-5 rounded hover:opacity-80 transition-opacity" />
            </a>
            <div
              className="flex items-center gap-1.5 flex-shrink-0 ml-1 pl-2 border-l border-border/40"
              title={
                isPrivate
                  ? "Privacy mode: every loan the agent creates or accepts is routed through Cloak (stealth wallets, ZK proofs)."
                  : "Privacy mode is off. Agent transactions are public on-chain."
              }
            >
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Private</span>
              <Switch
                checked={isPrivate}
                disabled={togglingPrivacy}
                onCheckedChange={handleTogglePrivacy}
                aria-label="Toggle privacy mode"
              />
              {togglingPrivacy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {/* Deactivate / Activate button — sits inline with the
                Private toggle so the on/off controls are grouped. */}
            <Button
              size="sm"
              variant={isActive ? "destructive" : "default"}
              className={`flex-shrink-0 ml-1 ${!isActive ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : isActive ? (
                <PowerOff className="h-4 w-4 mr-1" />
              ) : (
                <Power className="h-4 w-4 mr-1" />
              )}
              {isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(status.balances).map(([token, amount]) => (
              <div key={token} className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{amount.toFixed(token === "SOL" ? 4 : 2)}</div>
                <div className="text-xs text-muted-foreground">{token}</div>
              </div>
            ))}
          </div>

          {/* Funding actions — centered at the bottom of the card. */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white border-transparent"
              onClick={() => setShowFund(true)}
            >
              <ArrowUpToLine className="h-4 w-4 mr-1" />
              Fund
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowWithdraw(true)}
            >
              <ArrowDownToLine className="h-4 w-4 mr-1" />
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Config */}
      <AgentConfigForm wallet={wallet} config={status.config} onSaved={onRefresh} />

      {/* History */}
      <AgentHistory wallet={wallet} authQuery={authQuery} />

      {/* Fund Dialog */}
      <AgentFundDialog
        open={showFund}
        onOpenChange={setShowFund}
        agentPublicKey={status.agentPublicKey}
        onSuccess={onRefresh}
      />

      {/* Withdraw Dialog */}
      <AgentWithdrawDialog
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
        wallet={wallet}
        balances={status.balances}
        onSuccess={onRefresh}
      />
    </div>
  )
}
