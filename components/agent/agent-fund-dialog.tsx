"use client"

import { useState, useEffect, useCallback } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token"
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
import { TOKEN_MINTS, TOKEN_DECIMALS } from "@/lib/token-mints"

function getTokenImage(token: string): string {
  if (token === "EURC") return "/images/eurc.webp"
  return `/images/${token.toLowerCase()}-logo.png`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentPublicKey: string
  onSuccess: () => void
}

export function AgentFundDialog({ open, onOpenChange, agentPublicKey, onSuccess }: Props) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const [token, setToken] = useState("SOL")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({})

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return
    const balances: Record<string, number> = {}
    try {
      const solBal = await connection.getBalance(publicKey)
      balances.SOL = solBal / LAMPORTS_PER_SOL
    } catch {
      balances.SOL = 0
    }
    for (const symbol of ["USDC", "EURC"]) {
      try {
        const mint = TOKEN_MINTS[symbol]
        if (!mint) continue
        const ata = getAssociatedTokenAddressSync(mint, publicKey)
        const info = await connection.getTokenAccountBalance(ata)
        balances[symbol] = info.value.uiAmount ?? 0
      } catch {
        balances[symbol] = 0
      }
    }
    setWalletBalances(balances)
  }, [publicKey, connection])

  useEffect(() => {
    if (open && publicKey) fetchBalances()
  }, [open, publicKey, fetchBalances])

  // Auto-select first token with balance when balances load
  useEffect(() => {
    if (!open) return
    const available = VALID_TOKENS.filter((t) => (walletBalances[t] || 0) > 0)
    if (available.length > 0 && (walletBalances[token] || 0) === 0) {
      setToken(available[0])
    }
  }, [walletBalances, open, token])

  const handleFund = async () => {
    if (!publicKey || !sendTransaction || !amount) return

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    const available = walletBalances[token] || 0
    if (numAmount > available) {
      toast.error("Insufficient balance")
      return
    }

    setLoading(true)
    try {
      const agentPk = new PublicKey(agentPublicKey)
      const tx = new Transaction()

      if (token === "SOL") {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: agentPk,
            lamports: Math.round(numAmount * LAMPORTS_PER_SOL),
          })
        )
      } else {
        const mint = TOKEN_MINTS[token]
        const decimals = TOKEN_DECIMALS[token] || 6
        const rawAmount = Math.round(numAmount * 10 ** decimals)
        const sourceAta = getAssociatedTokenAddressSync(mint, publicKey)
        const destAta = getAssociatedTokenAddressSync(mint, agentPk)

        // Ensure destination ATA exists
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            publicKey,
            destAta,
            agentPk,
            mint,
          )
        )
        tx.add(
          createTransferInstruction(sourceAta, destAta, publicKey, rawAmount)
        )
      }

      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, "confirmed")

      toast.success(`Sent ${amount} ${token} to agent`)
      onOpenChange(false)
      setAmount("")
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Transfer failed")
    } finally {
      setLoading(false)
    }
  }

  const currentBalance = walletBalances[token] || 0
  const availableTokens = VALID_TOKENS.filter((t) => (walletBalances[t] || 0) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund Agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Amount</Label>
              <button
                className="text-xs text-blue-600 hover:text-blue-700"
                onClick={() => {
                  const max = token === "SOL"
                    ? Math.max(0, currentBalance - 0.01)
                    : currentBalance
                  setAmount(String(max))
                }}
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
                  {availableTokens.length === 0 ? (
                    <SelectItem value={token} disabled>
                      No tokens available
                    </SelectItem>
                  ) : (
                    availableTokens.map((t) => (
                      <SelectItem key={t} value={t}>
                        <div className="flex items-center gap-2">
                          <img src={getTokenImage(t)} alt={t} className="w-4 h-4" />
                          <span>{t}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Available: {currentBalance.toFixed(token === "SOL" ? 4 : 2)} {token}
            </p>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleFund}
            disabled={loading || !amount}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Fund {amount ? `${amount} ${token}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
