"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HelpCircle as QuestionMarkCircledIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useLoans, formatDuration, type ParsedLoan } from "@/hooks/useLoans"
import { useLoanContract } from "@/hooks/useLoanContract"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletContext } from "@/components/wallet-provider"
import { useWalletProfile } from "@/hooks/useWalletProfile"

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}

const getTokenDisplaySymbol = (symbol: string): string => {
  if (symbol === 'bSOL') return 'agioSOL'
  return symbol
}

const ACCEPTED_TOKENS = ['SOL', 'USDC', 'EURC', 'bSOL'] as const

export default function LoanOffersPageClient() {
  const searchParams = useSearchParams()
  const { openOffers, loading, refetch, isMyWallet } = useLoans()
  const { publicKey } = useWallet()

  const urlType = searchParams.get("type")
  const urlToken = searchParams.get("token")

  const [filterType, setFilterType] = useState(
    urlType === "lend" || urlType === "borrow" ? urlType : "all"
  )
  const [filterToken, setFilterToken] = useState(
    urlToken && ACCEPTED_TOKENS.includes(urlToken as any) ? urlToken : "all"
  )
  const [sortBy, setSortBy] = useState("newest")
  const [minApy, setMinApy] = useState<string>("")
  const [maxApy, setMaxApy] = useState<string>("")
  const [minDays, setMinDays] = useState<string>("")
  const [maxDays, setMaxDays] = useState<string>("")

  const filteredOffers = useMemo(() => {
    let offers = openOffers

    // Filter out user's own offers (including agent wallet)
    if (publicKey) {
      offers = offers.filter(l => !isMyWallet(l.lender) && !isMyWallet(l.borrower))
    }

    // Filter by type
    if (filterType === "lend") {
      offers = offers.filter(l => l.offerType === 'lend')
    } else if (filterType === "borrow") {
      offers = offers.filter(l => l.offerType === 'borrow')
    }

    // Filter by token
    if (filterToken !== "all") {
      offers = offers.filter(l => l.debtTokenSymbol === filterToken)
    }

    // APY range
    const minApyNum = minApy === "" ? null : Number(minApy)
    const maxApyNum = maxApy === "" ? null : Number(maxApy)
    if (minApyNum !== null && Number.isFinite(minApyNum)) {
      offers = offers.filter(l => l.apy >= minApyNum)
    }
    if (maxApyNum !== null && Number.isFinite(maxApyNum)) {
      offers = offers.filter(l => l.apy <= maxApyNum)
    }

    // Period range (loan duration is stored in seconds; UI is in days)
    const minDaysNum = minDays === "" ? null : Number(minDays)
    const maxDaysNum = maxDays === "" ? null : Number(maxDays)
    if (minDaysNum !== null && Number.isFinite(minDaysNum)) {
      const minSec = minDaysNum * 86400
      offers = offers.filter(l => l.duration >= minSec)
    }
    if (maxDaysNum !== null && Number.isFinite(maxDaysNum)) {
      const maxSec = maxDaysNum * 86400
      offers = offers.filter(l => l.duration <= maxSec)
    }

    // Sort
    if (sortBy === "highest-apy") {
      offers = [...offers].sort((a, b) => b.apy - a.apy)
    } else if (sortBy === "lowest-apy") {
      offers = [...offers].sort((a, b) => a.apy - b.apy)
    } else if (sortBy === "highest-amount") {
      offers = [...offers].sort((a, b) => b.debtAmountUi - a.debtAmountUi)
    }

    return offers
  }, [openOffers, filterType, filterToken, sortBy, minApy, maxApy, minDays, maxDays, publicKey, isMyWallet])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-8">
        {/* Range filters — APY (%) + Period (days). Empty inputs are treated as
            "no bound" so users can constrain only one side of either range. */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-white/60 font-mono">APY range (%)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={200}
                step={0.5}
                placeholder="Min"
                value={minApy}
                onChange={(e) => setMinApy(e.target.value)}
                className="w-24"
              />
              <span className="text-white/40">—</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={200}
                step={0.5}
                placeholder="Max"
                value={maxApy}
                onChange={(e) => setMaxApy(e.target.value)}
                className="w-24"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-white/60 font-mono">Period (days)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                step={1}
                placeholder="Min"
                value={minDays}
                onChange={(e) => setMinDays(e.target.value)}
                className="w-24"
              />
              <span className="text-white/40">—</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                step={1}
                placeholder="Max"
                value={maxDays}
                onChange={(e) => setMaxDays(e.target.value)}
                className="w-24"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offers</SelectItem>
              <SelectItem value="lend">Lend Offers</SelectItem>
              <SelectItem value="borrow">Borrow Requests</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterToken} onValueChange={setFilterToken}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tokens</SelectItem>
              <SelectItem value="SOL">SOL</SelectItem>
              <SelectItem value="USDC">USDC</SelectItem>
              <SelectItem value="EURC">EURC</SelectItem>
              <SelectItem value="bSOL">agioSOL</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Default</SelectItem>
              <SelectItem value="highest-apy">Highest APY</SelectItem>
              <SelectItem value="lowest-apy">Lowest APY</SelectItem>
              <SelectItem value="highest-amount">Highest Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredOffers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">No loan offers available</p>
          <Link href="/borrow-lend">
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">Create Offer</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOffers.map((offer) => (
            <OfferCard key={offer.publicKey} offer={offer} onAccepted={refetch} />
          ))}
        </div>
      )}
    </div>
  )
}

