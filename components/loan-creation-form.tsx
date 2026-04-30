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
import { HelpCircle as QuestionMarkCircledIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useLoanContract } from "@/hooks/useLoanContract"
import { useTokenPrices } from "@/hooks/useTokenPrices"
import { useWalletTokens } from "@/hooks/useWalletTokens"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { toast } from "sonner"
import { useSNS } from "@/hooks/useSNS"

const MODE_CONFIG = {
  borrow: {
    title: "CREATE BORROW OFFER",
    amountTooltip: "The amount you want to borrow in the selected token.",
    collateralTooltip: "The token and amount you will provide as collateral for this loan.",
    percentageTooltip:
      "The percentage of collateral relative to the loan amount. Higher percentages provide more security for lenders.",
    privateLabel: "SET PRIVATE LENDER?",
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
    privateLabel: "SET PRIVATE BORROWER?",
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
  const [isPrivate, setIsPrivate] = useState("no")
  const [isPrivateWarningOpen, setIsPrivateWarningOpen] = useState(false)

  const handleCreateLoan = async () => {
    if (isPrivate === "yes") {
      const trimmed = receiverAddress.trim()
      if (!trimmed) {
        setIsPrivateWarningOpen(true)
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
      const tx = await createLoan({
        debtAmount: loanAmount,
        collateralAmount,
        duration: durationInSeconds,
        apy: Math.round(apy),
        debtTokenSymbol: token,
        collateralTokenSymbol: tokenCollateral,
        isPrivate: !!receiverAddress,
        counterparty: receiverAddress || undefined,
      })
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
      setIsSummaryDialogOpen(false)
      resetForm()
    } catch (error: any) {
      const raw = error?.message || "Error creating loan"
      let msg = raw
      const depositSymbol = mode === "borrow" ? tokenCollateral : token
      if (raw.includes("NetworkError") || raw.includes("Failed to fetch") || raw.includes("failed to get recent blockhash")) {
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
      toast.error(msg)
      setErrors({ submit: msg })
    } finally {
      setIsLoading(false)
    }
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
    setIsPrivate("no")
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

    if (loanAmount < 1) newErrors.loanAmount = "Minimum loan amount is $1.00"
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
    setCollateralAmount(Math.round((requiredCollateralUSD / collPrice) * 10000) / 10000)
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

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg rounded-xl overflow-hidden border-2 border-gray-200 dark:border-white/20 hover:shadow-xl transition-all duration-300 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
      <CardHeader className="bg-transparent rounded-t-xl text-center py-1 border-b border-gray-200 dark:border-gray-800 relative z-10">
        <CardTitle className="text-lg font-bold text-black dark:text-white text-center">
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 bg-transparent relative z-10">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor="loan-amount" className="text-sm font-medium text-foreground">
                    AMOUNT
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
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
                          src={`/images/${token === "EURC" ? "eurc.webp" : token === "USDT" ? "tether-usdt-logo.png" : token.toLowerCase() + "-logo.png"}`}
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
                              src={`/images/${t === "EURC" ? "eurc.webp" : t === "USDT" ? "tether-usdt-logo.png" : t.toLowerCase() + "-logo.png"}`}
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
                        <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
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
                          src={`/images/${tokenCollateral === "EURC" ? "eurc.webp" : tokenCollateral === "USDT" ? "tether-usdt-logo.png" : tokenCollateral.toLowerCase() + "-logo.png"}`}
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
                              src={`/images/${t === "EURC" ? "eurc.webp" : t === "USDT" ? "tether-usdt-logo.png" : t.toLowerCase() + "-logo.png"}`}
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

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
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
                        <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
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
                  onValueChange={([value]) => handleCollateralPercentageChange(value)}
                  className="w-full bg-transparent dark:bg-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor="loan-term" className="text-sm font-medium text-foreground">
                    PERIOD:
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
                        <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
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
                  onValueChange={([value]) => setLoanTerm(value)}
                  className="w-full bg-transparent dark:bg-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label htmlFor="apy" className="text-sm font-medium text-foreground">
                    APY (%):
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    step={0.1}
                    value={apy}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (!isNaN(v)) setApy(v)
                    }}
                    onBlur={() => setApy(Math.min(200, Math.max(0, apy)))}
                    className="w-16 h-6 text-sm text-center px-1 bg-transparent dark:bg-transparent text-black dark:text-white border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-foreground">%</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
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
                  max={200}
                  step={0.1}
                  value={[apy]}
                  onValueChange={([value]) => setApy(value)}
                  className="w-full bg-transparent dark:bg-transparent"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-foreground whitespace-nowrap">
                  {config.privateLabel}
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Enable this to send the offer to a specific wallet address or .sol domain instead of the public market.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Select value={isPrivate} onValueChange={(v) => {
                  setIsPrivate(v)
                  if (v === "no") {
                    setReceiverAddress("")
                    setErrors((prev) => { const { receiverAddress: _, ...rest } = prev; return rest })
                  }
                }}>
                  <SelectTrigger className="w-20 h-8 text-black dark:text-white bg-transparent dark:bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-black dark:text-white bg-white dark:bg-blue-950">
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isPrivate === "yes" && (
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
      {!isPriceReliable && (
        <div className="mx-4 mb-2 p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs text-center">
          Price feeds unavailable. Offers disabled until live prices are restored.
        </div>
      )}
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
          disabled={isLoading || resolving || !isPriceReliable}
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

      <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center">Loan Summary</DialogTitle>
            <DialogDescription className="text-center">
              Review your loan details before submitting
            </DialogDescription>
          </DialogHeader>

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
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                Note: You will lend {loanAmount} {token} for {loanTerm} days at {apy}% APY. The
                borrower&apos;s collateral will be locked until repayment.
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-center mt-4 gap-4">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrivateWarningOpen} onOpenChange={setIsPrivateWarningOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Private Address Required</DialogTitle>
            <DialogDescription>
              Please enter the private wallet address or .sol domain before creating the loan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsPrivateWarningOpen(false)} className="bg-blue-600 text-white hover:bg-blue-700">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
