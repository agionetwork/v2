"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { LayoutGrid, List as ListIcon } from "lucide-react"
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

/**
 * Token-amount formatter — always plain decimals, never scientific
 * notation. Scales the decimal count by magnitude so tiny interest
 * values (e.g. 1% APY on a small principal) still render as a
 * non-zero number, while big numbers stay readable. Trailing zeros
 * are trimmed.
 */
function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0"
  const abs = Math.abs(value)
  let decimals: number
  if (abs >= 1) decimals = 4
  else if (abs >= 0.01) decimals = 6
  else if (abs >= 0.0001) decimals = 8
  else if (abs >= 0.000001) decimals = 10
  else decimals = 12
  return value.toFixed(decimals).replace(/\.?0+$/, '')
}

const TOKEN_LOGOS: Record<string, string> = {
  SOL: '/images/sol-logo.png',
  USDC: '/images/usdc-logo.png',
  USDT: '/images/tether-usdt-logo.png',
  EURC: '/images/eurc-logo.png',
  bSOL: '/images/bluebgagio.png',
}

const getTokenLogo = (symbol: string): string =>
  TOKEN_LOGOS[symbol] || '/images/placeholder-logo.png'

/** Inline `[logo] $TICKER` chip used in cards + the list view. */
function TokenBadge({ symbol, size = 16 }: { symbol: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <img
        src={getTokenLogo(symbol)}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full object-contain shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png' }}
      />
      <span>${getTokenDisplaySymbol(symbol)}</span>
    </span>
  )
}

const ACCEPTED_TOKENS = ['SOL', 'USDC', 'EURC', 'bSOL'] as const