function OfferCard({ offer, onAccepted }: { offer: ParsedLoan; onAccepted: () => void }) {
  const { acceptBorrowOffer, acceptLendOffer } = useLoanContract()
  const { isConnected: connected } = useWalletContext()
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  const isLendOffer = offer.offerType === 'lend'
  const counterpartyLabel = isLendOffer ? "Lender" : "Borrower"
  const counterpartyAddress = isLendOffer ? offer.lender : offer.borrower

  // Resolve counterparty name: Tapestry displayName > SNS domain > shortened address
  // Handles agent wallets via reverse lookup (agent → owner → profile)
  const { displayName: counterpartyDisplayName, profileWallet: counterpartyProfileWallet } = useWalletProfile(counterpartyAddress)
  const durationLabel = formatDuration(offer.duration)
  const expectedInterest = offer.debtAmountUi * offer.apy / 100 * offer.duration / (365 * 86400)
  const handleAccept = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setError(null)
    setAccepting(true)
    try {
      const params = {
        loanPublicKey: offer.publicKey,
        createKey: offer.createKey,
        debtMint: offer.debtMint,
        collateralMint: offer.collateralMint,
        debtTokenSymbol: offer.debtTokenSymbol,
        collateralTokenSymbol: offer.collateralTokenSymbol,
        debtAmountUi: offer.debtAmountUi,
        collateralAmountUi: offer.collateralAmountUi,
        borrower: offer.borrower || undefined,
        lender: offer.lender || undefined,
      }

      if (isLendOffer) {
        // Lend offer: user is borrower, call acceptBorrowOffer
        await acceptBorrowOffer(params)
      } else {
        // Borrow request: user is lender, call acceptLendOffer
        await acceptLendOffer(params)
      }

      setAccepted(true)
      onAccepted()
    } catch (err: any) {
      console.error('Failed to accept offer:', err)
      setError(err.message || 'Transaction failed')
    } finally {
      setAccepting(false)
      busyRef.current = false
    }
  }, [offer, isLendOffer, acceptBorrowOffer, acceptLendOffer, onAccepted])

  if (accepted) return null

  return (
    <Card className="border-2 border-gray-200 dark:border-white/20 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
      <CardHeader className="bg-transparent rounded-t-xl text-center py-1 border-b border-gray-200 dark:border-gray-800 relative z-10">
        <CardTitle className="text-lg font-bold text-black dark:text-white">
          {isLendOffer ? "LEND OFFER" : "BORROW REQUEST"}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4 bg-transparent relative z-10">
        <TooltipProvider>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>The total debt amount for this loan.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="font-semibold text-black dark:text-white">
                  {offer.debtAmountUi.toFixed(2)} {getTokenDisplaySymbol(offer.debtTokenSymbol)}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Collateral</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>The collateral amount securing this loan.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="font-semibold text-black dark:text-white">
                  {offer.collateralAmountUi.toFixed(4)} {getTokenDisplaySymbol(offer.collateralTokenSymbol)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">APY</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Annual Percentage Yield for this loan.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className={`font-semibold ${isLendOffer ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {offer.apy}%
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Interest</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground hover:text-blue-600 transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Expected interest for the loan term.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className={`font-semibold ${isLendOffer ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {expectedInterest.toFixed(4)} {getTokenDisplaySymbol(offer.debtTokenSymbol)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">{counterpartyLabel}</p>
                {counterpartyProfileWallet ? (
                  <Link
                    href={`/socialfi/profile/${counterpartyProfileWallet}`}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-sm truncate block"
                  >
                    {counterpartyDisplayName || 'Open'}
                  </Link>
                ) : (
                  <p className="font-semibold text-black dark:text-white text-sm truncate">Open</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">Period</p>
                <p className="font-semibold text-black dark:text-white">{durationLabel}</p>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
      <CardFooter className="py-2 flex flex-col gap-2 bg-transparent relative z-10">
        {null}
        {error && (
          <p className="text-xs text-red-500 text-center w-full">{error}</p>
        )}
        <Button
          className={`${isLendOffer ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"} text-white w-full disabled:opacity-50`}
          onClick={handleAccept}
          disabled={accepting || !connected}
        >
          {accepting ? 'Confirming...' : !connected ? 'Connect Wallet' : isLendOffer ? "Borrow Now" : "Lend Now"}
        </Button>
      </CardFooter>
    </Card>
  )
}
