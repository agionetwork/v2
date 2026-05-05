"use client"

import { useEffect, useState } from "react"
import { Copy, Check, ExternalLink, KeyRound, EyeOff, RefreshCcw } from "lucide-react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletContext } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

interface ViewingKeyResponse {
  scope: string
  key: string
  expiresAt: number
  stealthCount: number
}

const SOLSCAN_BASE =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet"
    ? "https://solscan.io/account"
    : "https://solscan.io/account"

const CLUSTER_QUERY = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet" ? "" : "?cluster=devnet"

function CopyableField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs">
      <span className="flex-1 break-all">{value}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            toast.success(`${label ?? "Copied"}`)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            toast.error("Clipboard not available")
          }
        }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

export default function CompliancePageClient() {
  const { isConnected, address } = useWalletContext()
  const { signMessage } = useWallet()
  const [stealthList, setStealthList] = useState<string[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null) // scope being generated
  const [generated, setGenerated] = useState<Record<string, ViewingKeyResponse>>({})
  const [expiresInDays, setExpiresInDays] = useState(30)

  useEffect(() => {
    if (!isConnected || !address) {
      setStealthList([])
      return
    }
    let cancelled = false
    async function load() {
      setLoadingList(true)
      try {
        const res = await fetch(`/api/private-offer/list?wallet=${address}`, { cache: "no-store" })
        const data = await res.json()
        if (!cancelled && Array.isArray(data?.stealthPublicKeys)) {
          setStealthList(data.stealthPublicKeys)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isConnected, address])

  async function generate(scope: "all" | string) {
    if (!address) return
    if (!signMessage) {
      toast.error("Your wallet does not support message signing.")
      return
    }
    setGenerating(scope)
    try {
      // Auth gate matching the server: signed message proves the caller
      // controls this wallet, so nobody else can mint a viewing key over
      // its stealth set.
      const message = `agio-compliance:${address}`
      const signatureBytes = await signMessage(new TextEncoder().encode(message))
      const signature = Buffer.from(signatureBytes).toString("base64")

      const res = await fetch("/api/compliance/viewing-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, scope, expiresInDays, signature, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || `Request failed (${res.status})`)
        return
      }
      setGenerated((prev) => ({ ...prev, [scope]: data }))
      toast.success("Viewing key generated. Treat it as confidential.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto max-w-3xl py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <EyeOff className="h-5 w-5" /> Privacy & Audit
            </CardTitle>
            <CardDescription>
              Connect your wallet to view your stealth wallets and generate viewing keys for compliance disclosures.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <EyeOff className="h-6 w-6" /> Privacy & Audit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your stealth wallets and disclose loan history to a counterparty or regulator without giving up spend authority.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How viewing keys work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Every stealth wallet you create in Private Mode is bound to a viewing key. The key is a scoped, read-only credential: handing it to an auditor lets them reconstruct the on-chain history of the chosen scope. It does not authorize any transfer.
          </p>
          <p>
            Generate a key here, share it through your normal compliance channel, and the auditor uses Cloak&apos;s audit endpoint to enumerate transactions. Keys can be scoped to a single stealth or to your full set, and they expire on a date you choose.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disclosure scope &amp; expiry</CardTitle>
          <CardDescription>How long the key stays valid after you hand it over.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Expires in (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">Maximum 365 days. Pick the shortest window that covers the audit.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Full disclosure</CardTitle>
          <CardDescription>One key covering every stealth bound to your wallet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button onClick={() => generate("all")} disabled={generating !== null || stealthList.length === 0}>
              <KeyRound className="h-4 w-4 mr-2" />
              {generating === "all" ? "Generating..." : "Generate viewing key"}
            </Button>
            {stealthList.length > 0 && (
              <Badge variant="outline">{stealthList.length} stealth wallet{stealthList.length === 1 ? "" : "s"}</Badge>
            )}
          </div>
          {generated["all"] && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Confidential. Save this key now: it is shown once. Re-generate if you need to share again.
              </p>
              <CopyableField value={generated["all"].key} label="Viewing key copied" />
              <p className="text-xs text-muted-foreground">
                Expires {new Date(generated["all"].expiresAt * 1000).toLocaleString()}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-stealth disclosure</CardTitle>
          <CardDescription>
            Generate a key scoped to a single stealth wallet. Useful when an auditor only needs visibility into one private loan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList && <p className="text-sm text-muted-foreground">Loading stealth wallets...</p>}
          {!loadingList && stealthList.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You have no stealth wallets yet. Create a private offer in Borrow &amp; Lend (toggle &quot;Private&quot; on the form) and a stealth wallet will be minted automatically.
            </p>
          )}
          {!loadingList && stealthList.length > 0 && (
            <ul className="space-y-3">
              {stealthList.map((stealth) => {
                const result = generated[stealth]
                return (
                  <li key={stealth} className="rounded-md border border-border/60 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">Stealth pubkey</div>
                        <CopyableField value={stealth} label="Pubkey copied" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a
                            href={`${SOLSCAN_BASE}/${stealth}${CLUSTER_QUERY}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> Explorer
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => generate(stealth)}
                          disabled={generating !== null}
                        >
                          {generating === stealth
                            ? <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                            : <KeyRound className="h-3 w-3 mr-1" />}
                          {generating === stealth ? "Generating..." : "Viewing key"}
                        </Button>
                      </div>
                    </div>
                    {result && (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 space-y-1">
                        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          Confidential. Save this key now.
                        </p>
                        <CopyableField value={result.key} label="Viewing key copied" />
                        <p className="text-[11px] text-muted-foreground">
                          Expires {new Date(result.expiresAt * 1000).toLocaleString()}.
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">For auditors and counterparties</CardTitle>
          <CardDescription>How a viewing-key recipient turns it into a transaction history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Recipients use Cloak&apos;s audit endpoint to enumerate the transactions covered by the key and decrypt amounts. The key is scoped (one stealth or all of yours) and time-bound, so leaking it after the expiry has no effect.
          </p>
          <p>
            Cloak documentation:{" "}
            <a
              href="https://docs.cloak.ag/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              docs.cloak.ag
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
