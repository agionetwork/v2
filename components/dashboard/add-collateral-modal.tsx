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

interface AddCollateralModalProps {
  loan: Loan | null
  isOpen: boolean
  onClose: () => void
  onReturn: () => void
}

export function AddCollateralModal({ loan, isOpen, onClose, onReturn }: AddCollateralModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [collateralAmount, setCollateralAmount] = useState<number>(0)

  if (!loan) return null

  // Calculate current collateral value (assuming it's a percentage of loan amount)
  const currentCollateralValue = (loan.amount * parseFloat(loan.collateral.replace('%', ''))) / 100
  const maxCollateralAmount = loan.amount * 2 // Maximum 200% of loan amount

  // Handle amount change
  const handleAmountChange = (amount: number) => {
    const newAmount = Math.max(0, Math.min(amount, maxCollateralAmount))
    setCollateralAmount(newAmount)
  }

  // Handle increment buttons
  const handleIncrement = (increment: number) => {
    const newAmount = Math.min(collateralAmount + increment, maxCollateralAmount)
    setCollateralAmount(newAmount)
  }


  const handleAddCollateral = async () => {
    setIsProcessing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success("Collateral added successfully!", {
        description: `You have added ${collateralAmount.toFixed(2)} ${loan.asset} as collateral.`
      })
      onClose()
    } catch (error) {
      toast.error("Error adding collateral", {
        description: "Please try again later."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturn = () => {
    onReturn()
  }

  const newLTVRatio = ((currentCollateralValue + collateralAmount) / loan.amount) * 100

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
              Increase Collateral - Loan #{loan.id}
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            Increase your collateral to improve your loan-to-value ratio
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
                    <span className="text-sm font-medium text-gray-600">Principal:</span>
                    <span className="font-bold text-lg">
                      {loan.amount.toLocaleString()} {loan.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Current LTV:</span>
                    <span className="font-semibold text-blue-600">
                      {loan.collateral}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Current Collateral:</span>
                    <span className="font-semibold text-blue-600">
                      {currentCollateralValue.toFixed(2)} {loan.asset}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <Badge 
                      variant={loan.status === "Active" ? "default" : "secondary"}
                      className={loan.status === "Active" ? "bg-green-500" : "bg-yellow-500"}
                    >
                      {loan.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Due Date:</span>
                    <span className="font-semibold text-red-500">{loan.dueDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Rate:</span>
                    <span className="font-semibold text-red-500">
                      {loan.apr || loan.apy || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Collateral Configuration */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-1 relative z-10">
              <CardTitle className="text-base">Collateral Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 relative z-10">
              <div className="space-y-1">
                {/* Amount Input */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Collateral Amount ({loan.asset})
                  </label>
                  <input
                    type="number"
                    value={collateralAmount.toFixed(2)}
                    onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Enter collateral amount"
                    min="0"
                    max={maxCollateralAmount}
                    step="0.01"
                  />
                </div>

                {/* Increment Buttons */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Quick Add
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIncrement(1)}
                      className="text-xs"
                    >
                      +1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIncrement(10)}
                      className="text-xs"
                    >
                      +10
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIncrement(100)}
                      className="text-xs"
                    >
                      +100
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIncrement(1000)}
                      className="text-xs"
                    >
                      +1000
                    </Button>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1 text-sm">New Collateral</h4>
                    <p className="text-base font-bold text-blue-600 dark:text-blue-300">
                      {(currentCollateralValue + collateralAmount).toFixed(2)} {loan.asset}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      +{collateralAmount.toFixed(2)} {loan.asset}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1 text-sm">New LTV Ratio</h4>
                    <p className="text-base font-bold text-blue-600 dark:text-blue-300">
                      {newLTVRatio.toFixed(1)}%
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      {newLTVRatio > parseFloat(loan.collateral.replace('%', '')) ? 'Improved' : 'Same'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benefits removed as requested */}
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
            onClick={handleAddCollateral}
            disabled={isProcessing || collateralAmount <= 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            {isProcessing ? "Processing..." : "Add Collateral"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 