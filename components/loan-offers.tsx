"use client"

import { useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BiTime } from "react-icons/bi"
import Link from "next/link"
import { useLoans, LoanStatus, formatDuration, type ParsedLoan } from "@/hooks/useLoans"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletProfile } from "@/hooks/useWalletProfile"

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}

export function LoanOffers() {
  const { publicKey } = useWallet()
  const { availableBorrowOffers, availableLendOffers, loading, isMyWallet } = useLoans()

  // Lend offers: created by lenders, waiting for a borrower (exclude own + agent)
  const lendingOffers = useMemo(() => {
    if (!publicKey) return availableBorrowOffers
    return availableBorrowOffers.filter(l => !isMyWallet(l.lender))
  }, [availableBorrowOffers, publicKey, isMyWallet])

  // Borrow requests: created by borrowers, waiting for a lender (exclude own + agent)
  const borrowRequests = useMemo(() => {
    if (!publicKey) return availableLendOffers
    return availableLendOffers.filter(l => !isMyWallet(l.borrower))
  }, [availableLendOffers, publicKey, isMyWallet])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Loan Offers</h2>
      </div>
      <Tabs defaultValue="lend" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lend">Lending Offers</TabsTrigger>
          <TabsTrigger value="borrow">Borrow Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="lend" className="space-y-4">
          {lendingOffers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium">No lending offers available</p>
              <p className="text-sm mt-1">Check back later for new offers</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {lendingOffers.map(offer => (
                <OfferCard key={offer.publicKey} offer={offer} type="lend" />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="borrow" className="space-y-4">
          {borrowRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium">No borrow requests available</p>
              <p className="text-sm mt-1">Check back later for new requests</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {borrowRequests.map(request => (
                <OfferCard key={request.publicKey} offer={request} type="borrow" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OfferCard({ offer, type }: { offer: ParsedLoan; type: "lend" | "borrow" }) {
  const durationLabel = formatDuration(offer.duration)
  const expectedInterest = offer.debtAmountUi * offer.apy / 100 * offer.duration / (365 * 86400)
  const counterpartyAddress = type === "lend" ? offer.lender : offer.borrower
  const { displayName: counterpartyName, profileWallet } = useWalletProfile(counterpartyAddress)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            {offer.debtTokenSymbol} Loan
          </CardTitle>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            {offer.apy}% APY
          </Badge>
        </div>
        <CardDescription>
          {type === "lend" ? "Lender" : "Borrower"}:{" "}
          {profileWallet ? (
            <Link href={`/socialfi/profile/${profileWallet}`} className="text-blue-600 dark:text-blue-400 hover:underline">
              {counterpartyName || 'Open'}
            </Link>
          ) : (
            'Open'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{offer.debtAmountUi.toFixed(2)} {offer.debtTokenSymbol}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Interest</span>
            <span className={`font-medium ${type === "lend" ? "text-green-500" : "text-red-500"}`}>
              {type === "lend" ? "+" : "-"}{expectedInterest.toFixed(4)} {offer.debtTokenSymbol}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Term</span>
            <span className="font-medium flex items-center gap-1">
              <BiTime className="h-4 w-4 text-blue-500" />
              {durationLabel}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Collateral</span>
            <span className="font-medium">{offer.collateralAmountUi.toFixed(4)} {offer.collateralTokenSymbol}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Link href="/borrow-lend" className="w-full">
          <Button className={`w-full ${type === "lend" ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"} text-white`}>
            {type === "lend" ? "Borrow Now" : "Lend Now"}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
