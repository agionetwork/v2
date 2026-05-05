"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2, UserPlus, Check, Clock, ArrowLeft, ExternalLink, Star,
} from "lucide-react"
import { useFriends } from "@/components/friends-provider"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { useLoans, LoanStatus, getStatusLabel } from "@/hooks/useLoans"
import { useLoanContract, type AcceptOfferParams } from "@/hooks/useLoanContract"
import { useWalletContext } from "@/components/wallet-provider"
import {
  searchProfiles,
  getCustomProperty,
  type TapestryProfileResponse,
} from "@/lib/tapestry"
import { toast } from "sonner"
import { useSolDomain } from "@/hooks/useSNS"
import { useFavorites } from "@/hooks/useFavorites"
import { FairScoreCard } from "@/components/fairscore-badge"
import type { FairScore } from "@/lib/fairscale"

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + "..." + addr.slice(-4)
}

export default function ProfilePage() {
  const params = useParams()
  const walletAddress = params.wallet as string

  const { profile: myProfile } = useTapestryProfile()
  const { friends, getFriendshipStatus, sendRequest, acceptRequest, receivedRequests } = useFriends()
  const { loans } = useLoans()
  const { acceptBorrowOffer, acceptLendOffer } = useLoanContract()
  const { address: myWallet } = useWalletContext()
  const { isFavorite, toggleFavorite } = useFavorites()

  const [profile, setProfile] = useState<TapestryProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [acceptingLoan, setAcceptingLoan] = useState<string | null>(null)
  // Resolve agent wallet for the profile being viewed (their agent creates loans on-chain)
  const [profileAgentWallet, setProfileAgentWallet] = useState<string | null>(null)
  const [fairScore, setFairScore] = useState<FairScore | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setFairScore(null)
      return
    }
    let cancelled = false
    fetch(`/api/fairscale/score?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data: FairScore) => {
        if (!cancelled && data && typeof data.score === "number") setFairScore(data)
      })
      .catch(() => { if (!cancelled) setFairScore(null) })
    return () => { cancelled = true }
  }, [walletAddress])

  const solDomain = useSolDomain(walletAddress)

  // Load profile from Tapestry + resolve agent wallet
  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        const result = await searchProfiles(walletAddress, 10, 0)
        const found = (result.profiles || []).find(
          (p) => p.profile.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
        )
        setProfile(found || null)
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }
    if (walletAddress) loadProfile()

    // Fetch agent wallet for this profile
    fetch(`/api/agent/public-key?wallet=${walletAddress}`)
      .then(res => res.json())
      .then(data => setProfileAgentWallet(data.agentPublicKey || null))
      .catch(() => setProfileAgentWallet(null))
  }, [walletAddress])

  const profileData = profile?.profile
  const displayName = profileData
    ? getCustomProperty(profileData, "displayName") || profileData.username
    : solDomain || shortenAddress(walletAddress)
  const pfp = profileData ? getCustomProperty(profileData, "profileImage") || profileData.image : undefined
  const bio = profileData ? getCustomProperty(profileData, "bio") : undefined
  const twitter = profileData ? getCustomProperty(profileData, "twitter") : undefined
  const twitterVerified = profileData ? getCustomProperty(profileData, "twitterVerified") === "true" : false
  const telegram = profileData ? getCustomProperty(profileData, "telegram") : undefined

  const myProfileId = myProfile?.profile?.id || null
  const isMe = myProfileId !== null && profileData?.id === myProfileId
  const friendshipStatus = profileData && myProfileId ? getFriendshipStatus(profileData.id) : "none"

  // Network count (mutual friends)
  const networkCount = friends.length

  // Check if a loan address belongs to this profile (owner wallet or agent wallet)
  const isProfileWallet = (addr: string | null) => {
    if (!addr) return false
    return addr.toLowerCase() === walletAddress.toLowerCase() ||
      (profileAgentWallet !== null && addr === profileAgentWallet)
  }

  // Loan stats for this wallet (includes agent-created loans)
  const userLoans = useMemo(() => {
    return loans.filter(
      (l) => isProfileWallet(l.lender) || isProfileWallet(l.borrower)
    )
  }, [loans, walletAddress, profileAgentWallet])

  const stats = useMemo(() => {
    let totalLent = 0
    let totalBorrowed = 0
    let loansRepaid = 0
    let loansForeclosed = 0
    let activeCount = 0

    for (const loan of userLoans) {
      const isLender = isProfileWallet(loan.lender)
      const isBorrower = isProfileWallet(loan.borrower)

      if (loan.status === LoanStatus.Accepted || loan.status === LoanStatus.Repaid || loan.status === LoanStatus.Foreclosed) {
        if (isLender) totalLent += loan.debtAmountUi
        if (isBorrower) totalBorrowed += loan.debtAmountUi
      }
      if (loan.status === LoanStatus.Accepted) activeCount++
      if (loan.status === LoanStatus.Repaid) loansRepaid++
      if (loan.status === LoanStatus.Foreclosed) loansForeclosed++
    }

    return { totalLent, totalBorrowed, loansRepaid, loansForeclosed, activeCount }
  }, [userLoans, walletAddress, profileAgentWallet])

  // Pending offers from this user (public only)
  const pendingOffers = useMemo(() => {
    return userLoans.filter(
      (l) => l.status === LoanStatus.Pending && l.privateStatus === 0
    )
  }, [userLoans])

  const handleAcceptOffer = useCallback(
    async (loan: typeof pendingOffers[number]) => {
      setAcceptingLoan(loan.publicKey)
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
          await acceptBorrowOffer(params)
        } else {
          await acceptLendOffer(params)
        }

        toast.success("Loan accepted!")
      } catch (err: any) {
        toast.error(err?.message || "Failed to accept offer")
      } finally {
        setAcceptingLoan(null)
      }
    },
    [acceptBorrowOffer, acceptLendOffer]
  )

  const handleAddFriend = async () => {
    if (!profileData) return
    setActionLoading(true)
    const success = await sendRequest(profileData.id, profileData.walletAddress)
    if (success) {
      toast.success(`Friend request sent to ${displayName}`)
    } else {
      toast.error("Failed to send request")
    }
    setActionLoading(false)
  }

  const handleAcceptFriend = async () => {
    if (!profileData) return
    const request = receivedRequests.find((r) => r.senderProfileId === profileData.id)
    if (!request) return
    setActionLoading(true)
    const success = await acceptRequest(request.contentId, request.pairContentId, profileData.id)
    if (success) {
      toast.success(`You are now friends with ${displayName}`)
    } else {
      toast.error("Failed to accept request")
    }
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link href="/socialfi" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to SocialFi
      </Link>

      {/* Profile Header */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-800 text-white border-0 relative">
        {/* Favourite star — top-right */}
        {!isMe && myProfileId && profileData && (
          <button
            onClick={async () => {
              const nowFav = await toggleFavorite(profileData.id)
              toast.success(nowFav ? `Added ${displayName} to favourites` : `Removed ${displayName} from favourites`)
            }}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition-colors z-10"
            title={isFavorite(profileData.id) ? "Remove from favourites" : "Add to favourites"}
          >
            <Star
              className={`h-5 w-5 ${
                isFavorite(profileData.id)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-white/40 hover:text-yellow-300"
              }`}
            />
          </button>
        )}
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="h-24 w-24 border-2 border-white/30">
              {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
              <AvatarFallback className="bg-white/20 text-white text-3xl">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h1 className="text-2xl font-bold">{displayName}</h1>
                {solDomain && solDomain !== displayName && (
                  <p className="text-white/70 text-sm">{solDomain}</p>
                )}
              </div>

              {twitter && (
                <a
                  href={`https://x.com/${twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-white/90 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  @{twitter}
                  {twitterVerified && (
                    <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified">
                      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.08 4.71l-3.96-3.96 1.41-1.41 2.55 2.55 5.66-5.66 1.41 1.41-7.07 7.07z" />
                    </svg>
                  )}
                </a>
              )}

              {telegram && (
                <a
                  href={`https://t.me/${telegram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white/90 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  {telegram}
                </a>
              )}

              {bio && <p className="text-white/80 text-sm">{bio}</p>}

              {/* Action button */}
              {!isMe && myProfileId && profileData && (
                <div className="pt-1">
                  {friendshipStatus === "friend" ? (
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 py-1.5 px-4">
                      <Check className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : friendshipStatus === "pending_sent" ? (
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 py-1.5 px-4">
                      <Clock className="h-3 w-3 mr-1" />
                      Request Sent
                    </Badge>
                  ) : friendshipStatus === "pending_received" ? (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleAcceptFriend}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Accept Friend Request
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-white text-blue-700 hover:bg-white/90"
                      onClick={handleAddFriend}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          Add Friend
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {isMe && (
                <Link
                  href="/socialfi/edit-profile"
                  className="inline-block bg-white text-blue-700 hover:bg-white/90 font-medium px-4 py-1.5 rounded-md text-sm transition-colors"
                >
                  Edit Profile
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reputation */}
      {fairScore && (
        <FairScoreCard
          score={fairScore.score}
          tier={fairScore.tier}
          subOnchain={fairScore.subOnchain}
          subSocial={fairScore.subSocial}
          subBehavioral={fairScore.subBehavioral}
        />
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2">
        <Card className="border-2 border-gray-200 dark:border-gray-800 bg-transparent">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.loansRepaid}</div>
            <p className="text-xs text-muted-foreground">Repaid</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 bg-transparent">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.loansForeclosed}</div>
            <p className="text-xs text-muted-foreground">Foreclosed</p>
          </CardContent>
        </Card>
      </div>

      {/* Available Offers */}
      <Card className="border-2 border-gray-200 dark:border-gray-800 bg-transparent">
        <CardHeader>
          <CardTitle className="text-base font-medium">Available Offers</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingOffers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No open offers at the moment</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-medium text-center">Type</TableHead>
                    <TableHead className="font-medium text-center">Debt Token</TableHead>
                    <TableHead className="font-medium text-center">Amount</TableHead>
                    <TableHead className="font-medium text-center">Collateral</TableHead>
                    <TableHead className="font-medium text-center">APY</TableHead>
                    <TableHead className="font-medium text-center">Duration</TableHead>
                    {(isMe || myWallet) && <TableHead className="font-medium text-center">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOffers.map((loan) => (
                    <TableRow key={loan.publicKey}>
                      <TableCell className="text-center">
                        <Badge variant={loan.offerType === "lend" ? "default" : "secondary"}>
                          {loan.offerType === "lend" ? "Lend Offer" : "Borrow Request"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{loan.debtTokenSymbol}</TableCell>
                      <TableCell className="text-center font-medium">{loan.debtAmountUi.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-medium">
                        {loan.collateralAmountUi.toFixed(2)} {loan.collateralTokenSymbol}
                      </TableCell>
                      <TableCell className="text-center font-medium text-green-600">{loan.apy}%</TableCell>
                      <TableCell className="text-center font-medium">{Math.round(loan.duration / 86400)} days</TableCell>
                      {isMe ? null : myWallet ? (
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            className={`${loan.offerType === "lend" ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"} text-white text-xs font-bold`}
                            onClick={() => handleAcceptOffer(loan)}
                            disabled={acceptingLoan === loan.publicKey}
                          >
                            {acceptingLoan === loan.publicKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : loan.offerType === "lend" ? (
                              "Borrow"
                            ) : (
                              "Lend"
                            )}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