export default function LoanOffersPageClient() {
  const searchParams = useSearchParams()
  const { openOffers, loading, refetch, isMyWallet, myWalletsReady } = useLoans()
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
  // Range filters use the slider's full bounds as "no constraint" — no extra
  // logic needed in the consumer to know whether the filter is active.
  const APY_MIN = 0
  const APY_MAX = 100
  const DAYS_MIN = 1
  const DAYS_MAX = 365
  const [apyRange, setApyRange] = useState<[number, number]>([APY_MIN, APY_MAX])
  const [daysRange, setDaysRange] = useState<[number, number]>([DAYS_MIN, DAYS_MAX])

  // View mode: card grid (default) or condensed list. Mobile is always cards
  // — the list table doesn't fit the narrow viewport. We track the user's
  // preference, and the render pass overrides it to "cards" when the
  // viewport is narrow.
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards")
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])
  const effectiveViewMode = isMobile ? "cards" : viewMode

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
    const [apyLo, apyHi] = apyRange
    if (apyLo > APY_MIN) offers = offers.filter(l => l.apy >= apyLo)
    if (apyHi < APY_MAX) offers = offers.filter(l => l.apy <= apyHi)

    // Period range (loan duration is stored in seconds; UI is in days)
    const [daysLo, daysHi] = daysRange
    if (daysLo > DAYS_MIN) offers = offers.filter(l => l.duration >= daysLo * 86400)
    if (daysHi < DAYS_MAX) offers = offers.filter(l => l.duration <= daysHi * 86400)

    // Sort
    if (sortBy === "highest-apy") {
      offers = [...offers].sort((a, b) => b.apy - a.apy)
    } else if (sortBy === "lowest-apy") {
      offers = [...offers].sort((a, b) => a.apy - b.apy)
    } else if (sortBy === "highest-amount") {
      offers = [...offers].sort((a, b) => b.debtAmountUi - a.debtAmountUi)
    }

    return offers
  }, [openOffers, filterType, filterToken, sortBy, apyRange, daysRange, publicKey, isMyWallet])

  // Gate the offers list on BOTH the loan-fetch AND the agent +
  // stealth lookups. Without the second wait, the user's own
  // agent/stealth offers briefly slip through isMyWallet's filter
  // (see useLoans) and the marketplace flashes them before
  // pulling them out — Surfer reported "6 offers → 4 offers".
  if (loading || !myWalletsReady) {
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
      <div className="flex flex-wrap items-end gap-4 mb-8">
        {/* View-mode toggle — always visible, sits to the LEFT of the
            range sliders. Mobile still falls back to "cards" via the
            effectiveViewMode override below; the toggle stays clickable
            so the affordance is consistent regardless of viewport. */}
        <div
          role="group"
          aria-label="View mode"
          className="inline-flex items-center gap-1 self-end"
        >
          <Button
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="sm"
            className="h-9 px-3 gap-1.5 text-xs font-medium"
            aria-label="Card view"
            aria-pressed={viewMode === "cards"}
            title="Show offers as cards"
            onClick={() => setViewMode("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Cards</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-9 px-3 gap-1.5 text-xs font-medium"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            title="Show offers as a list"
            onClick={() => setViewMode("list")}
          >
            <ListIcon className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
        </div>

        {/* Range sliders — APY (%) + Period (days). Sliders sit at full
            range when no constraint is active; the consumer treats hitting
            a bound as "no filter" so the labels just read live values. */}
        <div className="flex flex-col gap-1 w-52">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">APY</label>
            <span className="text-xs font-mono text-foreground/80">
              {apyRange[0]}% — {apyRange[1]}%
            </span>
          </div>
          <Slider
            value={apyRange}
            onValueChange={(v) => setApyRange([v[0], v[1]] as [number, number])}
            min={APY_MIN}
            max={APY_MAX}
            step={1}
            className="py-2"
          />
        </div>
        <div className="flex flex-col gap-1 w-52">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Period</label>
            <span className="text-xs font-mono text-foreground/80">
              {daysRange[0]}d — {daysRange[1]}d
            </span>
          </div>
          <Slider
            value={daysRange}
            onValueChange={(v) => setDaysRange([v[0], v[1]] as [number, number])}
            min={DAYS_MIN}
            max={DAYS_MAX}
            step={1}
            className="py-2"
          />
        </div>

        <div className="flex flex-wrap gap-4 ml-auto">
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
              {/* Drop bSOL/agioSOL from the marketplace filter — it
                  isn't surfaced as a borrowable principal yet. */}
              {ACCEPTED_TOKENS.filter((sym) => sym !== "bSOL").map((sym) => (
                <SelectItem key={sym} value={sym}>
                  <span className="inline-flex items-center gap-2">
                    <img
                      src={getTokenLogo(sym)}
                      alt=""
                      width={14}
                      height={14}
                      className="rounded-full object-contain shrink-0"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/images/placeholder-logo.png"
                      }}
                    />
                    {getTokenDisplaySymbol(sym)}
                  </span>
                </SelectItem>
              ))}
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
      ) : effectiveViewMode === "list" ? (
        <OffersTable offers={filteredOffers} onAccepted={refetch} />
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

function OffersTable({ offers, onAccepted }: { offers: ParsedLoan[]; onAccepted: () => void }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Type</TableHead>
            <TableHead className="text-center">Counterparty</TableHead>
            <TableHead className="text-center">Amount</TableHead>
            <TableHead className="text-center">Collateral</TableHead>
            <TableHead className="text-center">APY</TableHead>
            <TableHead className="text-center">Duration</TableHead>
            <TableHead className="text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => (
            <OfferRow key={offer.publicKey} offer={offer} onAccepted={onAccepted} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function OfferRow({ offer, onAccepted }: { offer: ParsedLoan; onAccepted: () => void }) {
  const { acceptBorrowOffer, acceptLendOffer } = useLoanContract()
  const { isConnected: connected } = useWalletContext()
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const busyRef = useRef(false)

  const isLendOffer = offer.offerType === "lend"
  const counterpartyAddress = isLendOffer ? offer.lender : offer.borrower
  const {
    displayName: counterpartyName,
    profileWallet,
    isStealth,
    loading: profileLoading,
  } = useWalletProfile(counterpartyAddress)

  const handleAccept = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
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
        await acceptBorrowOffer(params)
      } else {
        await acceptLendOffer(params)
      }
      setAccepted(true)
      onAccepted()
    } catch (err) {
      console.error("Failed to accept offer:", err)
    } finally {
      setAccepting(false)
      busyRef.current = false
    }
  }, [offer, isLendOffer, acceptBorrowOffer, acceptLendOffer, onAccepted])

  if (accepted) return null

  // Counterparty link colour follows the same lend / borrow code as
  // the Type and Action cells — lend offer counterparties (= the
  // lender) read blue, borrow request counterparties (= the borrower)
  // read red.
  const counterpartyLinkClass = isLendOffer
    ? "text-blue-600 dark:text-blue-400 hover:underline font-medium"
    : "text-red-600 dark:text-red-400 hover:underline font-medium"
  // Filter out the address-like fallbacks useWalletProfile returns
  // when no real Tapestry nickname or SNS domain exists (shortened
  // form, full pubkey lowercased, base58 substring of the wallet) so
  // we never end up rendering a wallet shape next to / in place of a
  // username.
  const isAddressLikeName = (val: string | null | undefined, addr: string) => {
    if (!val) return false
    const v = val.trim()
    if (!v) return false
    if (v.includes("...") || v.includes("…")) return true
    const a = addr.toLowerCase()
    if (v.toLowerCase() === a) return true
    if (
      v.length >= 6 &&
      /^[1-9A-HJ-NP-Za-km-z]+$/.test(v) &&
      a.includes(v.toLowerCase())
    ) {
      return true
    }
    return false
  }
  const realCounterpartyName =
    counterpartyAddress && !isAddressLikeName(counterpartyName, counterpartyAddress)
      ? counterpartyName
      : null
  // Cell renders one of: "Open" (no counterparty), italic
  // "Anonymous" (stealth), the username link (real Tapestry
  // nickname / SNS domain), or — when no profile exists for the
  // wallet — the shortened pubkey "ABCD…WXYZ". The shortened form
  // is also the placeholder while the hook resolves, so the cell
  // never goes from a long pubkey to a short one and never from a
  // wallet shape to a user-shape mid-load. Worst-case transition is
  // shortened address → username, which only happens when a real
  // nickname actually exists.
  // Wait for the profile resolve to settle before painting anything,
  // so the cell goes straight from blank → username with no skeleton
  // and no wallet flicker between them. Once loading is false we
  // either show the real nickname or — if the wallet has no profile
  // — the shortened-address fallback.
  const counterpartyCell = !counterpartyAddress ? (
    <span className="text-muted-foreground">Open</span>
  ) : isStealth ? (
    <span className="italic text-muted-foreground">Anonymous</span>
  ) : profileLoading && !realCounterpartyName ? null : (
    <Link
      href={`/socialfi/profile/${profileWallet || counterpartyAddress}`}
      className={counterpartyLinkClass}
    >
      {realCounterpartyName || shortenAddress(counterpartyAddress)}
    </Link>
  )

  return (
    <TableRow>
      {/* Type indicator — same colour as the action button: lend = blue,
          borrow = red. Read-only label, NOT a button. */}
      <TableCell
        className={`text-center text-sm font-mono uppercase tracking-wider font-semibold ${
          isLendOffer
            ? "text-blue-600 dark:text-blue-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {isLendOffer ? "Lend" : "Borrow"}
      </TableCell>
      <TableCell className="text-center text-sm">{counterpartyCell}</TableCell>
      <TableCell className="text-center text-sm font-medium">
        {offer.debtAmountUi.toFixed(2)} <TokenBadge symbol={offer.debtTokenSymbol} />
      </TableCell>
      <TableCell className="text-center text-sm font-medium">
        {offer.collateralAmountUi.toFixed(4)} <TokenBadge symbol={offer.collateralTokenSymbol} />
      </TableCell>
      <TableCell className={`text-center text-sm font-semibold ${isLendOffer ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
        {offer.apy}%
      </TableCell>
      <TableCell className="text-center text-sm">{formatDuration(offer.duration)}</TableCell>
      <TableCell className="text-center">
        {/* Always "Accept"; colour follows the offer's type so a lend
            offer's accept button is blue and a borrow request's accept
            button is red. */}
        <Button
          size="sm"
          variant={isLendOffer ? "default" : "destructive"}
          className="text-xs"
          disabled={!connected || accepting}
          onClick={handleAccept}
        >
          {accepting ? "Confirming…" : "Accept"}
        </Button>
      </TableCell>
    </TableRow>
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
  const {
    displayName: counterpartyDisplayName,
    profileWallet: counterpartyProfileWallet,
    isStealth: counterpartyIsStealth,
    loading: counterpartyLoading,
  } = useWalletProfile(counterpartyAddress)
  // Reject the address-shaped fallbacks useWalletProfile returns when
  // no real Tapestry nickname or SNS domain is set (shortened form,
  // pubkey lowercased, base58 substring of the wallet) so the card
  // never flashes a wallet shape in place of a username.
  const isCardAddressLikeName = (val: string | null | undefined, addr: string) => {
    if (!val || !addr) return false
    const v = val.trim()
    if (!v) return false
    if (v.includes("...") || v.includes("…")) return true
    const a = addr.toLowerCase()
    if (v.toLowerCase() === a) return true
    if (
      v.length >= 6 &&
      /^[1-9A-HJ-NP-Za-km-z]+$/.test(v) &&
      a.includes(v.toLowerCase())
    ) {
      return true
    }
    return false
  }
  const realCardCounterpartyName =
    counterpartyAddress && !isCardAddressLikeName(counterpartyDisplayName, counterpartyAddress)
      ? counterpartyDisplayName
      : null
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
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>The total debt amount for this loan.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="font-semibold text-black dark:text-white flex items-center gap-1.5">
                  {offer.debtAmountUi.toFixed(2)} <TokenBadge symbol={offer.debtTokenSymbol} />
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Collateral</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>The collateral amount securing this loan.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="font-semibold text-black dark:text-white flex items-center gap-1.5">
                  {offer.collateralAmountUi.toFixed(4)} <TokenBadge symbol={offer.collateralTokenSymbol} />
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">APY</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
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
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help select-none leading-none transition-colors bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-600 dark:text-blue-200">?</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Expected interest for the loan term.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className={`font-semibold flex items-center gap-1.5 ${isLendOffer ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {formatTokenAmount(expectedInterest)} <TokenBadge symbol={offer.debtTokenSymbol} />
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">{counterpartyLabel}</p>
                {counterpartyIsStealth ? (
                  <p className="font-semibold italic text-muted-foreground text-sm truncate">Anonymous</p>
                ) : !counterpartyAddress ? (
                  <p className="font-semibold text-black dark:text-white text-sm truncate">Open</p>
                ) : counterpartyLoading && !realCardCounterpartyName ? (
                  // Hold an empty line of the right height while the
                  // profile resolves, so the card pops straight from
                  // blank → username without a skeleton / wallet flash.
                  <p className="font-semibold text-sm truncate" aria-hidden>
                    &nbsp;
                  </p>
                ) : (
                  <Link
                    href={`/socialfi/profile/${counterpartyProfileWallet || counterpartyAddress}`}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-sm truncate block"
                  >
                    {realCardCounterpartyName || shortenAddress(counterpartyAddress)}
                  </Link>
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
          variant={isLendOffer ? "destructive" : "default"}
          className="w-full"
          onClick={handleAccept}
          disabled={accepting || !connected}
        >
          {accepting ? 'Confirming...' : !connected ? 'Connect Wallet' : isLendOffer ? "Borrow Now" : "Lend Now"}
        </Button>
      </CardFooter>
    </Card>
  )
}
