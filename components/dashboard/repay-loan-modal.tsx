"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"

interface Loan {
  id: number
  lender?: string
  borrower?: string
  asset: string
  amount: number
  interest: string
  dueDate?: string
  status: string
  collateral: string
  term?: string
  verified?: boolean
  reputation?: number
  apr?: string
  apy?: string
}

interface RepayLoanModalProps {
  loan: Loan | null
  isOpen: boolean
  onClose: () => void
  onReturn: () => void
}

export function RepayLoanModal({ loan, isOpen, onClose, onReturn }: RepayLoanModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [repayAmount, setRepayAmount] = useState<number>(0)
  const [repayPercentage, setRepayPercentage] = useState<number>(0)
  const [fullRepayment, setFullRepayment] = useState<boolean>(false)

  if (!loan) return null

  // Calculate total amount to repay (principal + interest)
  const totalToRepay = loan.amount + parseFloat(loan.interest.split(' ')[0])

  // Update repay amount when percentage changes
  const handlePercentageChange = (value: number[]) => {
    const percentage = value[0]
    setRepayPercentage(percentage)
    setRepayAmount((totalToRepay * percentage) / 100)
  }

  // Update percentage when amount changes
  const handleAmountChange = (amount: number) => {
    setRepayAmount(amount)
    const percentage = (amount / totalToRepay) * 100
    setRepayPercentage(Math.round(percentage))
  }

  // Handle full repayment checkbox
  const handleFullRepaymentChange = (checked: boolean) => {
    setFullRepayment(checked)
    if (checked) {
      setRepayAmount(totalToRepay)
      setRepayPercentage(100)
    } else {
      setRepayAmount(0)
      setRepayPercentage(0)
    }
  }

  const handleRepay = async () => {
    setIsProcessing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success("Loan repayment successful!", {
        description: `You have repaid ${repayAmount.toFixed(2)} ${loan.asset} (${repayPercentage}% of total).`
      })
      // Notify lender via Dialect (fire-and-forget)
      if (loan.lender) {
        fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "loan_repaid",
            recipientWallet: loan.lender,
            details: { debtToken: loan.asset, amount: repayAmount },
          }),
        }).catch(() => {})
      }
      onClose()
    } catch (error) {
      toast.error("Error repaying loan", {
        description: "Please try again later."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturn = () => {
    onReturn()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-3 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <div className="flex items-center gap-2">
              <img 
                src={`/images/${loan.asset === "USDT" ? "tether-usdt-logo.png" : loan.asset === "bSOL" ? "bluebgagio.png" : loan.asset.toLowerCase()}-logo.png`} 
                alt={loan.asset} 
                className={`w-6 h-6 ${loan.asset === "bSOL" ? "rounded-full object-cover" : ""}`} 
              />
              Repay Loan #{loan.id}
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            Select the amount you want to repay
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1">
          {/* Current Loan Details */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-1 relative z-10">
              <CardTitle className="text-base">Current Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 relative z-10">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Principal:</span>
                    <span className="font-bold text-base">
                      {loan.amount.toLocaleString()} {loan.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Interest Due:</span>
                    <span className="font-semibold text-red-600">
                      {loan.interest}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Total to Repay:</span>
                    <span className="font-bold text-base text-red-600">
                      {totalToRepay.toFixed(2)} {loan.asset}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Status:</span>
                    <Badge 
                      variant={loan.status === "Active" ? "default" : "secondary"}
                      className={loan.status === "Active" ? "bg-green-500" : "bg-yellow-500"}
                    >
                      {loan.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Due Date:</span>
                    <span className="font-semibold text-red-500">{loan.dueDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Rate:</span>
                    <span className="font-semibold text-red-500">
                      {loan.apr || loan.apy || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repayment Configuration */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-1 relative z-10">
              <CardTitle className="text-base">Repayment Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 relative z-10">
              <div className="space-y-2">
                {/* Amount Input */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Repay Amount ({loan.asset})
                  </label>
                  <input
                    type="number"
                    value={repayAmount.toFixed(2)}
                    onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Enter amount to repay"
                    min="0"
                    max={totalToRepay}
                    step="0.01"
                  />
                </div>

                {/* Percentage Slider */}
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Repayment Percentage: {repayPercentage}%
                  </label>
                  <Slider
                    value={[repayPercentage]}
                    onValueChange={handlePercentageChange}
                    max={100}
                    min={0}
                    step={25}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Full Repayment Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fullRepayment"
                    checked={fullRepayment}
                    onCheckedChange={handleFullRepaymentChange}
                  />
                  <label
                    htmlFor="fullRepayment"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Full Repayment
                  </label>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Amount to Repay</h4>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-300">
                      {repayAmount.toFixed(2)} {loan.asset}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      {repayPercentage}% of total
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Remaining Balance</h4>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-300">
                      {(totalToRepay - repayAmount).toFixed(2)} {loan.asset}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      {(100 - repayPercentage).toFixed(0)}% remaining
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Notes removed as requested */}
        </div>

        <DialogFooter className="w-full flex flex-row justify-center items-center space-x-3 py-3 relative z-10">
          <Button 
            variant="outline" 
            onClick={handleReturn}
            disabled={isProcessing}
            className="px-6"
          >
            Return
          </Button>
          <Button 
            onClick={handleRepay}
            disabled={isProcessing || repayAmount <= 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            {isProcessing ? "Processing..." : "Repay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 