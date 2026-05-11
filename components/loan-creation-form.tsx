"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Icons } from "@/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TermTooltip } from "@/components/term-tooltip"
import { useLoanContract } from "@/hooks/useLoanContract"
import { usePrivateLoanFlow, type PrivateLoanProgress } from "@/hooks/usePrivateLoanFlow"
import { useTokenPrices } from "@/hooks/useTokenPrices"
import { useWalletTokens } from "@/hooks/useWalletTokens"
import { estimatePrivateLoanCost, formatCostLines } from "@/lib/cloak/cost-estimator"
import { Check, X, Loader2, Wand2, ShieldCheck, FileSignature, PartyPopper, ArrowUpDown } from "lucide-react"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { toast } from "sonner"
import { useSNS } from "@/hooks/useSNS"
import { useRiskClamps } from "@/hooks/useRiskClamps"
import { RiskZoneBar } from "@/components/loan/risk-zone-bar"
import { WorstCasePreview } from "@/components/loan/worst-case-preview"
import { MAX_APY_PCT, isLoanSafe } from "@/lib/loan-math"

const MODE_CONFIG = {
  borrow: {
    title: "CREATE BORROW REQUEST",
    amountTooltip: "The amount you want to borrow in the selected token.",
    collateralTooltip: "The token and amount you will provide as collateral for this loan.",
    percentageTooltip:
      "The percentage of collateral relative to the loan amount. Higher percentages provide more security for lenders.",
    privacyLabel: "SET PRIVATE LENDER?",
    privacyTooltip:
      "Route this offer through Cloak: shielded transfers and a stealth address hide the lender's wallet and amount on-chain. Subject to a privacy premium and ZK proof costs.",
    exclusiveLabel: "SET EXCLUSIVE COUNTERPARTY?",
    exclusiveTooltip:
      "Restrict who can accept this offer to a specific wallet or .sol domain. The offer is still posted on-chain — only acceptance is gated to that counterparty.",
    contractFn: "createBorrowRequest" as const,
    successMsg: "Borrow offer created!",
    loanType: "borrow" as const,
  },
  lend: {
    title: "CREATE LEND OFFER",
    amountTooltip: "The amount you want to lend in the selected token.",
    collateralTooltip: "The token and amount you require as collateral for this loan.",
    percentageTooltip:
      "The percentage of collateral you require relative to the loan amount. Higher percentages provide more security for your loan.",
    privacyLabel: "SET PRIVATE BORROWER?",
    privacyTooltip:
      "Route this offer through Cloak: shielded transfers and a stealth address hide the borrower's wallet and amount on-chain. Subject to a privacy premium and ZK proof costs.",
    exclusiveLabel: "SET EXCLUSIVE COUNTERPARTY?",
    exclusiveTooltip:
      "Restrict who can accept this offer to a specific wallet or .sol domain. The offer is still posted on-chain — only acceptance is gated to that counterparty.",
    contractFn: "createLendOffer" as const,
    successMsg: "Lend offer created!",
    loanType: "lend" as const,
  },
}

interface LoanCreationFormProps {
  mode: "borrow" | "lend"
}

