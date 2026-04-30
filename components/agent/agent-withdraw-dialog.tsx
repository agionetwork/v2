"use client"

import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { VALID_TOKENS } from "@/lib/agent/types"

function getTokenImage(token: string): string {
  if (token === "EURC") return "/images/eurc.webp"
  return `/images/${token.toLowerCase()}-logo.png`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallet: string
  balances: Record<string, number>
  onSuccess: () => void
}

export function AgentWithdrawDialog({ open, onOpenChange, wallet, balances, onSuccess }: Props) {
  const { signMessage } = useWallet()
  const [token, setToken] = useState("SOL")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const handleWithdraw = async () => {
    if (!signMessage || !amount) return

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    if (numAmount > (balances[token] || 0)) {
      toast.error("Insufficient balance")
      return
    }

    setLoading(true)
    try {
      const message = `withdraw ${amount} ${token} from agent ${wallet} at ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = Buffer.from(signatureBytes).toString("base64")

      const res = await fetch("/api/agent/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          signature,
          message,
          token,
          amount: numAmount,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success(`Withdrawn ${amount} ${token}`)
      onOpenChange(false)
      setAmount("")
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Withdraw failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from Agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Amount</Label>
              <button
                className="text-xs text-blue-600 hover:text-blue-700"
                onClick={() => setAmount(String(balances[token] || 0))}
              >
                Max
              </button>
            </div>
            <div className="flex">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step="any"
                className="rounded-r-none border-r-0"
              />
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger className="w-[130px] rounded-l-none bg-transparent">
                  <div className="flex items-center gap-1.5">
                    <img src={getTokenImage(token)} alt={token} className="w-4 h-4" />
                    <span>{token}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {VALID_TOKENS.map((t) => (
                    <SelectItem key={t} value={t}>
                      <div className="flex items-center gap-2">
                        <img src={getTokenImage(t)} alt={t} className="w-4 h-4" />
                        <span>{t}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Available: {(balances[token] || 0).toFixed(token === "SOL" ? 4 : 2)} {token}
            </p>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleWithdraw}
            disabled={loading || !amount}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Withdraw {amount ? `${amount} ${token}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
