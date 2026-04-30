"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useLoans, getStatusLabel, LoanStatus, formatDuration } from "@/hooks/useLoans"
import { useWallet } from "@solana/wallet-adapter-react"

export default function LoansDashboard() {
  const { publicKey } = useWallet()
  const { myLoans, myBorrowedLoans, myLentLoans, loading, isMyWallet } = useLoans()

  const activeLoans = useMemo(() =>
    myLoans.filter(l => l.status === LoanStatus.Accepted),
  [myLoans])

  const totalBorrowed = useMemo(() =>
    myBorrowedLoans
      .filter(l => l.status === LoanStatus.Accepted)
      .reduce((sum, l) => sum + l.debtAmountUi, 0),
  [myBorrowedLoans])

  const totalLent = useMemo(() =>
    myLentLoans
      .filter(l => l.status === LoanStatus.Accepted)
      .reduce((sum, l) => sum + l.debtAmountUi, 0),
  [myLentLoans])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Total Borrowed</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{totalBorrowed.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Active debt</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Total Lent</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{totalLent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Active lending</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Active Loans</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{activeLoans.length}</div>
            <p className="text-xs text-muted-foreground">Current positions</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium text-center">Total Loans</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold">{myLoans.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>
      <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent">
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Transactions</CardTitle>
          <CardDescription>Your recent lending and borrowing activity</CardDescription>
        </CardHeader>
        <CardContent>
          {myLoans.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium">No transactions yet</p>
              <p className="text-sm mt-1">Your loan activity will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-medium text-center">Type</TableHead>
                  <TableHead className="font-medium text-center">Amount</TableHead>
                  <TableHead className="font-medium text-center">Collateral</TableHead>
                  <TableHead className="font-medium text-center">APY</TableHead>
                  <TableHead className="font-medium text-center">Duration</TableHead>
                  <TableHead className="font-medium text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myLoans.slice(0, 10).map((loan) => {
                  const isBorrower = isMyWallet(loan.borrower)
                  return (
                    <TableRow key={loan.publicKey}>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={isBorrower ? "bg-orange-500/10 text-orange-600" : "bg-green-500/10 text-green-600"}>
                          {isBorrower ? "Borrowed" : "Lent"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{loan.debtAmountUi.toFixed(2)} {loan.debtTokenSymbol}</TableCell>
                      <TableCell className="text-center font-medium">{loan.collateralAmountUi.toFixed(2)} {loan.collateralTokenSymbol}</TableCell>
                      <TableCell className="text-center font-medium">{loan.apy}%</TableCell>
                      <TableCell className="text-center font-medium">{formatDuration(loan.duration)}</TableCell>
                      <TableCell className="text-center"><Badge variant="default">{getStatusLabel(loan.status)}</Badge></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
