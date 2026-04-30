"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWalletContext } from "@/components/wallet-provider"
import { useAgentAuth } from "@/hooks/useAgentAuth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Wallet, ShieldCheck } from "lucide-react"
import { CreateAgentCard } from "./create-agent-card"
import { AgentDashboard } from "./agent-dashboard"

interface AgentStatus {
  config: any
  agentPublicKey: string
  balances: Record<string, number>
}

export function AgentPanel() {
  const { isConnected, address } = useWalletContext()
  const { getAuthQuery, clearAuth } = useAgentAuth()
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [needsSign, setNeedsSign] = useState(false)
  const [authQuery, setAuthQuery] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!address) return

    const auth = await getAuthQuery()
    if (!auth) {
      if (!hasLoadedRef.current) {
        setNeedsSign(true)
        setLoading(false)
      }
      return
    }

    setNeedsSign(false)
    setAuthQuery(auth)

    // Only show loading spinner on initial load
    if (!hasLoadedRef.current) {
      setLoading(true)
    }
    try {
      const res = await fetch(`/api/agent/status?wallet=${address}&${auth}`)
      if (res.status === 404) {
        setNotFound(true)
        setStatus(null)
      } else if (res.status === 503) {
        setNotFound(true)
        setStatus(null)
      } else if (res.ok) {
        const data = await res.json()
        setStatus(data)
        setNotFound(false)
      } else if (res.status === 401) {
        // Signature invalid — clear cache and ask to re-sign
        clearAuth()
        setNeedsSign(true)
      }
      hasLoadedRef.current = true
    } catch {
      if (!hasLoadedRef.current) {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [address, getAuthQuery, clearAuth])

  useEffect(() => {
    if (isConnected && address) {
      fetchStatus()

      // Auto-refresh balances every 15 seconds
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = setInterval(fetchStatus, 15000)
    } else {
      setLoading(false)
      hasLoadedRef.current = false
      setNeedsSign(false)
      setAuthQuery(null)
    }

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [isConnected, address, fetchStatus])

  if (!isConnected || !address) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">Connect your wallet</p>
          <p className="text-sm">Connect your wallet to manage your AI Agent.</p>
        </CardContent>
      </Card>
    )
  }

  if (needsSign) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">Verify wallet ownership</p>
          <p className="text-sm mb-4">Sign a message to access your agent dashboard.</p>
          <Button onClick={fetchStatus}>Sign & Continue</Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (notFound || !status) {
    return <CreateAgentCard wallet={address} onCreated={fetchStatus} />
  }

  return (
    <AgentDashboard
      wallet={address}
      status={status}
      onRefresh={fetchStatus}
      authQuery={authQuery || ""}
    />
  )
}
