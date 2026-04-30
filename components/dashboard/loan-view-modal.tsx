"use client"

import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { PublicKey } from "@solana/web3.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { type ParsedLoan, getStatusLabel, LoanStatus, formatDuration } from "@/hooks/useLoans"
import { useLoans } from "@/hooks/useLoans"
import { useLoanContract } from "@/hooks/useLoanContract"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { solscanClusterParam } from "@/config/solana"
import Link from "next/link"
import { Link2, Twitter, Share2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useTokenPrices } from "@/hooks/useTokenPrices"
import { getBlinkUrl, getTwitterShareUrl } from "@/lib/blinks"

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}

const getTokenDisplaySymbol = (symbol: string): string => {
  if (symbol === 'bSOL') return 'agioSOL'
  return symbol
}

function CounterpartyDisplay({ address }: { address: string | null }) {
  const { displayName, profileWallet } = useWalletProfile(address)
  if (!address) return <p className="font-medium text-sm">Open</p>
  return (
    <Link
      href={`/socialfi/profile/${profileWallet || address}`}
      className="font-medium text-sm text-blue-600 dark:text-blue-400 hover:underline"
    >
      {displayName || shortenAddress(address)}
    </Link>
  )
}

const ExplorerLink = ({ address }: { address: string }) => (
  <a
    href={`https://solscan.io/account/${address}${solscanClusterParam()}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center hover:opacity-80 transition-opacity ml-1"
    title="View on Solscan"
  >
    <img src="/images/solscan-logo.webp" alt="Solscan" className="w-4 h-4 rounded-sm" />
  </a>
)

interface LoanViewModalProps {
  loan: ParsedLoan | null
  isOpen: boolean
  onClose: () => void
  onRepaySuccess?: () => void
  onCancelSuccess?: () => void
  onAcceptSuccess?: () => void
}

interface RepayModalProps {
  loan: ParsedLoan
  isOpen: boolean
  onClose: () => void
  onRepaySuccess?: () => void
}

function RepayModal({ loan, isOpen, onClose, onRepaySuccess }: RepayModalProps) {
  const { repayLoan } = useLoanContract()
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const { refetch, agentWallet } = useLoans()
  const { postActivity } = useTapestryProfile()
  const [repaymentType, setRepaymentType] = useState("full")
  const [repaymentAmount, setRepaymentAmount] = useState<number | string>(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const busyRef = useRef(false)

  const interest = loan.debtAmountUi * loan.apy / 100 * loan.duration / (365 * 86400)
  const totalOwed = loan.debtAmountUi + interest

  const handleRepay = useCallback(async () => {
    if (busyRef.current) return
    if (!loan.lender) {
      toast.error("Cannot repay: no lender set on this loan")
      return
    }

    busyRef.current = true
    setIsProcessing(true)
    try {
      // On-chain repay_amount must be <= remaining debt_amount (principal).
      // The program adds interest internally on full repay.
      const rawAmount = repaymentType === "full"
        ? loan.debtAmountUi
        : (typeof repaymentAmount === "string" ? parseFloat(repaymentAmount) : repaymentAmount)
      const amount = Math.min(rawAmount, loan.debtAmountUi)

      if (!amount || amount <= 0) {
        toast.error("Please enter a valid repayment amount")
        setIsProcessing(false)
        busyRef.current = false
        return
      }

      // Detect if this loan belongs to the agent wallet (not the connected wallet).
      // Agent-created loans can only be repaid through the agent — the connected
      // wallet can't sign on behalf of the agent.
      const connectedWallet = publicKey?.toBase58()
      const isAgentLoan = agentWallet && loan.borrower === agentWallet && loan.borrower !== connectedWallet

      if (isAgentLoan) {
        const shortAgent = agentWallet.slice(0, 4) + '...' + agentWallet.slice(-4)
        toast.error("This loan belongs to your agent wallet", {
          description: `Send ${amount.toFixed(4)} ${getTokenDisplaySymbol(loan.debtTokenSymbol)} to your agent wallet (${shortAgent}) and use the agent to repay. You cannot repay directly from your connected wallet.`,
          duration: 8000,
        })
        setIsProcessing(false)
        busyRef.current = false
        return
      }

      const txSig = await repayLoan({
        loanPda: new PublicKey(loan.publicKey),
        repayAmount: amount,
        debtTokenSymbol: loan.debtTokenSymbol,
        collateralTokenSymbol: loan.collateralTokenSymbol,
        lender: new PublicKey(loan.lender),
      })

      toast.success(
        repaymentType === "full" ? "Loan fully repaid!" : "Partial repayment successful!",
        { description: `Repaid ${amount.toFixed(2)} ${getTokenDisplaySymbol(loan.debtTokenSymbol)}` }
      )
      postActivity("repaid", {
        debtToken: loan.debtTokenSymbol,
        collateralToken: loan.collateralTokenSymbol,
        amount,
      })
      // Wait for tx confirmation so refetch sees updated on-chain data
      if (txSig) {
        await connection.confirmTransaction(txSig, 'confirmed').catch(() => {})
      }
      await refetch().catch(() => {})
      onClose()
      onRepaySuccess?.()
    } catch (error: any) {
      console.error('Repay failed:', error)
      toast.error("Repayment failed", {
        description: error.message || "Please try again."
      })
    } finally {
      setIsProcessing(false)
      busyRef.current = false
    }
  }, [loan, repaymentType, repaymentAmount, totalOwed, repayLoan, refetch, onClose, onRepaySuccess])

  const handleRepaymentTypeChange = (value: string) => {
    setRepaymentType(value)
    if (value === "full") {
      setRepaymentAmount(totalOwed)
    } else {
      setRepaymentAmount("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Repay Loan</DialogTitle>
          <DialogDescription>
            Choose how you would like to repay this loan
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Repayment Type</label>
            <Select value={repaymentType} onValueChange={handleRepaymentTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select repayment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Repayment</SelectItem>
                <SelectItem value="partial">Partial Repayment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {repaymentType === "partial" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Repayment Amount ({getTokenDisplaySymbol(loan.debtTokenSymbol)})</label>
              <Input
                type="number"
                value={repaymentAmount}
                onChange={(e) => setRepaymentAmount(e.target.value)}
                placeholder="Enter amount"
                min={0}
                max={totalOwed}
                step={0.01}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Loan Details</label>
            <div className="text-sm rounded-md bg-muted p-3">
              <div className="flex justify-between mb-1">
                <span>Principal:</span>
                <span className="font-medium">{loan.debtAmountUi.toFixed(2)} {getTokenDisplaySymbol(loan.debtTokenSymbol)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Interest:</span>
                <span className="font-medium">{interest.toFixed(4)} {getTokenDisplaySymbol(loan.debtTokenSymbol)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total Owed:</span>
                <span>{totalOwed.toFixed(4)} {getTokenDisplaySymbol(loan.debtTokenSymbol)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleRepay}
            disabled={isProcessing || (repaymentType === "partial" && (!repaymentAmount || parseFloat(repaymentAmount.toString()) <= 0))}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? "Confirming..." : "Confirm Repayment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AddCollateralModalProps {
  loan: ParsedLoan
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

function AddCollateralModal({ loan, isOpen, onClose, onSuccess }: AddCollateralModalProps) {
  const { addCollateral } = useLoanContract()
  const [amount, setAmount] = useState<number | string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const busyRef = useRef(false)

  const handleAddCollateral = useCallback(async () => {
    if (busyRef.current) return

    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    busyRef.current = true
    setIsProcessing(true)
    try {
      await addCollateral({
        loanPda: new PublicKey(loan.publicKey),
        amount: parsedAmount,
        collateralTokenSymbol: loan.collateralTokenSymbol,
        debtMint: loan.debtMint,
      })

      toast.success("Collateral added successfully!", {
        description: `Added ${parsedAmount} ${getTokenDisplaySymbol(loan.collateralTokenSymbol)} collateral`
      })
      onClose()
      onSuccess?.()
    } catch (error: any) {
      console.error('Add collateral failed:', error)
      toast.error("Failed to add collateral", {
        description: error.message || "Please try again."
      })
    } finally {
      setIsProcessing(false)
      busyRef.current = false
    }
  }, [loan, amount, addCollateral, onClose, onSuccess])

  const parsedAmount = typeof amount === "string" ? parseFloat(amount) || 0 : amount

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add Collateral</DialogTitle>
          <DialogDescription>
            Add more collateral to reduce liquidation risk
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Amount ({getTokenDisplaySymbol(loan.collateralTokenSymbol)})</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min={0}
              step={0.0001}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Collateral Summary</label>
            <div className="text-sm rounded-md bg-muted p-3">
              <div className="flex justify-between mb-1">
                <span>Current Collateral:</span>
                <span className="font-medium">{loan.collateralAmountUi.toFixed(4)} {getTokenDisplaySymbol(loan.collateralTokenSymbol)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Adding:</span>
                <span className="font-medium text-green-500">+{parsedAmount.toFixed(4)} {getTokenDisplaySymbol(loan.collateralTokenSymbol)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>New Total:</span>
                <span>{(loan.collateralAmountUi + parsedAmount).toFixed(4)} {getTokenDisplaySymbol(loan.collateralTokenSymbol)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-center gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleAddCollateral}
            disabled={isProcessing || !parsedAmount || parsedAmount <= 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? "Confirming..." : "Add Collateral"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function LoanViewModal({ loan, isOpen, onClose, onRepaySuccess, onCancelSuccess, onAcceptSuccess }: LoanViewModalProps) {
  const { publicKey } = useWallet()
  const { isMyWallet } = useLoans()
  const { rescindBorrowOffer, rescindLendOffer, acceptBorrowOffer, acceptLendOffer, forecloseLoan } = useLoanContract()
  const { postActivity } = useTapestryProfile()
  const { prices } = useTokenPrices()
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false)
  const [isAddCollateralModalOpen, setIsAddCollateralModalOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isForeclosing, setIsForeclosing] = useState(false)
  const busyRef = useRef(false)

  if (!loan) return null

  // Match both owner wallet and agent wallet for role detection
  const isBorrower = isMyWallet(loan.borrower)
  const isLender = isMyWallet(loan.lender)
  const counterparty = isBorrower ? loan.lender : loan.borrower
  const isActive = loan.status === LoanStatus.Accepted
  const isPending = loan.status === LoanStatus.Pending
  const isExpired = isActive && loan.start != null && (Date.now() / 1000) > (loan.start + loan.duration)
  const canForeclose = isExpired && !!isLender
  // Only the creator of the offer can cancel it:
  // - Public offers (privateStatus=0): only one field set, so isLender/isBorrower = creator
  // - PrivateBorrower (1): lender created via create_borrow_offer → only lender cancels
  // - PrivateLender (2): borrower created via create_lend_offer → only borrower cancels
  const canCancel = isPending && (
    (loan.privateStatus === 0 && (isLender || isBorrower)) ||
    (loan.privateStatus === 1 && !!isLender) ||
    (loan.privateStatus === 2 && !!isBorrower)
  )
  // Recipient of a private offer can accept or decline:
  // - PrivateBorrower (1): lender created → borrower is target → borrower can accept
  // - PrivateLender (2): borrower created → lender is target → lender can accept
  const canAccept = isPending && (
    (loan.privateStatus === 1 && !!isBorrower) ||
    (loan.privateStatus === 2 && !!isLender)
  )
  const interest = loan.debtAmountUi * loan.apy / 100 * loan.duration / (365 * 86400)
  const statusLabel = getStatusLabel(loan.status)

  // Compute live collateral ratio from oracle prices
  const colPrice = prices[loan.collateralTokenSymbol]?.price || 0
  const debtPrice = prices[loan.debtTokenSymbol]?.price || 0
  const colValueUsd = loan.collateralAmountUi * colPrice
  const debtValueUsd = loan.debtAmountUi * debtPrice
  const collateralRatio = debtValueUsd > 0 ? (colValueUsd / debtValueUsd) * 100 : 0
  const isUndercollateralized = colPrice > 0 && debtPrice > 0 && collateralRatio < 130
  const isWarningRatio = colPrice > 0 && debtPrice > 0 && collateralRatio >= 130 && collateralRatio < 150

  const statusColor =
    loan.status === LoanStatus.Repaid ? "bg-green-900 text-green-400" :
    loan.status === LoanStatus.Accepted ? "bg-blue-900 text-blue-400" :
    loan.status === LoanStatus.Pending ? "bg-yellow-600 text-white" :
    "bg-red-900 text-red-400"

  return (
    <>
      <Dialog open={isOpen && !isRepayModalOpen && !isAddCollateralModalOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Loan Details</DialogTitle>
            <DialogDescription>View complete details of this loan</DialogDescription>
          </DialogHeader>

          {isExpired && (
            <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              This loan has expired. {isLender
                ? "You can foreclose to claim the borrower's collateral."
                : "The lender may foreclose this loan and claim your collateral."}
            </div>
          )}

          {isPending && isUndercollateralized && (
            <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              Collateral ratio is {collateralRatio.toFixed(1)}% (below 130% minimum). This offer will be automatically cancelled and locked funds returned to the creator.
            </div>
          )}

          {isPending && isWarningRatio && (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
              Collateral ratio is {collateralRatio.toFixed(1)}% (below the 150% creation threshold but still acceptable). If it drops below 130%, this offer will be automatically cancelled.
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <Badge variant="outline" className={
                isBorrower ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                "bg-green-500/10 text-green-500 border-green-500/20"
              }>
                {isBorrower ? "Borrowed" : "Lent"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge className={statusColor}>{statusLabel}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Amount</p>
              <p className="font-medium">{loan.debtAmountUi.toFixed(2)} {getTokenDisplaySymbol(loan.debtTokenSymbol)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Collateral</p>
              <p className="font-medium">{loan.collateralAmountUi.toFixed(4)} {getTokenDisplaySymbol(loan.collateralTokenSymbol)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Counterparty</p>
              <div className="flex items-center">
                <CounterpartyDisplay address={counterparty} />
                {counterparty && <ExplorerLink address={counterparty} />}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">APY</p>
              <p className="font-medium">{loan.apy}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Interest</p>
              <p className="font-medium text-red-500">{interest.toFixed(4)} {getTokenDisplaySymbol(loan.debtTokenSymbol)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="font-medium">{formatDuration(loan.duration)}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
              <p className="font-medium">{loan.start ? new Date(loan.start * 1000).toLocaleDateString() : 'Pending'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Due Date</p>
              {loan.start ? (
                <p className={`font-medium ${isExpired ? 'text-red-500' : ''}`}>
                  {new Date((loan.start + loan.duration) * 1000).toLocaleDateString()}
                  {isExpired && ' (Expired)'}
                </p>
              ) : (
                <p className="font-medium">Pending</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Loan Address</p>
              <div className="flex items-center">
                <p className="font-medium font-mono text-sm">{shortenAddress(loan.publicKey)}</p>
                <ExplorerLink address={loan.publicKey} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-center gap-4 mt-4">
            {canForeclose ? (
              <>
                <Button
                  variant="destructive"
                  className="px-6"
                  disabled={isForeclosing}
                  onClick={async () => {
                    if (busyRef.current) return
                    busyRef.current = true
                    setIsForeclosing(true)
                    try {
                      await forecloseLoan({
                        loanPda: new PublicKey(loan.publicKey),
                        collateralTokenSymbol: loan.collateralTokenSymbol,
                      })
                      toast.success("Loan foreclosed successfully!", {
                        description: `Collateral of ${loan.collateralAmountUi.toFixed(4)} ${getTokenDisplaySymbol(loan.collateralTokenSymbol)} has been transferred to your wallet.`
                      })
                      postActivity("foreclosed", {
                        debtToken: loan.debtTokenSymbol,
                        collateralToken: loan.collateralTokenSymbol,
                        amount: loan.debtAmountUi,
                      })
                      onClose()
                      onCancelSuccess?.()
                    } catch (error: any) {
                      console.error('Foreclose failed:', error)
                      toast.error("Foreclosure failed", {
                        description: error.message || "Please try again."
                      })
                    } finally {
                      setIsForeclosing(false)
                      busyRef.current = false
                    }
                  }}
                >
                  {isForeclosing ? "Foreclosing..." : "Foreclose Loan"}
                </Button>
                <Button onClick={onClose} variant="outline" className="px-6">Close</Button>
              </>
            ) : isActive && isBorrower ? (
              <>
                <Button
                  onClick={() => setIsAddCollateralModalOpen(true)}
                  variant="outline"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  Add Collateral
                </Button>
                <Button
                  onClick={() => setIsRepayModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  Repay Loan
                </Button>
                <Button onClick={onClose} variant="outline" className="px-6">Close</Button>
              </>
            ) : canAccept ? (
              <>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  disabled={isAccepting}
                  onClick={async () => {
                    if (busyRef.current) return
                    busyRef.current = true
                    setIsAccepting(true)
                    try {
                      const params = {
                        loanPublicKey: loan.publicKey,
                        createKey: loan.createKey,
                        debtMint: loan.debtMint,
                        collateralMint: loan.collateralMint,
                        debtTokenSymbol: loan.debtTokenSymbol,
                        collateralTokenSymbol: loan.collateralTokenSymbol,
                        debtAmountUi: loan.debtAmountUi,
                        collateralAmountUi: loan.collateralAmountUi,
                        borrower: loan.borrower || undefined,
                        lender: loan.lender || undefined,
                      }
                      // PrivateBorrower (1): borrower accepts → acceptBorrowOffer
                      // PrivateLender (2): lender accepts → acceptLendOffer
                      if (loan.privateStatus === 1) {
                        await acceptBorrowOffer(params)
                      } else {
                        await acceptLendOffer(params)
                      }
                      toast.success("Offer accepted successfully!")
                      postActivity("accepted", {
                        debtToken: loan.debtTokenSymbol,
                        collateralToken: loan.collateralTokenSymbol,
                        amount: loan.debtAmountUi,
                        apy: loan.apy,
                      })
                      onClose()
                      onAcceptSuccess?.()
                    } catch (error: any) {
                      console.error('Accept failed:', error)
                      toast.error("Failed to accept offer", {
                        description: error.message || "Please try again."
                      })
                    } finally {
                      setIsAccepting(false)
                      busyRef.current = false
                    }
                  }}
                >
                  {isAccepting ? "Confirming..." : "Accept"}
                </Button>
                <Button onClick={onClose} variant="outline" className="px-6">Decline</Button>
              </>
            ) : canCancel ? (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9" title="Share">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1 z-[100000]" align="start">
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded hover:bg-muted"
                      onClick={() => {
                        navigator.clipboard.writeText(getBlinkUrl(loan.publicKey))
                        toast.success("Blink link copied!")
                      }}
                    >
                      <Link2 className="h-4 w-4" /> Copy Blink link
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded hover:bg-muted"
                      onClick={() => {
                        const desc = `${loan.debtAmountUi.toFixed(2)} ${getTokenDisplaySymbol(loan.debtTokenSymbol)} at ${loan.apy}% APY on @aglonetwork`
                        window.open(getTwitterShareUrl(getBlinkUrl(loan.publicKey), desc), "_blank")
                      }}
                    >
                      <Twitter className="h-4 w-4" /> Share on X
                    </button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="destructive"
                  className="px-6"
                  disabled={isCancelling}
                  onClick={async () => {
                    if (busyRef.current) return
                    busyRef.current = true
                    setIsCancelling(true)
                    try {
                      const params = {
                        loanPublicKey: loan.publicKey,
                        debtMint: loan.debtMint,
                        collateralMint: loan.collateralMint,
                        debtTokenSymbol: loan.debtTokenSymbol,
                        collateralTokenSymbol: loan.collateralTokenSymbol,
                      }
                      if (isLender) {
                        await rescindBorrowOffer(params)
                      } else {
                        await rescindLendOffer(params)
                      }
                      toast.success("Offer cancelled successfully")
                      onClose()
                      onCancelSuccess?.()
                    } catch (error: any) {
                      console.error('Cancel failed:', error)
                      toast.error("Failed to cancel offer", {
                        description: error.message || "Please try again."
                      })
                    } finally {
                      setIsCancelling(false)
                      busyRef.current = false
                    }
                  }}
                >
                  {isCancelling ? "Cancelling..." : "Cancel Offer"}
                </Button>
                <Button onClick={onClose} variant="outline" className="px-6">Close</Button>
              </>
            ) : (
              <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white px-6">Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isRepayModalOpen && loan && (
        <RepayModal
          loan={loan}
          isOpen={isRepayModalOpen}
          onClose={() => setIsRepayModalOpen(false)}
          onRepaySuccess={() => {
            setIsRepayModalOpen(false)
            onRepaySuccess?.()
          }}
        />
      )}

      {isAddCollateralModalOpen && loan && (
        <AddCollateralModal
          loan={loan}
          isOpen={isAddCollateralModalOpen}
          onClose={() => setIsAddCollateralModalOpen(false)}
          onSuccess={() => {
            setIsAddCollateralModalOpen(false)
            onRepaySuccess?.()
          }}
        />
      )}
    </>
  )
}
