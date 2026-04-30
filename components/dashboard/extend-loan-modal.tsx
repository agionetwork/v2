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

interface ExtendLoanModalProps {
  loan: Loan | null
  isOpen: boolean
  onClose: () => void
  onReturn: () => void
}

export function ExtendLoanModal({ loan, isOpen, onClose, onReturn }: ExtendLoanModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [extensionDays, setExtensionDays] = useState<number>(30)

  if (!loan) return null

  const handleSendProposal = async () => {
    setIsProcessing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success("Extension proposal sent successfully!", {
        description: `Your request to extend the loan by ${extensionDays} days has been sent to the counterparty.`
      })
      onClose()
    } catch (error) {
      toast.error("Error sending proposal", {
        description: "Please try again later."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturn = () => {
    onReturn()
  }

  const calculateExtensionFee = () => {
    const feeRate = 0.005 // 0.5% of principal
    return loan.amount * feeRate
  }

  const extensionFee = calculateExtensionFee()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-3 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <div className="flex items-center gap-2">
              <img 
                src={`/images/${loan.asset === "USDT" ? "tether-usdt-logo.png" : loan.asset === "bSOL" ? "bluebgagio.png" : loan.asset.toLowerCase()}-logo.png`} 
                alt={loan.asset} 
                className={`w-6 h-6 ${loan.asset === "bSOL" ? "rounded-full object-cover" : ""}`} 
              />
              Extend Loan #{loan.id}
            </div>
          </DialogTitle>
          <DialogDescription className="text-base">
            Request an extension for your loan term
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1">
          {/* Current Loan Details */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-lg">Current Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Principal:</span>
                    <span className="font-bold text-lg">
                      {loan.amount.toLocaleString()} {loan.asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Current Term:</span>
                    <span className="font-semibold">{loan.term}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Due Date:</span>
                    <span className="font-semibold text-red-500">{loan.dueDate}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Interest Rate:</span>
                    <span className="font-semibold text-red-500">
                      {loan.apr || loan.apy || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <Badge 
                      variant={loan.status === "Active" ? "default" : "secondary"}
                      className={loan.status === "Active" ? "bg-green-500" : "bg-yellow-500"}
                    >
                      {loan.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Extension Configuration */}
          <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-lg">Extension Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Extension Period: {extensionDays} days
                  </label>
                  <Slider
                    value={[extensionDays]}
                    onValueChange={(value) => setExtensionDays(value[0])}
                    max={365}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 day</span>
                    <span>365 days</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Extension Fee</h4>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      {extensionFee.toFixed(2)} {loan.asset}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      0.5% of principal
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">New Due Date</h4>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : "N/A"}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400">
                      +{extensionDays} days
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms & Conditions removed as requested */}
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
            onClick={handleSendProposal}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            {isProcessing ? "Processing..." : "Extend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 