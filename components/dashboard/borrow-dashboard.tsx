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
import { PrivateAcceptButton } from "./private-accept-button"
import { useIsStealth } from "@/hooks/useIsStealth"

export default function BorrowDashboard() {
  const { publicKey } = useWallet()
  const { myBorrowedLoans, availableLendOffers, loading, refetch, isMyWallet, isMyStealth } = useLoans()
  const { prices } = useTokenPrices()
  const { acceptBorrowOffer } = useLoanContract()
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
      await acceptBorrowOffer({
        loanPublicKey: loan.publicKey,
        createKey: loan.createKey,
        debtMint: loan.debtMint,
        collateralMint: loan.collateralMint,
        debtTokenSymbol: loan.debtTokenSymbol,
        collateralTokenSymbol: loan.collateralTokenSymbol,
        debtAmountUi: loan.debtAmountUi,
        collateralAmountUi: loan.collateralAmountUi,
        lender: loan.lender || undefined,
      })
      toast.success("Loan accepted!", {
        description: `Borrowed ${loan.debtAmountUi.toFixed(2)} ${loan.debtTokenSymbol} at ${loan.apy}% APY`,
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
  }, [publicKey, acceptBorrowOffer, postActivity, refetch])

  const activeLoans = useMemo(() =>
    myBorrowedLoans.filter(l => l.status === LoanStatus.Accepted),
  [myBorrowedLoans])

  const expiredLoans = useMemo(() =>
    activeLoans.filter(l =>
      l.start != null && (Date.now() / 1000) > (l.start + l.duration)
    ),
  [activeLoans])

  const myPendingOffers = useMemo(() =>
    myBorrowedLoans.filter(l => l.status === LoanStatus.Pending),
  [myBorrowedLoans])

  const myLoans = useMemo(() =>
    [...activeLoans, ...myPendingOffers],
  [activeLoans, myPendingOffers])

  // Exclude own + agent wallet offers from opportunities
  const opportunities = useMemo(() => {
    if (!publicKey) return availableLendOffers
    return availableLendOffers.filter(l => !isMyWallet(l.lender))
  }, [availableLendOffers, publicKey, isMyWallet])

  const totalBorrowed = activeLoans.reduce((sum, l) => sum + l.debtAmountUi, 0)
  const avgApy = activeLoans.length > 0
    ? activeLoans.reduce((sum, l) => sum + l.apy, 0) / activeLoans.length
    : 0

  // Interest Expense: interest paid on repaid loans + collateral lost on foreclosed loans (in USD)
  const interestExpenseUsd = useMemo(() => {
    const historicalLoans = myBorrowedLoans.filter(l =>
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
  }, [myBorrowedLoans, prices])

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
              {expiredLoans.length} expired loan{expiredLoans.length > 1 ? 's' : ''}!
            </p>
            <p className="text-sm text-red-500/80">
              Repay immediately to avoid foreclosure and loss of your collateral.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Your Debts</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{totalBorrowed.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Across {activeLoans.length} active loans</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Active Loans</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{activeLoans.length}</div>
            <p className="text-xs text-muted-foreground">Current outstanding loans</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Interest Expense</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-red-500">${interestExpenseUsd.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total interest paid</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Average APY</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-red-500">{avgApy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Average interest rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="myloans" className="space-y-6">
        <TabsList className="inline-flex h-10 w-full max-w-md mx-auto mb-4 bg-muted/50 border dark:border-white/10">
          <TabsTrigger value="myloans" className="flex-1 data-[state=active]:!bg-red-600 data-[state=active]:!text-white">My Loans</TabsTrigger>
          <TabsTrigger value="opportunities" className="flex-1 data-[state=active]:!bg-red-600 data-[state=active]:!text-white">Available Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="myloans">
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
            <CardHeader>
              <CardTitle className="text-base font-medium">My Loans</CardTitle>
              <CardDescription>Your borrow requests and active loans</CardDescription>
            </CardHeader>
            <CardContent>
              {myLoans.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-lg font-medium">No loans</p>
                  <p className="text-sm mt-1">Your borrow requests and loans will appear here</p>
                  <Link href="/borrow-lend"><Button variant="destructive" className="mt-4">Create a Borrow Request</Button></Link>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-medium text-center">Lender</TableHead>
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
                        // I accepted privately on the borrower side → mask the
                        // counterparty (lender) in my own dashboard regardless
                        // of whether the lender themselves is also a stealth.
                        const myBorrowerSideIsPrivate = isMyStealth(loan.borrower)
                        return (
                          <TableRow key={loan.publicKey} className={isLoanExpired ? "bg-red-500/5" : ""}>
                            <WalletNameCell address={loan.lender} fallback="Pending" forceMask={myBorrowerSideIsPrivate} />
                            <TableCell className="text-center font-medium">{loan.debtAmountUi.toFixed(2)} ${loan.debtTokenSymbol}</TableCell>
                            <TableCell className="text-center font-medium">{loan.collateralAmountUi.toFixed(2)} ${loan.collateralTokenSymbol}</TableCell>
                            <TableCell className="text-center font-medium text-red-500">{loan.apy}%</TableCell>
                            <TableCell className="text-center font-medium">{formatDuration(loan.duration)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs"
                                  onClick={() => { setSelectedLoan(loan); setIsModalOpen(true) }}
                                >
                                  {isLoanExpired ? "Repay Now" : "View"}
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

        <TabsContent value="opportunities">
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
            <CardHeader>
              <CardTitle className="text-base font-medium">Available Loan Offers</CardTitle>
              <CardDescription>Loan offers from lenders available for borrowing</CardDescription>
            </CardHeader>
            <CardContent>
              {opportunities.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-lg font-medium">No offers available</p>
                  <p className="text-sm mt-1">Check back later for new lending offers</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-medium text-center">Lender</TableHead>
                        <TableHead className="font-medium text-center">Amount</TableHead>
                        <TableHead className="font-medium text-center">Collateral Required</TableHead>
                        <TableHead className="font-medium text-center">APY</TableHead>
                        <TableHead className="font-medium text-center">Duration</TableHead>
                        <TableHead className="font-medium text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opportunities.map((loan) => (
                        <OpportunityRow
                          key={loan.publicKey}
                          loan={loan}
                          accepting={acceptingLoanKey === loan.publicKey}
                          onAcceptPublic={() => handleAcceptOffer(loan)}
                          onPrivateSuccess={() => refetch()}
                        />
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

/**
 * Single opportunity row with the public + private accept buttons. We hide the
 * public "Borrow" button when the offer's lender is a stealth — accepting that
 * offer with a real wallet would defeat the lender's privacy by exposing the
 * borrower↔stealth pairing forever on chain. Private accept (fresh stealth)
 * stays available so the trade can still close.
 */
function OpportunityRow({
  loan,
  accepting,
  onAcceptPublic,
  onPrivateSuccess,
}: {
  loan: ParsedLoan
  accepting: boolean
  onAcceptPublic: () => void
  onPrivateSuccess: () => void
}) {
  const lenderIsStealth = useIsStealth(loan.lender)

  return (
    <TableRow>
      <WalletNameCell address={loan.lender} fallback="Open" />
      <TableCell className="text-center font-medium">{loan.debtAmountUi.toFixed(2)} ${loan.debtTokenSymbol}</TableCell>
      <TableCell className="text-center font-medium">{loan.collateralAmountUi.toFixed(2)} ${loan.collateralTokenSymbol}</TableCell>
      <TableCell className="text-center font-medium text-red-500">{loan.apy}%</TableCell>
      <TableCell className="text-center font-medium">{formatDuration(loan.duration)}</TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          {!lenderIsStealth && (
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              disabled={accepting}
              onClick={onAcceptPublic}
            >
              {accepting ? "Confirming..." : "Borrow"}
            </Button>
          )}
          <PrivateAcceptButton
            loan={loan}
            label="Borrow"
            size="sm"
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            disabled={accepting}
            onSuccess={onPrivateSuccess}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
