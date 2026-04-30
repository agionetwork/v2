"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Rss, Check, X, ArrowRightLeft } from "lucide-react"
import Link from "next/link"
import { useFriends } from "@/components/friends-provider"
import { useLoans, LoanStatus, type ParsedLoan } from "@/hooks/useLoans"
import { useLoanContract, type AcceptOfferParams } from "@/hooks/useLoanContract"
import { useWalletContext } from "@/components/wallet-provider"
import { useWalletTokens } from "@/hooks/useWalletTokens"
import { toast } from "sonner"
import {
  getCustomProperty,
  type TapestryProfileResponse,
  type ActivityFeedItem,
} from "@/lib/tapestry"

const HIDDEN_FEED_KEY = "agio_hidden_feed_items"

function getHiddenItems(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(HIDDEN_FEED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function hideItem(contentId: string) {
  const hidden = getHiddenItems()
  hidden.add(contentId)
  localStorage.setItem(HIDDEN_FEED_KEY, JSON.stringify([...hidden]))
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatDuration(seconds: number): string {
  const days = Math.round(seconds / 86400)
  if (days >= 365) {
    const years = Math.round(days / 365)
    return years === 1 ? "1 year" : `${years} years`
  }
  if (days >= 30) {
    const months = Math.round(days / 30)
    return months === 1 ? "1 month" : `${months} months`
  }
  if (days >= 7) {
    const weeks = Math.round(days / 7)
    return weeks === 1 ? "1 week" : `${weeks} weeks`
  }
  return days === 1 ? "1 day" : `${days} days`
}

function buildLoanDescription(item: ActivityFeedItem, matchedLoan?: ParsedLoan): string {
  // Use matched loan data if available (richer), otherwise fall back to feed item
  const amount = matchedLoan ? matchedLoan.debtAmountUi : item.amount ? Number(item.amount) : null
  const debtToken = matchedLoan?.debtTokenSymbol || item.debtToken
  const collateralToken = matchedLoan?.collateralTokenSymbol || item.collateralToken
  const collateralAmount = matchedLoan
    ? matchedLoan.collateralAmountUi
    : item.collateralAmount
      ? Number(item.collateralAmount)
      : null
  const apy = matchedLoan ? matchedLoan.apy : item.apy ? Number(item.apy) : null
  const durationSec = matchedLoan
    ? matchedLoan.duration
    : item.duration
      ? Number(item.duration)
      : null
  const offerType = matchedLoan?.offerType || (item.eventType.includes("loan_created") ? "lend" : null)

  const typeLabel = offerType === "borrow" ? "borrow" : "lend"

  let desc = `Offering to ${typeLabel}`
  if (amount && debtToken) desc += ` ${amount} ${debtToken}`
  if (apy != null) desc += ` at ${apy}% APY`
  if (durationSec) desc += ` for ${formatDuration(durationSec)}`
  if (collateralAmount && collateralToken) {
    desc += `, collateralized with ${collateralAmount} ${collateralToken}`
  } else if (collateralToken) {
    desc += `, collateral in ${collateralToken}`
  }

  return desc
}

function ActivityFeedCard({
  item,
  profile,
  matchedLoan,
  onAccept,
  onDecline,
  accepting,
}: {
  item: ActivityFeedItem
  profile?: TapestryProfileResponse
  matchedLoan?: ParsedLoan
  onAccept: () => void
  onDecline: () => void
  accepting: boolean
}) {
  const displayName = profile
    ? getCustomProperty(profile.profile, "displayName") || profile.profile.username
    : item.profileId.slice(0, 8)
  const pfp = profile
    ? getCustomProperty(profile.profile, "profileImage") || profile.profile.image
    : undefined

  const description = buildLoanDescription(item, matchedLoan)
  const profileWallet = profile?.profile?.walletAddress

  return (
    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-200/10 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {profileWallet ? (
            <Link href={`/socialfi/profile/${profileWallet}`} className="flex-shrink-0 mt-0.5">
              <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
                {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
                <AvatarFallback className="bg-blue-600 text-white text-sm">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar className="h-10 w-10 flex-shrink-0 mt-0.5">
              {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
              <AvatarFallback className="bg-blue-600 text-white text-sm">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {profileWallet ? (
                  <Link href={`/socialfi/profile/${profileWallet}`} className="font-semibold text-sm truncate hover:text-blue-600 transition-colors">{displayName}</Link>
                ) : (
                  <span className="font-semibold text-sm truncate">{displayName}</span>
                )}
                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground flex-shrink-0">Loan Offer</span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {timeAgo(item.createdAt)}
              </span>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed mt-2">{description}</p>
            {matchedLoan && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  size="sm"
                  className="bg-[#1358EC] hover:bg-blue-700 text-white text-xs"
                  onClick={onAccept}
                  disabled={accepting}
                >
                  {accepting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Accept
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={onDecline}
                  disabled={accepting}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Decline
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ActivityFeed() {
  const { friends, activityFeed, loadingFeed, loadingFriends } = useFriends()
  const { loans, isMyWallet } = useLoans()
  const { acceptBorrowOffer, acceptLendOffer } = useLoanContract()
  const { address } = useWalletContext()
  const { tokens: walletTokens } = useWalletTokens()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())

  // Resolve agent wallets for all friends so we can match agent-created loans
  const [friendAgentWallets, setFriendAgentWallets] = useState<Map<string, string>>(new Map())
  const friendWalletsKeyRef = useRef("")

  useEffect(() => {
    setHiddenItems(getHiddenItems())
  }, [])

  // Fetch agent wallets for all friends
  useEffect(() => {
    const wallets = friends
      .map((f) => f.profile.walletAddress)
      .filter(Boolean) as string[]
    const key = wallets.sort().join(",")
    if (key === friendWalletsKeyRef.current || wallets.length === 0) return
    friendWalletsKeyRef.current = key

    let cancelled = false
    Promise.all(
      wallets.map((w) =>
        fetch(`/api/agent/public-key?wallet=${w}`)
          .then((r) => r.json())
          .then((data) => [w, data.agentPublicKey || null] as const)
          .catch(() => [w, null] as const)
      )
    ).then((results) => {
      if (cancelled) return
      const map = new Map<string, string>()
      for (const [ownerWallet, agentPk] of results) {
        if (agentPk) map.set(ownerWallet, agentPk)
      }
      setFriendAgentWallets(map)
    })
    return () => { cancelled = true }
  }, [friends])

  const profileMap = useMemo(() => {
    const map = new Map<string, TapestryProfileResponse>()
    for (const f of friends) {
      map.set(f.profile.id, f)
    }
    return map
  }, [friends])

  // Build wallet lookup: profileId → walletAddress
  const profileWalletMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of friends) {
      if (f.profile.walletAddress) {
        map.set(f.profile.id, f.profile.walletAddress)
      }
    }
    return map
  }, [friends])

  // Build reverse lookup: agentWallet → ownerWallet, and ownerWallet → profileId
  const agentToOwnerMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const [owner, agent] of friendAgentWallets.entries()) {
      map.set(agent, owner)
    }
    return map
  }, [friendAgentWallets])

  const walletToProfileIdMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of friends) {
      if (f.profile.walletAddress) {
        map.set(f.profile.walletAddress.toLowerCase(), f.profile.id)
      }
    }
    return map
  }, [friends])

  // Generate synthetic feed items from on-chain pending loans created by friends' agent wallets
  // This ensures offers appear even if no Tapestry activity was posted (e.g. MCP-created loans before the fix)
  const syntheticFeedItems = useMemo(() => {
    if (!address || friendAgentWallets.size === 0) return [] as ActivityFeedItem[]

    const pendingLoans = loans.filter((l) => l.status === LoanStatus.Pending)
    const items: ActivityFeedItem[] = []

    // Collect all Tapestry feed loan keys to avoid duplicates
    const tapestryLoanKeys = new Set<string>()
    for (const item of activityFeed) {
      if (item.debtToken && item.amount) {
        tapestryLoanKeys.add(`${item.profileId}:${item.debtToken}:${item.amount}`)
      }
    }

    for (const loan of pendingLoans) {
      // Skip own loans
      if (isMyWallet(loan.lender)) continue
      if (isMyWallet(loan.borrower)) continue

      // Check if the loan creator is a friend's agent wallet
      const creatorAddr = loan.lender || loan.borrower
      if (!creatorAddr) continue

      const ownerWallet = agentToOwnerMap.get(creatorAddr)
      if (!ownerWallet) continue

      const profileId = walletToProfileIdMap.get(ownerWallet.toLowerCase())
      if (!profileId) continue

      // Skip if a Tapestry feed item already covers this loan
      const dedupeKey = `${profileId}:${loan.debtTokenSymbol}:${loan.debtAmountUi}`
      if (tapestryLoanKeys.has(dedupeKey)) continue

      items.push({
        contentId: `onchain_${loan.publicKey}`,
        profileId,
        message: `Created a ${loan.offerType} offer: ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY`,
        eventType: "loan_created",
        debtToken: loan.debtTokenSymbol,
        collateralToken: loan.collateralTokenSymbol,
        amount: String(loan.debtAmountUi),
        collateralAmount: String(loan.collateralAmountUi),
        apy: String(loan.apy),
        duration: String(loan.duration),
        createdAt: new Date().toISOString(),
      })
    }
    return items
  }, [loans, friendAgentWallets, agentToOwnerMap, walletToProfileIdMap, activityFeed, address, isMyWallet])

  // Combine Tapestry feed items with synthetic on-chain items
  const combinedFeed = useMemo(() => {
    return [...activityFeed, ...syntheticFeedItems]
  }, [activityFeed, syntheticFeedItems])

  // Match feed items to pending on-chain loans and identify stale items
  const { loanMatchMap, staleContentIds } = useMemo(() => {
    const map = new Map<string, ParsedLoan>()
    const stale = new Set<string>()
    if (!address) return { loanMatchMap: map, staleContentIds: stale }

    const pendingLoans = loans.filter((l) => l.status === LoanStatus.Pending)

    for (const item of combinedFeed) {
      const friendWallet = profileWalletMap.get(item.profileId)
      if (!friendWallet) continue

      // Also get the friend's agent wallet (Privy) for matching agent-created loans
      const friendAgent = friendAgentWallets.get(friendWallet) || null

      // Find a pending loan created by this friend that matches the feed item
      const match = pendingLoans.find((loan) => {
        // Check the friend is the creator (lender or borrower) via owner wallet OR agent wallet
        const isFriendAddress = (addr: string | null) => {
          if (!addr) return false
          return addr.toLowerCase() === friendWallet.toLowerCase() ||
            (friendAgent !== null && addr === friendAgent)
        }
        const isCreator = isFriendAddress(loan.lender) || isFriendAddress(loan.borrower)
        if (!isCreator) return false

        // Match token symbols
        if (item.debtToken && loan.debtTokenSymbol !== item.debtToken) return false
        if (item.collateralToken && loan.collateralTokenSymbol !== item.collateralToken) return false

        // Don't show accept for own loans (including own agent wallet)
        if (isMyWallet(loan.lender)) return false
        if (isMyWallet(loan.borrower)) return false

        return true
      })

      if (match) {
        map.set(item.contentId, match)
      } else if (!item.contentId.startsWith("onchain_")) {
        // No pending loan matches → loan was accepted/repaid/rescinded/foreclosed
        // Only mark Tapestry items as stale (synthetic items just disappear when loan is gone)
        stale.add(item.contentId)
      }
    }
    return { loanMatchMap: map, staleContentIds: stale }
  }, [combinedFeed, loans, profileWalletMap, friendAgentWallets, address, isMyWallet])

  const getWalletBalance = useCallback(
    (symbol: string): number => {
      const t = walletTokens.find((wt) => wt.symbol === symbol)
      return t?.balance ?? 0
    },
    [walletTokens],
  )

  const handleAccept = useCallback(
    async (item: ActivityFeedItem, loan: ParsedLoan) => {
      // Balance pre-check: if user is borrower they need collateral; if lender they need debt tokens
      const isBorrower = loan.offerType === "lend"
      const requiredSymbol = isBorrower ? loan.collateralTokenSymbol : loan.debtTokenSymbol
      const requiredAmount = isBorrower ? loan.collateralAmountUi : loan.debtAmountUi

      if (walletTokens.length > 0) {
        const balance = getWalletBalance(requiredSymbol)
        if (balance < requiredAmount) {
          toast.error(
            balance === 0
              ? `You don't have any ${requiredSymbol} in your wallet.`
              : `Insufficient ${requiredSymbol} balance: you have ${balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} but need ${requiredAmount.toLocaleString()}.`,
          )
          return
        }
        const solBalance = getWalletBalance("SOL")
        const solNeeded = requiredSymbol === "SOL" ? requiredAmount + 0.01 : 0.01
        if (solBalance < solNeeded) {
          toast.error(`Insufficient SOL for transaction fees. You have ${solBalance.toFixed(4)} SOL.`)
          return
        }
      }

      setAcceptingId(item.contentId)
      try {
        const params: AcceptOfferParams = {
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

        if (loan.offerType === "lend") {
          // Lender created → current user is borrower accepting
          await acceptBorrowOffer(params)
        } else {
          // Borrower created → current user is lender accepting
          await acceptLendOffer(params)
        }

        toast.success("Loan accepted!")
        // Hide from feed after acceptance
        hideItem(item.contentId)
        setHiddenItems((prev) => new Set([...prev, item.contentId]))
      } catch (err: any) {
        toast.error(err?.message || "Failed to accept loan")
      } finally {
        setAcceptingId(null)
      }
    },
    [acceptBorrowOffer, acceptLendOffer, walletTokens, getWalletBalance]
  )

  const handleDecline = useCallback((contentId: string) => {
    hideItem(contentId)
    setHiddenItems((prev) => new Set([...prev, contentId]))
  }, [])

  // Filter out hidden items, stale (non-pending) loans, and deduplicate by offer
  const visibleFeed = useMemo(() => {
    const seenKeys = new Set<string>()
    const seenLoans = new Set<string>()
    return combinedFeed.filter((item) => {
      if (hiddenItems.has(item.contentId)) return false
      if (staleContentIds.has(item.contentId)) return false
      // Synthetic items without a matching loan should not show
      if (item.contentId.startsWith("onchain_") && !loanMatchMap.has(item.contentId)) return false

      // Deduplicate by matched loan publicKey (prevents Tapestry + synthetic dupes for same loan)
      const matchedLoan = loanMatchMap.get(item.contentId)
      if (matchedLoan) {
        if (seenLoans.has(matchedLoan.publicKey)) return false
        seenLoans.add(matchedLoan.publicKey)
      }

      // Deduplicate by offer characteristics (same person + same tokens + same amount)
      const dedupeKey = `${item.profileId}:${item.debtToken}:${item.collateralToken}:${item.amount}`
      if (seenKeys.has(dedupeKey)) return false
      seenKeys.add(dedupeKey)
      return true
    })
  }, [combinedFeed, hiddenItems, staleContentIds, loanMatchMap])

  if (loadingFriends || loadingFeed) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (friends.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Rss className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No activity yet</p>
          <p className="text-sm">Add people to your network to see their loan offers here.</p>
        </CardContent>
      </Card>
    )
  }

  if (visibleFeed.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Rss className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No recent activity</p>
          <p className="text-sm">Your network hasn&apos;t created any loan offers yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {visibleFeed.map((item) => {
        const matchedLoan = loanMatchMap.get(item.contentId)
        return (
          <ActivityFeedCard
            key={item.contentId}
            item={item}
            profile={profileMap.get(item.profileId)}
            matchedLoan={matchedLoan}
            onAccept={() => matchedLoan && handleAccept(item, matchedLoan)}
            onDecline={() => handleDecline(item.contentId)}
            accepting={acceptingId === item.contentId}
          />
        )
      })}
    </div>
  )
}
