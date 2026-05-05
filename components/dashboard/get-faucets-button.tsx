"use client"

import { Droplets, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const IS_DEVNET =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")

export function GetFaucetsButton() {
  if (!IS_DEVNET) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-xs gap-1.5 font-mono uppercase tracking-[0.06em]"
        >
          <Droplets className="h-3.5 w-3.5" />
          Get Free Tokens to Try Devnet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Get devnet test funds</DialogTitle>
          <DialogDescription>
            Agio runs on Solana devnet. Use these official faucets to top up
            test SOL (for fees) and test stablecoins (for borrow / lend offers).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-lg border border-foreground/10 hover:border-foreground/25 hover:bg-foreground/[0.03] transition"
          >
            <div className="flex items-start gap-3">
              <img
                src="/brands/Solana_logo.png"
                alt="Solana"
                className="w-10 h-10 flex-shrink-0 object-contain"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  Solana faucet
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </div>
                <div className="text-xs text-foreground/65 mt-0.5">
                  Airdrop devnet SOL — needed to pay transaction fees.
                </div>
                <div className="text-xs text-foreground/45 mt-1 font-mono truncate">
                  faucet.solana.com
                </div>
              </div>
            </div>
          </a>

          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-lg border border-blue-500/30 hover:border-blue-400 hover:bg-blue-500/[0.06] transition"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-foreground/5">
                <img
                  src="/brands/circle.png"
                  alt="Circle"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  Circle faucet
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </div>
                <div className="text-xs text-foreground/65 mt-0.5">
                  Mint devnet USDC + EURC — the stablecoins you can lend or
                  use as collateral.
                </div>
                <div className="text-xs text-foreground/45 mt-1 font-mono truncate">
                  faucet.circle.com
                </div>
              </div>
            </div>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
