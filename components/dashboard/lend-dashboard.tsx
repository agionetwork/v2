"use client"

import { useMemo, useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useLoans, LoanStatus, formatDuration, type ParsedLoan } from "@/hooks/useLoans"
import { useWallet } from "@solana/wallet-adapter-react"
import { useTokenPrices } from "@/hooks/useTokenPrices"
import { useLoanContract } from "@/hooks/useLoanContract"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import LoanViewModal from "./loan-view-modal"
import { WalletNameCell } from "./wallet-name-cell"

export default function LendDashboard() {
  const { publicKey } = useWallet()
  const { myLentLoans, loading, refetch } = useLoans()
  const { prices } = useTokenPrices()
  const { acceptLendOffer } = useLoanContract()
  const { postActivity } = useTapestryProfile()
  const [selectedLoan, setSelectedLoan] = useState<ParsedLoan | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [acceptingLoanKey, setAcceptingLoanKey] = useState<string | null>(null)
  const busyRef = useRef(false)

  const handleAcceptOffer = useCallback(async (loan: ParsedLoan) => {
    if (busyRef.current || !publicKey) return
    busyRef.current = true
    setAcceptingLoanKey(loan.publicKey)
    try {
      await acceptLendOffer({
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
      })
      toast.success("Offer accepted!", {
        description: `Lent ${loan.debtAmountUi.toFixed(2)} ${loan.debtTokenSymbol} at ${loan.apy}% APY`,
      })
      postActivity("accepted", {
        debtToken: loan.debtTokenSymbol,
        collateralToken: loan.collateralTokenSymbol,
        amount: loan.debtAmountUi,
        apy: loan.apy,
      })
      refetch()
    } catch (error: any) {
      console.error("Accept offer failed:", error)
      toast.error("Failed to accept offer", {
        description: error.message || "Please try again.",
      })
    } finally {
      setAcceptingLoanKey(null)
      busyRef.current = false
    }
  }, [publicKey, acceptLendOffer, postActivity, refetch])

  const activeLoans = useMemo(() =>
    myLentLoans.filter(l => l.status === LoanStatus.Accepted),
  [myLentLoans])

  const expiredLoans = useMemo(() =>
    activeLoans.filter(l =>
      l.start != null && (Date.now() / 1000) > (l.start + l.duration)
    ),
  [activeLoans])

  // Private pending offers sent TO this wallet by borrowers
  // (borrower used create_lend_offer with is_private=true, targeting this wallet as lender)
  const offersForMe = useMemo(() =>
    myLentLoans.filter(l =>
      l.status === LoanStatus.Pending &&
      l.borrower !== null &&
      l.privateStatus > 0
    ),
  [myLentLoans])

  // User's own pending offers (created by this wallet via create_borrow_offer)
  const myOwnPending = useMemo(() => {
    const offerKeys = new Set(offersForMe.map(l => l.publicKey))
    return myLentLoans.filter(l =>
      l.status === LoanStatus.Pending && !offerKeys.has(l.publicKey)
    )
  }, [myLentLoans, offersForMe])

  const myLoans = useMemo(() =>
    [...activeLoans, ...myOwnPending],
  [activeLoans, myOwnPending])

  // Total receivable: principal + interest for each active loan (if repaid)
  const totalReceivable = activeLoans.reduce((sum, l) => {
    const interest = l.debtAmountUi * l.apy / 100 * l.duration / (365 * 86400)
    return sum + l.debtAmountUi + interest
  }, 0)
  const avgApy = activeLoans.length > 0
    ? activeLoans.reduce((sum, l) => sum + l.apy, 0) / activeLoans.length
    : 0

  // Interest Earned: interest received on repaid loans + collateral gained on foreclosed loans (in USD)
  const interestEarnedUsd = useMemo(() => {
    const historicalLoans = myLentLoans.filter(l =>
      l.status === LoanStatus.Repaid || l.status === LoanStatus.Foreclosed
    )
    let total = 0
    for (const loan of historicalLoans) {
      if (loan.status === LoanStatus.Repaid) {
        const interest = loan.debtAmountUi * loan.apy / 100 * loan.duration / (365 * 86400)
        total += interest * (prices[loan.debtTokenSymbol]?.price || 0)
      } else if (loan.status === LoanStatus.Foreclosed) {
        total += loan.collateralAmountUi * (prices[loan.collateralTokenSymbol]?.price || 0)
      }
    }
    return total
  }, [myLentLoans, prices])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {expiredLoans.length > 0 && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-4 flex items-center gap-3">
          <span className="text-red-500 text-xl">&#9888;</span>
          <div>
            <p className="font-semibold text-red-600 dark:text-red-400">
              {expiredLoans.length} expired loan{expiredLoans.length > 1 ? 's' : ''} require attention
            </p>
            <p className="text-sm text-red-500/80">
              Click &quot;Foreclose&quot; on expired loans to claim the collateral.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Total Lent</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{totalReceivable.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total receivable if repaid</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Active Loans</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{activeLoans.length}</div>
            <p className="text-xs text-muted-foreground">Currently earning interest</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Interest Earned</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-green-600">${interestEarnedUsd.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total interest received</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Average APY</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-green-600">{avgApy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Average lending rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="myloans" className="space-y-6">
        <TabsList className="inline-flex h-10 w-full max-w-md mx-auto mb-4 bg-muted/50 border dark:border-white/10">
          <TabsTrigger value="myloans" className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">My Loans</TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">Available Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="myloans">
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
            <CardHeader>
              <CardTitle className="text-base font-medium">My Loans</CardTitle>
              <CardDescription>Your lend offers and active loans</CardDescription>
            </CardHeader>
            <CardContent>
              {myLoans.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-lg font-medium">No loans</p>
                  <p className="text-sm mt-1">Your lend offers and loans will appear here</p>
                  <Link href="/borrow-lend"><Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">Create a Lend Offer</Button></Link>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-medium text-center">Borrower</TableHead>
                        <TableHead className="font-medium text-center">Amount</TableHead>
                        <TableHead className="font-medium text-center">Collateral</TableHead>
                        <TableHead className="font-medium text-center">APY</TableHead>
                        <TableHead className="font-medium text-center">Duration</TableHead>
                        <TableHead className="font-medium text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myLoans.map((loan) => {
                        const isLoanExpired = loan.status === LoanStatus.Accepted &&
                          loan.start != null && (Date.now() / 1000) > (loan.start + loan.duration)
                        return (
                          <TableRow key={loan.publicKey} className={isLoanExpired ? "bg-red-500/5" : ""}>
                            <WalletNameCell address={loan.borrower} fallback="Pending" />
                            <TableCell className="text-center font-medium">{loan.debtAmountUi.toFixed(2)} ${loan.debtTokenSymbol}</TableCell>
                            <TableCell className="text-center font-medium">{loan.collateralAmountUi.toFixed(2)} ${loan.collateralTokenSymbol}</TableCell>
                            <TableCell className="text-center font-medium text-green-600">{loan.apy}%</TableCell>
                            <TableCell className="text-center font-medium">{formatDuration(loan.duration)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  className={isLoanExpired ? "text-xs bg-red-500 hover:bg-red-600 text-white" : "text-xs bg-blue-600 hover:bg-blue-700 text-white"}
                                  onClick={() => { setSelectedLoan(loan); setIsModalOpen(true) }}
                                >
                                  {isLoanExpired ? "Foreclose" : "View"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
            <CardHeader>
              <CardTitle className="text-base font-medium">Available Offers</CardTitle>
              <CardDescription>Private offers sent to your wallet</CardDescription>
            </CardHeader>
            <CardContent>
              {offersForMe.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-lg font-medium">No offers available</p>
                  <p className="text-sm mt-1">Private offers sent to your wallet will appear here</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-medium text-center">Borrower</TableHead>
                        <TableHead className="font-medium text-center">Amount</TableHead>
                        <TableHead className="font-medium text-center">Collateral Offered</TableHead>
                        <TableHead className="font-medium text-center">APY</TableHead>
                        <TableHead className="font-medium text-center">Duration</TableHead>
                        <TableHead className="font-medium text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offersForMe.map((loan) => (
                        <TableRow key={loan.publicKey}>
                          <WalletNameCell address={loan.borrower} fallback="Open" />
                          <TableCell className="text-center font-medium">{loan.debtAmountUi.toFixed(2)} ${loan.debtTokenSymbol}</TableCell>
                          <TableCell className="text-center font-medium">{loan.collateralAmountUi.toFixed(2)} ${loan.collateralTokenSymbol}</TableCell>
                          <TableCell className="text-center font-medium text-green-600">{loan.apy}%</TableCell>
                          <TableCell className="text-center font-medium">{formatDuration(loan.duration)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              className="text-xs bg-green-600 hover:bg-green-700 text-white"
                              disabled={acceptingLoanKey === loan.publicKey}
                              onClick={() => handleAcceptOffer(loan)}
                            >
                              {acceptingLoanKey === loan.publicKey ? "Confirming..." : "Lend"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedLoan && (
        <LoanViewModal
          loan={selectedLoan}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRepaySuccess={() => {
            setIsModalOpen(false)
            refetch()
          }}
          onCancelSuccess={() => {
            setIsModalOpen(false)
            refetch()
          }}
          onAcceptSuccess={() => {
            setIsModalOpen(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}
