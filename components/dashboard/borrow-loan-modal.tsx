"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ReputationBadge } from "@/components/ui/badge-reputation"
import { toast } from "sonner"
import { FileText, Users, Calculator, Shield, AlertTriangle } from "lucide-react"

interface Opportunity {
  id: number
  lender: string
  asset: string
  available: number
  term: string
  apr: string
  interest: string
  collateral: string
  verified?: boolean
  trend?: {
    value: number
    direction: "up" | "down"
    change?: string
  }
  reputation?: number
}

interface BorrowLoanModalProps {
  opportunity: Opportunity | null
  isOpen: boolean
  onClose: () => void
}

export function BorrowLoanModal({ opportunity, isOpen, onClose }: BorrowLoanModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [borrowAmount, setBorrowAmount] = useState<number>(0)

  if (!opportunity) return null

  // Inicializar com o valor disponível
  if (borrowAmount === 0) {
    setBorrowAmount(opportunity.available)
  }

  const handleBorrow = async () => {
    setIsProcessing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success("Loan borrowed successfully!", {
        description: `You have borrowed ${borrowAmount.toLocaleString()} ${opportunity.asset} for ${opportunity.term}.`
      })
      onClose()
    } catch (error) {
      toast.error("Error borrowing loan", {
        description: "Please try again later."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async () => {
    setIsProcessing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success("Borrow request cancelled", {
        description: "No loan was borrowed."
      })
      onClose()
    } catch (error) {
      toast.error("Error cancelling request", {
        description: "Please try again later."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const calculateInterest = (amount: number) => {
    const apr = parseFloat(opportunity.apr.replace('%', ''))
    const termDays = parseInt(opportunity.term.split(' ')[0])
    return (amount * apr * termDays) / (365 * 100)
  }

  const calculatedInterest = calculateInterest(borrowAmount)
  const totalRepayment = borrowAmount + calculatedInterest

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-3">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <div className="flex items-center gap-2">
              <img 
                src={`/images/${opportunity.asset === "USDT" ? "tether-usdt-logo.png" : opportunity.asset === "bSOL" ? "bluebgagio.png" : opportunity.asset.toLowerCase()}-logo.png`} 
                alt={opportunity.asset} 
                className={`w-6 h-6 ${opportunity.asset === "bSOL" ? "rounded-full object-cover" : ""}`} 
              />
              Borrow {opportunity.asset}
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            Review loan offer details and confirm your borrowing request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loan Offer Details */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Loan Offer Details</span>
                </div>
                <Badge variant="default" className="bg-green-500">
                  Available
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Available Amount:</span>
                    <span className="font-bold text-lg">
                      {opportunity.available.toLocaleString()} {opportunity.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Interest Rate:</span>
                    <span className="font-semibold text-red-500">
                      {opportunity.apr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Term:</span>
                    <span className="font-semibold">{opportunity.term}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Collateral Required:</span>
                    <span className="font-semibold">
                      {opportunity.collateral}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Collateral Value:</span>
                    <span className="font-semibold">
                      {Math.round(opportunity.available * parseFloat(opportunity.collateral) / 100).toLocaleString()} {opportunity.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Interest Amount:</span>
                    <span className="font-semibold text-red-500">
                      {opportunity.interest}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lender Information */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Lender Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-600">Lender:</span>
                    <span className="font-mono text-sm">
                      {opportunity.lender}
                    </span>
                  </div>
                  {opportunity.verified && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                      Verified
                    </Badge>
                  )}
                </div>
                <ReputationBadge score={opportunity.reputation || 0} />
              </div>
              {opportunity.trend && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Rate trend:</span>
                  <span className={`font-semibold ${opportunity.trend.direction === "up" ? "text-green-500" : "text-red-500"}`}>
                    {opportunity.trend.direction === "up" ? "↗" : "↘"} {opportunity.trend.value}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Borrowing Calculator */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                Borrowing Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Borrow Amount:</span>
                    <span className="font-bold text-lg">
                      {borrowAmount.toLocaleString()} {opportunity.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Interest:</span>
                    <span className="font-semibold text-red-500">
                      {calculatedInterest.toFixed(4)} {opportunity.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Total Repayment:</span>
                    <span className="font-bold text-lg text-red-600">
                      {totalRepayment.toFixed(4)} {opportunity.asset}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Required Collateral:</span>
                    <span className="font-semibold">
                      {Math.round(borrowAmount * parseFloat(opportunity.collateral) / 100).toLocaleString()} {opportunity.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">APR:</span>
                    <span className="font-semibold text-red-500">
                      {opportunity.apr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Term:</span>
                    <span className="font-semibold">{opportunity.term}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          
        </div>

        <DialogFooter className="flex justify-center pt-6">
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={handleDecline}
              disabled={isProcessing}
              className="px-8"
            >
              {isProcessing ? "Processing..." : "Decline"}
            </Button>
            <Button 
              onClick={handleBorrow}
              disabled={isProcessing}
              className="bg-red-500 hover:bg-red-600 text-white px-8"
            >
              {isProcessing ? "Processing..." : "Borrow Now"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 