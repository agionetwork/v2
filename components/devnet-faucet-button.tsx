"use client"

import { useState } from "react"
import { Droplets, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWalletContext } from "@/components/wallet-provider"
import { toast } from "sonner"

const IS_DEVNET =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")

export function DevnetFaucetButton() {
  const { isConnected, address } = useWalletContext()
  const [loading, setLoading] = useState<"sol" | "tokens" | null>(null)

  if (!IS_DEVNET) return null

  async function request(type: "sol" | "tokens") {
    if (!isConnected || !address) {
      toast.error("Connect your wallet first.")
      return
    }
    setLoading(type)
    try {
      const res = await fetch("/api/devnet/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, type }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.externalUrl) {
          toast.error(data.error, {
            action: { label: "Open faucet", onClick: () => window.open(data.externalUrl, "_blank") },
          })
        } else {
          toast.error(data?.error || `Request failed (${res.status})`)
        }
        return
      }
      if (type === "sol") {
        toast.success(`Airdropped 1 SOL to your wallet.`)
      } else {
        toast.success(`Requested USDC + EURC from Circle. Funds arrive in seconds.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Droplets className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Faucet</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Devnet faucet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={loading !== null}
          onClick={() => request("sol")}
          className="cursor-pointer"
        >
          {loading === "sol" ? "Requesting..." : "Get 1 SOL"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={loading !== null}
          onClick={() => request("tokens")}
          className="cursor-pointer"
        >
          {loading === "tokens" ? "Requesting..." : "Get USDC + EURC"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between cursor-pointer"
          >
            faucet.solana.com
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between cursor-pointer"
          >
            faucet.circle.com
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
