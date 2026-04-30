"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Settings, Loader2 } from "lucide-react"
import Link from "next/link"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { useWalletContext } from "@/components/wallet-provider"
import { useFriends } from "@/components/friends-provider"
import { useLoans, LoanStatus } from "@/hooks/useLoans"
import { getCustomProperty } from "@/lib/tapestry"
import { useSolDomain } from "@/hooks/useSNS"

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function ProfileCard() {
  const { profile: myProfile, isLoading: myLoading } = useTapestryProfile()
  const { isConnected, address } = useWalletContext()
  const { friends } = useFriends()
  const { loans, isMyWallet } = useLoans()

  const myStats = useMemo(() => {
    if (!address) return undefined
    let totalLent = 0
    let totalBorrowed = 0
    let loansCount = 0
    const relevantLoans = loans.filter(
      (l) =>
        l.status === LoanStatus.Accepted ||
        l.status === LoanStatus.Repaid ||
        l.status === LoanStatus.Foreclosed
    )
    for (const loan of relevantLoans) {
      if (isMyWallet(loan.lender)) {
        totalLent += loan.debtAmountUi
        loansCount += 1
      }
      if (isMyWallet(loan.borrower)) {
        totalBorrowed += loan.debtAmountUi
        loansCount += 1
      }
    }
    return { totalLent, totalBorrowed, loansCount }
  }, [loans, address, isMyWallet])

  const myProfileData = myProfile?.profile
  const myPfp = myProfileData ? getCustomProperty(myProfileData, "profileImage") : undefined
  const myDisplayName = myProfileData
    ? getCustomProperty(myProfileData, "displayName") || myProfileData.username
    : ""
  const myBio = myProfileData ? getCustomProperty(myProfileData, "bio") : ""
  const solDomain = useSolDomain(myProfileData?.walletAddress)
  const myTotalLoans = myStats?.loansCount || 0

  if (!isConnected) {
    return (
      <Card className="mb-6 border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-1">Connect your wallet</p>
          <p className="text-sm">Log in with your wallet to create your SocialFi profile and connect with other users.</p>
        </CardContent>
      </Card>
    )
  }

  if (myLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-muted-foreground">Loading your profile...</span>
        </CardContent>
      </Card>
    )
  }

  if (!myProfileData) return null

  return (
    <>
      <Card className="mb-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white border-0 relative">
        <Link
          href="/socialfi/edit-profile"
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <Settings className="h-5 w-5" />
        </Link>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-white/30">
              {myPfp ? <AvatarImage src={myPfp} alt={myDisplayName} /> : null}
              <AvatarFallback className="bg-white/20 text-white text-2xl">
                {myDisplayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-bold">{myDisplayName}</h3>
              {(myBio || solDomain) && (
                <p className="text-white/70 text-sm line-clamp-2">
                  {myBio || solDomain}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-white/60">Network: </span>
                  <span className="font-semibold">{friends.length}</span>
                </div>
                <div>
                  <span className="text-white/60">Loans: </span>
                  <span className="font-semibold">{myTotalLoans}</span>
                </div>
                <div>
                  <span className="text-white/60">Lent: </span>
                  <span className="font-semibold">{(myStats?.totalLent || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-white/60">Borrowed: </span>
                  <span className="font-semibold">{(myStats?.totalBorrowed || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA to complete profile */}
      {!getCustomProperty(myProfileData, "displayName") && (
        <Card className="mb-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Complete your profile</h3>
                <p className="text-white/70 text-sm">
                  Set up your display name, avatar and bio to be visible in the community.
                </p>
              </div>
              <Link
                href="/socialfi/edit-profile"
                className="bg-white text-blue-700 hover:bg-white/90 font-bold px-4 py-2 rounded-md text-sm"
              >
                Edit Profile
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