export function LoanCreationForm({ mode }: LoanCreationFormProps) {
  const config = MODE_CONFIG[mode]
  const contract = useLoanContract()
  const { isConnected, publicKey, isValidSolanaAddress } = contract
  const createLoan = contract[config.contractFn]
  const { createPrivateLoan } = usePrivateLoanFlow()
  const { postActivity } = useTapestryProfile()
  const { getAddress, isSolDomain } = useSNS()
  const { prices, getTokenPrice, isPriceReliable } = useTokenPrices()
  const { tokens: walletTokens, isLoading: tokensLoading } = useWalletTokens()
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [loanAmount, setLoanAmount] = useState(1000)
  const [loanTerm, setLoanTerm] = useState(30)
  const [apy, setApy] = useState(5)
  const [token, setToken] = useState("USDC")
  const [tokenCollateral, setTokenCollateral] = useState("SOL")
  const [collateralAmount, setCollateralAmount] = useState(1000)
  const [userModifiedField, setUserModifiedField] = useState<"amount" | "collateral" | null>(null)
  const [collateralPercentage, setCollateralPercentage] = useState(150)
  const [receiverAddress, setReceiverAddress] = useState("")
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resolving, setResolving] = useState(false)
  const [isExclusive, setIsExclusive] = useState("no")
  const [isExclusiveWarningOpen, setIsExclusiveWarningOpen] = useState(false)
  const [usePrivacy, setUsePrivacy] = useState("no")
  const [privateStage, setPrivateStage] = useState<PrivateLoanProgress | "success" | "error" | null>(null)
  const [privateError, setPrivateError] = useState<string | null>(null)
  const [privateTxHash, setPrivateTxHash] = useState<string | null>(null)

  const handleCreateLoan = async () => {
    if (isExclusive === "yes") {
      const trimmed = receiverAddress.trim()
      if (!trimmed) {
        setIsExclusiveWarningOpen(true)
        return
      }
      if (isSolDomain(trimmed)) {
        setResolving(true)
        try {
          const resolved = await getAddress(trimmed)
          if (!resolved) {
            setErrors((prev) => ({ ...prev, receiverAddress: `Could not resolve "${trimmed}"` }))
            return
          }
          if (isSelfAddress(resolved)) {
            setErrors((prev) => ({ ...prev, receiverAddress: "You cannot use your own wallet address." }))
            return
          }
          setReceiverAddress(resolved)
          toast.success(`Resolved ${trimmed} to ${resolved.slice(0, 4)}...${resolved.slice(-4)}`)
        } catch {
          setErrors((prev) => ({ ...prev, receiverAddress: `Failed to resolve "${trimmed}"` }))
          return
        } finally {
          setResolving(false)
        }
      } else {
        if (!isValidSolanaAddress(trimmed)) {
          setErrors((prev) => ({ ...prev, receiverAddress: "Invalid Solana wallet address" }))
          return
        }
        if (isSelfAddress(trimmed)) {
          setErrors((prev) => ({ ...prev, receiverAddress: "You cannot use your own wallet address." }))
          return
        }
      }
    }
    if (!validateForm()) return
    setIsSummaryDialogOpen(true)
  }

  const handleConfirmLoan = async () => {
    if (!publicKey || !isConnected) {
      toast.error("Please connect your wallet first")
      return
    }

    try {
      setIsLoading(true)
      const durationInSeconds = loanTerm * 24 * 60 * 60

      let tx: string
      if (usePrivacy === "yes") {
        // Private path: surface stage progress in the modal (replaces the
        // loan summary while the flow runs). No bottom-left toasts in
        // private mode — they would just duplicate the modal content.
        setPrivateStage("init")
        setPrivateError(null)
        setPrivateTxHash(null)
        const result = await createPrivateLoan(
          {
            mode: mode === "lend" ? "lend" : "borrow",
            debtTokenSymbol: token,
            collateralTokenSymbol: tokenCollateral,
            debtAmount: loanAmount,
            collateralAmount,
            duration: durationInSeconds,
            apy: Math.round(apy),
          },
          (stage) => setPrivateStage(stage),
        )
        tx = result.txHash
        setPrivateStage("success")
        setPrivateTxHash(tx)
      } else {
        tx = await createLoan({
          debtAmount: loanAmount,
          collateralAmount,
          duration: durationInSeconds,
          apy: Math.round(apy),
          debtTokenSymbol: token,
          collateralTokenSymbol: tokenCollateral,
          isExclusive: !!receiverAddress,
          exclusiveCounterparty: receiverAddress || undefined,
          usePrivacy: false,
        })
      }
      toast.success(`${config.successMsg} TX: ${tx.slice(0, 8)}...`, {
        description: "View on OrbMarkets",
        action: { label: "↗", onClick: () => window.open("https://orbmarkets.io", "_blank") },
        duration: 10000,
      })
      postActivity("created", {
        loanType: config.loanType,
        debtToken: token,
        collateralToken: tokenCollateral,
        amount: loanAmount,
        collateralAmount,
        apy: Math.round(apy),
        duration: durationInSeconds,
        txSignature: tx,
      })
      // Notify followers via Dialect (fire-and-forget)
      fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "loan_created_network",
          recipientWallet: publicKey.toBase58(),
          details: { debtToken: token, amount: loanAmount, apy: Math.round(apy), loanType: config.loanType },
        }),
      }).catch(() => {})
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 3000)
      // Private mode: keep the modal open on the success screen so the user
      // can see the txHash + close manually. Public mode closes immediately.
      if (usePrivacy !== "yes") {
        setIsSummaryDialogOpen(false)
        resetForm()
      }
    } catch (error: any) {
      const raw = error?.message || "Error creating loan"
      console.error("[loan-creation-form] error:", error)
      let msg = raw
      const depositSymbol = mode === "borrow" ? tokenCollateral : token
      // In privacy mode the flow has many stages (Cloak shield/unshield, stealth
      // sign, server-side broadcast). Show the raw message so the user — and
      // we — can see exactly which stage failed instead of swallowing into a
      // generic "Network error" string.
      if (usePrivacy === "yes") {
        msg = `Private flow failed: ${raw}`
        setPrivateStage("error")
        setPrivateError(raw)
      } else if (raw.includes("NetworkError") || raw.includes("Failed to fetch") || raw.includes("failed to get recent blockhash")) {
        msg = "Network error: unable to connect to Solana RPC. Check your internet connection and try again."
      } else if (raw.includes("failed to get info about account")) {
        msg = "Network error: unable to fetch account data from Solana. Please try again."
      } else if (raw.includes("User rejected")) {
        msg = "Transaction cancelled by user."
      } else if (raw.startsWith("Insufficient")) {
        // Preserve detailed messages from pre-simulation (buildSignAndSend)
        msg = raw
      } else if (raw.startsWith("Transaction simulation failed")) {
        msg = raw
      } else if (raw.includes("Simulation failed") || raw.includes("simulation failed")) {
        msg = `Transaction simulation failed: ${raw}`
      }
      // In private mode the modal already shows the error inline — skip the
      // toast to avoid duplication.
      if (usePrivacy !== "yes") {
        toast.error(msg, { duration: 12000 })
      }
      setErrors({ submit: msg })
    } finally {
      setIsLoading(false)
    }
  }

  const closePrivateModal = () => {
    setIsSummaryDialogOpen(false)
    setPrivateStage(null)
    setPrivateError(null)
    setPrivateTxHash(null)
    if (privateStage === "success") resetForm()
  }

  const resetForm = () => {
    setLoanAmount(1000)
    setLoanTerm(30)
    setApy(5)
    setToken("USDC")
    setTokenCollateral("SOL")
    setCollateralAmount(1000)
    setCollateralPercentage(150)
    setReceiverAddress("")
    setIsExclusive("no")
    setUsePrivacy("no")
    setErrors({})
    setUserModifiedField(null)
  }

  const getWalletBalance = (symbol: string): number => {
    const t = walletTokens.find((wt) => wt.symbol === symbol)
    return t?.balance ?? 0
  }

  const isSelfAddress = (address: string) =>
    publicKey ? address === publicKey.toBase58() : false

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // The previous check compared raw token units to 1, which only
    // happens to mean "$1" for USDC. For SOL or EURC the same form
    // would let through fractional-USD principals. Compare in USD
    // using the live token price so the floor is consistent.
    //
    // Tolerance: ±$0.01 absorbs Pyth USDC drift (~$0.9998) so a 1 USDC
    // loan doesn't get rejected for being $0.0002 short of $1. Same
    // ±$0.01 the agent's loan-scanner uses, so creation and matching
    // agree on what counts as "$1".
    const loanUsdFloor = 1
    const loanUsdTolerance = 0.01
    const loanTokenPrice = getTokenPrice(token) || 1
    const loanUsd = loanAmount * loanTokenPrice
    if (loanAmount <= 0) {
      newErrors.loanAmount = "Loan amount must be greater than 0"
    } else if (loanUsd < loanUsdFloor - loanUsdTolerance) {
      const minTokens = loanUsdFloor / loanTokenPrice
      newErrors.loanAmount = `Minimum loan amount is $${loanUsdFloor.toFixed(2)} USD (≈ ${minTokens.toFixed(loanTokenPrice >= 1 ? 2 : 4)} ${token})`
    }
    if (loanTerm < 1) newErrors.loanTerm = "Minimum term is 1 day"
    if (apy < 0) newErrors.apy = "APY cannot be negative"
    if (collateralPercentage <= 0)
      newErrors.collateralPercentage = "Collateral percentage must be greater than 0"
    // Amount cannot be equal to Collateral
    if (token === tokenCollateral) {
      newErrors.tokenCollateral = "Amount token cannot be the same as Collateral token"
    }

    // Balance validation: check if user has enough tokens to fund the offer.
    // Borrow mode: user deposits collateral. Lend mode: user deposits debt tokens.
    // Only validate when wallet tokens have been loaded (walletTokens.length > 0).
    const depositSymbol = mode === "borrow" ? tokenCollateral : token
    const depositAmount = mode === "borrow" ? collateralAmount : loanAmount
    const tokensLoaded = !tokensLoading && walletTokens.length > 0

    if (tokensLoaded) {
      const depositBalance = getWalletBalance(depositSymbol)
      if (depositBalance < depositAmount) {
        const label = mode === "borrow" ? "collateralAmount" : "loanAmount"
        newErrors[label] = depositBalance === 0
          ? `You don't have any ${depositSymbol} in your wallet.`
          : `Insufficient ${depositSymbol} balance: you have ${depositBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} but need ${depositAmount.toLocaleString()}`
      }
      // SOL fee check removed — the on-chain simulation in buildSignAndSend
      // catches real SOL shortages with accurate error messages. Client-side
      // balance data can be stale and produces false positives.
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const ALL_TOKENS = ["SOL", "USDC", "EURC"]

  // Tokens available for amount = all except the one used as collateral
  const amountTokens = ALL_TOKENS.filter((t) => t !== tokenCollateral)
  // Tokens available for collateral = all except the one used as amount
  const collateralTokens = ALL_TOKENS.filter((t) => t !== token)

  // Update token and ensure no collision
  const handleTokenChange = (newToken: string) => {
    setToken(newToken)
    const newCollToken =
      newToken === tokenCollateral
        ? ALL_TOKENS.find((t) => t !== newToken) || "SOL"
        : tokenCollateral
    if (newCollToken !== tokenCollateral) setTokenCollateral(newCollToken)
    calcCollateral(loanAmount, newToken, newCollToken, collateralPercentage)
  }

  // Update collateral token and ensure no collision
  const handleCollateralChange = (newCollateralToken: string) => {
    setTokenCollateral(newCollateralToken)
    const newDebtToken =
      newCollateralToken === token
        ? ALL_TOKENS.find((t) => t !== newCollateralToken) || "USDC"
        : token
    if (newDebtToken !== token) setToken(newDebtToken)
    calcCollateral(loanAmount, newDebtToken, newCollateralToken, collateralPercentage)
  }

  // Calculate collateral amount from explicit parameters (avoids stale closure)
  const calcCollateral = (
    amount: number,
    debtToken: string,
    collToken: string,
    pct: number,
  ) => {
    const debtPrice = getTokenPrice(debtToken)
    const collPrice = getTokenPrice(collToken)
    if (debtPrice <= 0 || collPrice <= 0) return
    const loanValueUSD = amount * debtPrice
    const requiredCollateralUSD = loanValueUSD * (pct / 100)
    // Round UP to 4 decimals so the displayed amount always meets or exceeds
    // the requested percentage. Math.round was producing values like 0.0178
    // when 0.0179 was needed to actually hit 150%, then the server saw 149.6%
    // and rejected.
    setCollateralAmount(Math.ceil((requiredCollateralUSD / collPrice) * 10000) / 10000)
  }

  // Calculate loan amount from explicit parameters
  const calcLoanFromCollateral = (
    collAmount: number,
    debtToken: string,
    collToken: string,
    pct: number,
  ) => {
    const debtPrice = getTokenPrice(debtToken)
    const collPrice = getTokenPrice(collToken)
    if (debtPrice <= 0 || collPrice <= 0 || pct <= 0) return
    const collateralValueUSD = collAmount * collPrice
    const requiredLoanUSD = collateralValueUSD / (pct / 100)
    setLoanAmount(Math.round((requiredLoanUSD / debtPrice) * 100) / 100)
  }

  // Handle loan amount change
  const handleLoanAmountChange = (value: number) => {
    setLoanAmount(value)
    setUserModifiedField("amount")
    calcCollateral(value, token, tokenCollateral, collateralPercentage)
  }

  // Handle collateral amount change
  const handleCollateralAmountChange = (value: number) => {
    setCollateralAmount(value)
    setUserModifiedField("collateral")
    calcLoanFromCollateral(value, token, tokenCollateral, collateralPercentage)
  }

  // Handle collateral percentage change
  const handleCollateralPercentageChange = (value: number) => {
    setCollateralPercentage(value)
    if (userModifiedField === "collateral") {
      calcLoanFromCollateral(collateralAmount, token, tokenCollateral, value)
    } else {
      calcCollateral(loanAmount, token, tokenCollateral, value)
    }
  }

  // Recalculate when prices or tokens change
  useEffect(() => {
    if (prices && Object.keys(prices).length > 0) {
      if (userModifiedField === "collateral") {
        calcLoanFromCollateral(collateralAmount, token, tokenCollateral, collateralPercentage)
      } else {
        calcCollateral(loanAmount, token, tokenCollateral, collateralPercentage)
      }
    }
  }, [prices, token, tokenCollateral])

  // Live USD values for the safety check. Both sliders + the on-chain
  // validator agree on this single arithmetic so the form can never offer
  // up a combination the program will reject.
  const debtPriceUsd = getTokenPrice(token) || 0
  const collPriceUsd = getTokenPrice(tokenCollateral) || 0
  const principalUsd = loanAmount * debtPriceUsd
  const collateralValueUsd = collateralAmount * collPriceUsd
  const apyBpsLive = Math.round(apy * 100)
  const durationSecsLive = loanTerm * 86_400

  const { clampedSetApyPct, clampedSetCollateralPct, clampedSetDurationDays, apyCeilingPct } =
    useRiskClamps({
      collateralValueUsd,
      principalUsd,
      apyPct: apy,
      durationDays: loanTerm,
      collateralPct: collateralPercentage,
      setApyPct: setApy,
      setCollateralPct: handleCollateralPercentageChange,
      setDurationDays: setLoanTerm,
    })

  const loanIsSafe = isLoanSafe(collateralValueUsd, principalUsd, apyBpsLive, durationSecsLive)

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg rounded-xl overflow-hidden border-2 border-gray-200 dark:border-white/20 hover:shadow-xl transition-all duration-300 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
      <CardHeader className="bg-transparent rounded-t-xl text-center py-1 border-b border-gray-200 dark:border-gray-800 relative z-10">
        <CardTitle className="text-lg font-bold text-black dark:text-white text-center">
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 bg-transparent relative z-10">
        <div className="space-y-3">
          <div className="space-y-1">
            <RiskZoneBar
              collateralValueUsd={collateralValueUsd}
              principalUsd={principalUsd}
              apyBps={apyBpsLive}
              durationSeconds={durationSecsLive}
            />
            <WorstCasePreview
              collateralValueUsd={collateralValueUsd}
              principalUsd={principalUsd}
              apyBps={apyBpsLive}
              durationSeconds={durationSecsLive}
              collateralSymbol={tokenCollateral}
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor="loan-amount" className="text-sm font-medium text-foreground">
                    AMOUNT
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-transparent dark:bg-blue-950">
                        <p>{config.amountTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex">
                  <Input
                    id="loan-amount"
                    type="number"
                    value={loanAmount}
                    onChange={(e) => handleLoanAmountChange(Number(e.target.value))}
                    className="h-8 text-black dark:text-white rounded-r-none w-1/2 border-r-[0.5px] border-r-black dark:border-r-white bg-transparent dark:bg-transparent text-right spin-left"
                  />
                  <Select value={token} onValueChange={handleTokenChange}>
                    <SelectTrigger className="w-1/2 h-8 text-black dark:text-white rounded-l-none border-l-[0.5px] border-l-black dark:border-l-white bg-transparent dark:bg-transparent">
                      <div className="flex items-center gap-1">
                        <img
                          src={`/images/${token === "EURC" ? "eurc-logo.png" : token === "USDT" ? "tether-usdt-logo.png" : token.toLowerCase() + "-logo.png"}`}
                          alt={token}
                          className="w-4 h-4"
                        />
                        ${token}
                      </div>
                    </SelectTrigger>
                    <SelectContent className="text-black dark:text-white bg-white dark:bg-blue-950">
                      {amountTokens.map((t) => (
                        <SelectItem key={t} value={t}>
                          <div className="flex items-center gap-1">
                            <img
                              src={`/images/${t === "EURC" ? "eurc-logo.png" : t === "USDT" ? "tether-usdt-logo.png" : t.toLowerCase() + "-logo.png"}`}
                              alt={t}
                              className="w-4 h-4"
                            />
                            ${t}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Swap arrow — flips Amount ↔ Collateral tokens. Same UX
                  pattern as Jupiter's Sell ↔ Buy switch. Recomputes the
                  collateral value off the new pair so the percentage
                  ratio stays consistent. */}
              <div className="relative h-0">
                <button
                  type="button"
                  aria-label="Swap amount and collateral tokens"
                  title="Swap tokens"
                  onClick={() => {
                    const prevToken = token
                    const prevCollateral = tokenCollateral
                    setToken(prevCollateral)
                    setTokenCollateral(prevToken)
                    // Recalculate collateral amount against the new
                    // token pair so the existing percentage holds.
                    calcCollateral(loanAmount, prevCollateral, prevToken, collateralPercentage)
                  }}
                  className="absolute left-1/2 -translate-x-1/2 -top-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full border border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-200 shadow-sm transition-colors"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label
                    htmlFor="collateral-amount"
                    className="text-sm font-medium text-foreground"
                  >
                    COLLATERAL
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{config.collateralTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex">
                  <Input
                    id="collateral-amount"
                    type="number"
                    value={collateralAmount}
                    onChange={(e) => handleCollateralAmountChange(Number(e.target.value))}
                    className="h-8 text-black dark:text-white rounded-r-none w-1/2 border-r-[0.5px] border-r-black dark:border-r-white bg-transparent dark:bg-transparent text-right spin-left"
                  />
                  <Select value={tokenCollateral} onValueChange={handleCollateralChange}>
                    <SelectTrigger className="w-1/2 h-8 text-black dark:text-white rounded-l-none border-l-[0.5px] border-l-black dark:border-l-white bg-transparent dark:bg-transparent">
                      <div className="flex items-center gap-1">
                        <img
                          src={`/images/${tokenCollateral === "EURC" ? "eurc-logo.png" : tokenCollateral === "USDT" ? "tether-usdt-logo.png" : tokenCollateral.toLowerCase() + "-logo.png"}`}
                          alt={tokenCollateral}
                          className="w-4 h-4"
                        />
                        ${tokenCollateral}
                      </div>
                    </SelectTrigger>
                    <SelectContent className="text-black dark:text-white bg-white dark:bg-blue-950">
                      {collateralTokens.map((t) => (
                        <SelectItem key={t} value={t}>
                          <div className="flex items-center gap-1">
                            <img
                              src={`/images/${t === "EURC" ? "eurc-logo.png" : t === "USDT" ? "tether-usdt-logo.png" : t.toLowerCase() + "-logo.png"}`}
                              alt={t}
                              className="w-4 h-4"
                            />
                            ${t}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {errors.tokenCollateral && (
                  <p className="text-red-500 text-sm mt-1">{errors.tokenCollateral}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label
                    htmlFor="collateral-percentage"
                    className="text-sm font-medium text-foreground"
                  >
                    COLLATERAL PERCENTAGE:
                  </Label>
                  <Input
                    type="number"
                    min={150}
                    max={300}
                    step={5}
                    value={collateralPercentage}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (!isNaN(v)) handleCollateralPercentageChange(v)
                    }}
                    onBlur={() => handleCollateralPercentageChange(Math.min(300, Math.max(150, collateralPercentage)))}
                    className="w-16 h-6 text-sm text-center px-1 bg-transparent dark:bg-transparent text-black dark:text-white border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-foreground">%</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{config.percentageTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Slider
                  id="collateral-percentage"
                  min={150}
                  max={300}
                  step={5}
                  value={[collateralPercentage]}
                  onValueChange={([value]) => clampedSetCollateralPct(value)}
                  className="w-full bg-transparent dark:bg-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="loan-term" className="text-sm font-medium text-foreground">
                    PERIOD
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={loanTerm}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (!isNaN(v)) setLoanTerm(v)
                    }}
                    onBlur={() => setLoanTerm(Math.min(365, Math.max(1, loanTerm)))}
                    className="w-16 h-6 text-sm text-center px-1 bg-transparent dark:bg-transparent text-black dark:text-white border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-foreground">days</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          The duration of the loan in days. At the end of this period, the borrower
                          should repay the loan plus interest.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Slider
                  id="loan-term"
                  min={1}
                  max={365}
                  step={1}
                  value={[loanTerm]}
                  onValueChange={([value]) => clampedSetDurationDays(value)}
                  className="w-full bg-transparent dark:bg-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="apy" className="text-sm font-medium text-foreground">
                    <TermTooltip term="apy">APY (%)</TermTooltip>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={MAX_APY_PCT}
                    step={0.1}
                    value={apy}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (!isNaN(v)) clampedSetApyPct(v)
                    }}
                    onBlur={() => clampedSetApyPct(Math.min(MAX_APY_PCT, Math.max(0, apy)))}
                    className="w-16 h-6 text-sm text-center px-1 bg-transparent dark:bg-transparent text-black dark:text-white border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-foreground">%</span>
                  {apyCeilingPct < MAX_APY_PCT && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      max safe: {apyCeilingPct.toFixed(1)}%
                    </span>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          Annual Percentage Yield - the interest rate you&apos;ll earn on this loan,
                          calculated on a yearly basis.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Slider
                  id="apy"
                  min={0}
                  max={MAX_APY_PCT}
                  step={0.1}
                  value={[apy]}
                  onValueChange={([value]) => clampedSetApyPct(value)}
                  className="w-full bg-transparent dark:bg-transparent"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Label className="text-sm font-medium text-foreground whitespace-nowrap">
                    {config.privacyLabel}
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200 flex-shrink-0">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{config.privacyTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={usePrivacy} onValueChange={setUsePrivacy}>
                  <SelectTrigger className="w-20 h-8 text-black dark:text-white bg-transparent dark:bg-transparent flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-black dark:text-white bg-white dark:bg-blue-950">
                    <SelectItem value="no"><span className="font-semibold text-red-600 dark:text-red-400">No</span></SelectItem>
                    <SelectItem value="yes"><span className="font-semibold text-green-600 dark:text-green-400">Yes</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Label className="text-sm font-medium text-foreground whitespace-nowrap">
                    {config.exclusiveLabel}
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200 flex-shrink-0">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{config.exclusiveTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={isExclusive} onValueChange={(v) => {
                  setIsExclusive(v)
                  if (v === "no") {
                    setReceiverAddress("")
                    setErrors((prev) => { const { receiverAddress: _, ...rest } = prev; return rest })
                  }
                }}>
                  <SelectTrigger className="w-20 h-8 text-black dark:text-white bg-transparent dark:bg-transparent flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-black dark:text-white bg-white dark:bg-blue-950">
                    <SelectItem value="no"><span className="font-semibold text-red-600 dark:text-red-400">No</span></SelectItem>
                    <SelectItem value="yes"><span className="font-semibold text-green-600 dark:text-green-400">Yes</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isExclusive === "yes" && (
                <div className="mt-2">
                  <Input
                    type="text"
                    value={receiverAddress}
                    onChange={(e) => {
                      setReceiverAddress(e.target.value)
                      setErrors((prev) => { const { receiverAddress: _, ...rest } = prev; return rest })
                    }}
                    placeholder="Wallet address or .sol domain"
                    className="h-8 text-black dark:text-white bg-transparent dark:bg-transparent"
                  />
                  {errors.receiverAddress && (
                    <p className="text-red-500 text-xs mt-1">{errors.receiverAddress}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      {(errors.loanAmount || errors.collateralAmount || errors.solFees || errors.submit) && (
        <div className="mx-4 mb-2 p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs text-center">
          {errors.loanAmount || errors.collateralAmount || errors.solFees || errors.submit}
        </div>
      )}
      <CardFooter className="py-2 flex justify-center items-center gap-4 bg-transparent">
        <Button
          variant="outline"
          onClick={resetForm}
          className="px-6 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-blue-900 bg-transparent dark:bg-transparent h-8"
          disabled={isLoading}
        >
          Reset
        </Button>
        <Button
          onClick={handleCreateLoan}
          className="bg-[#1358EC] !text-white h-8 text-base px-12 hover:bg-[#104BCA]"
          disabled={isLoading || resolving || !isPriceReliable || !loanIsSafe}
          title={!loanIsSafe ? "Loan terms violate the collateral safety constraint" : undefined}
        >
          {isLoading ? (
            <>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Create Loan"
          )}
        </Button>
      </CardFooter>

      <Dialog
        open={isSummaryDialogOpen}
        onOpenChange={(open) => {
          // Don't allow closing the modal mid-flow in private mode — the user
          // would lose visibility into a transaction that's still running and
          // burning fees. They can close on success/error via the footer.
          if (!open && usePrivacy === "yes" && (isLoading || privateStage)) return
          setIsSummaryDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center">
              {usePrivacy === "yes" && privateStage
                ? privateStage === "success"
                  ? "Private Loan Created"
                  : privateStage === "error"
                    ? "Private Flow Failed"
                    : "Creating Private Loan"
                : "Loan Summary"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {usePrivacy === "yes" && privateStage
                ? privateStage === "success"
                  ? "Stealth wallet funded and offer posted on-chain."
                  : privateStage === "error"
                    ? "Something went wrong during the private flow."
                    : "Stealth wallet → Cloak shield/unshield → Anchor offer. Don't close."
                : "Review your loan details before submitting"}
            </DialogDescription>
          </DialogHeader>

          {/* Progress steps replace the loan summary while the private flow runs. */}
          {usePrivacy === "yes" && privateStage ? (
            <PrivateFlowProgress
              stage={privateStage}
              error={privateError}
              txHash={privateTxHash}
              loanTokenSymbol={mode === "lend" ? token : tokenCollateral}
            />
          ) : (
          <>
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-100 dark:border-blue-800 shadow-sm">
            <h3 className="text-sm font-bold mb-3 text-blue-800 dark:text-blue-300 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              LOAN SUMMARY
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                  <p className="text-gray-500 dark:text-gray-300 mb-1">Principal Amount:</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">
                    {loanAmount.toLocaleString()} {token}
                  </p>
                </div>
                <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                  <p className="text-gray-500 dark:text-gray-300 mb-1">Interest Earned:</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    +{(loanAmount * (apy / 100) * (loanTerm / 365)).toFixed(2)} {token}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                  <p className="text-gray-500 dark:text-gray-300 mb-1">Total Return:</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">
                    {(loanAmount * (1 + (apy / 100) * (loanTerm / 365))).toFixed(2)} {token}
                  </p>
                </div>
                <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                  <p className="text-gray-500 dark:text-gray-300 mb-1">Collateral Secured:</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    {collateralAmount} {tokenCollateral}
                  </p>
                </div>
              </div>
              <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                <p className="text-gray-500 dark:text-gray-300 mb-1">Daily Interest Accrual:</p>
                <p className="font-semibold text-blue-700 dark:text-blue-300">
                  {((loanAmount * (apy / 100)) / 365).toFixed(4)} {token} per day
                </p>
              </div>

              {usePrivacy === "yes" && (() => {
                const tokenUsd = loanAmount * (getTokenPrice(token) || 0)
                const solUsd = getTokenPrice("SOL") || 0
                const est = estimatePrivateLoanCost(solUsd)
                const lines = formatCostLines(est, tokenUsd)
                const premiumUsd = (est.privacyPremiumBps / 10000) * tokenUsd
                const totalSetupUsd = premiumUsd + est.totalUsd
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                        <p className="text-gray-500 dark:text-gray-300 mb-1">Privacy Premium:</p>
                        <p className="font-semibold text-blue-700 dark:text-blue-300">
                          {lines.privacyPremium}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                        <p className="text-gray-500 dark:text-gray-300 mb-1">
                          ZK Proofs ({est.proofCount}x):
                        </p>
                        <p className="font-semibold text-blue-700 dark:text-blue-300">
                          {lines.zkProofs}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-blue-950 p-2 rounded border border-blue-100 dark:border-blue-800">
                      <p className="text-gray-500 dark:text-gray-300 mb-1">Cloak Relayer Fees:</p>
                      <p className="font-semibold text-blue-700 dark:text-blue-300">
                        {lines.relayer}
                      </p>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded border-2 border-blue-300 dark:border-blue-700">
                      <p className="text-gray-600 dark:text-gray-200 mb-1 font-semibold">
                        Total Setup Cost:
                      </p>
                      <p className="font-bold text-blue-800 dark:text-blue-200">
                        ${totalSetupUsd.toFixed(2)} USD
                      </p>
                    </div>
                  </>
                )
              })()}

              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                Note: You will lend {loanAmount} {token} for {loanTerm} days at {apy}% APY. The
                borrower&apos;s collateral will be locked until repayment.
                {usePrivacy === "yes" && (
                  <>
                    {" "}Wallet identity hidden via Cloak ZK; amounts visible on-chain.
                    Audit available via viewing key.
                  </>
                )}
              </div>
            </div>
          </div>
          </>
          )}

          <DialogFooter className="flex justify-between items-center mt-4 gap-4 sm:justify-between">
            {usePrivacy === "yes" && privateStage ? (
              <>
                {/* "Privacy by Cloak" attribution — pinned to the left of
                    the Close button while the private flow is running. */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Privacy by</span>
                  <img src="/ecosystem/cloak.svg" alt="Cloak" className="h-4 w-auto opacity-90" />
                </div>
                {privateStage === "success" || privateStage === "error" ? (
                  <Button
                    onClick={closePrivateModal}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Close
                  </Button>
                ) : (
                  <Button disabled className="bg-blue-600 text-white opacity-70">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Don&apos;t close
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsSummaryDialogOpen(false)}
                  className="bg-white dark:bg-blue-950 text-black dark:text-white hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmLoan}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Send Offer"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExclusiveWarningOpen} onOpenChange={setIsExclusiveWarningOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exclusive Counterparty Required</DialogTitle>
            <DialogDescription>
              Please enter the wallet address or .sol domain that will be allowed to accept this offer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsExclusiveWarningOpen(false)} className="bg-blue-600 text-white hover:bg-blue-700">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/**
 * Step-by-step status panel that replaces the loan summary while the private
 * flow is running. Drives off the same `PrivateLoanProgress` enum as the hook.
 */
function PrivateFlowProgress(props: {
  stage: PrivateLoanProgress | "success" | "error"
  error: string | null
  txHash: string | null
  loanTokenSymbol: string
}) {
  // Each step carries an icon: Wand2 for the stealth-mint, Shield-style icons
  // for the two Cloak shield round-trips, FileSignature for the Anchor post,
  // and a green PartyPopper for the synthetic "Offer created" terminal step.
  type IconType = typeof Check
  const STEPS: { key: PrivateLoanProgress | "done"; label: string; sub?: string; Icon: IconType }[] = [
    { key: "init", label: "Initializing stealth wallet", sub: "Privy server-side wallet, indexed in Redis", Icon: Wand2 },
    { key: "shield-sol", label: "Shielding SOL via Cloak", sub: "Funds tx fees + ATA rent for the on-chain offer", Icon: ShieldCheck },
    { key: "shield-token", label: `Shielding ${props.loanTokenSymbol} via Cloak`, sub: "Loan principal / collateral round-trip", Icon: ShieldCheck },
    { key: "create-offer", label: "Posting offer on-chain", sub: "Stealth signs Anchor createLendOffer/createBorrowRequest", Icon: FileSignature },
    { key: "done", label: "Offer created", sub: "Stealth-signed loan account is live on Solana", Icon: PartyPopper },
  ]
  // shield-token is skipped when SOL is the loan token (single combined round-trip).
  const isSolOnly = props.loanTokenSymbol === "SOL"
  const visibleSteps = isSolOnly ? STEPS.filter((s) => s.key !== "shield-token") : STEPS
  const orderIdx = (k: string) => visibleSteps.findIndex((s) => s.key === k)
  // The "done" step is reached only when the parent reports stage === "success".
  const stageOrder =
    props.stage === "success"
      ? orderIdx("done")
      : props.stage === "error"
        ? -1
        : orderIdx(props.stage as string)

  return (
    <div className="py-2">
      <ol className="relative pl-2">
        {visibleSteps.map((step, i) => {
          const isDone = i < stageOrder
          const isActive = i === stageOrder
          const isError = props.stage === "error" && i === stageOrder + 1
          const isSuccessTerminal = step.key === "done" && props.stage === "success"
          const Icon = step.Icon
          return (
            <li key={step.key} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {/* Vertical connector line */}
              {i < visibleSteps.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-[15px] top-9 w-px h-[calc(100%-1.75rem)] ${
                    isDone || isSuccessTerminal
                      ? "bg-gradient-to-b from-green-500/70 to-green-500/20"
                      : isActive
                        ? "bg-gradient-to-b from-blue-500/60 to-blue-500/10"
                        : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}

              {/* Icon medallion */}
              <div
                className={`relative h-8 w-8 flex items-center justify-center rounded-full border shrink-0 ${
                  isDone || isSuccessTerminal
                    ? "bg-green-50 border-green-300 text-green-600 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400"
                    : isError
                      ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400"
                      : isActive
                        ? "bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300"
                        : "bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-600"
                }`}
              >
                {isDone || isSuccessTerminal ? (
                  <Check className="h-4 w-4" />
                ) : isError ? (
                  <X className="h-4 w-4" />
                ) : isActive ? (
                  <>
                    <span className="absolute inset-0 rounded-full border-2 border-blue-400/40 animate-ping" />
                    <Icon className="h-4 w-4" />
                  </>
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div
                  className={
                    isActive
                      ? "text-sm font-semibold text-blue-700 dark:text-blue-300"
                      : isDone || isSuccessTerminal
                        ? "text-sm text-green-700 dark:text-green-400"
                        : isError
                          ? "text-sm font-semibold text-red-700 dark:text-red-400"
                          : "text-sm text-gray-500 dark:text-gray-400"
                  }
                >
                  {step.label}
                </div>
                {step.sub && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {step.sub}
                  </div>
                )}
                {/* Inline loan-tx link on the terminal "Offer created" step */}
                {isSuccessTerminal && props.txHash && (
                  <a
                    href={`https://explorer.solana.com/tx/${props.txHash}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-mono text-green-700 dark:text-green-400 underline break-all"
                  >
                    {props.txHash.slice(0, 8)}…{props.txHash.slice(-8)}
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {props.stage === "error" && props.error && (
        <div className="mt-4 rounded-lg p-3 border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30">
          <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
            Error
          </div>
          <div className="text-xs text-red-700 dark:text-red-400 break-words leading-snug">
            {props.error}
          </div>
        </div>
      )}
    </div>
  )
}
