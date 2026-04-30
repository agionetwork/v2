"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ReputationBadge } from "@/components/ui/badge-reputation"
import { RepayLoanModal } from "./repay-loan-modal"
import { AddCollateralModal } from "./add-collateral-modal"
import { toast } from "sonner"
import { Activity, Users, Settings, Shield, DollarSign, Plus } from "lucide-react"

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

interface ManageLoanModalProps {
  loan: Loan | null
  isOpen: boolean
  onClose: () => void
  userType?: "lender" | "borrower" // Novo prop para identificar o tipo de usuário
}

export function ManageLoanModal({ loan, isOpen, onClose, userType }: ManageLoanModalProps) {
  const [showRepayModal, setShowRepayModal] = useState(false)
  const [showAddCollateralModal, setShowAddCollateralModal] = useState(false)

  if (!loan) return null

  // Detectar automaticamente se é lender ou borrower baseado nos dados do loan
  const isLender = userType === "lender" || (loan.lender && !loan.borrower)
  const isBorrower = userType === "borrower" || (loan.borrower && !loan.lender)

  // Forçar a detecção baseada no userType se fornecido
  const finalIsLender = userType === "lender" ? true : userType === "borrower" ? false : isLender
  const finalIsBorrower = userType === "borrower" ? true : userType === "lender" ? false : isBorrower

  // Função para determinar cor da reputação
  const getReputationColor = (score: number) => {
    if (score >= 0 && score <= 25) return "text-red-500"
    if (score >= 26 && score <= 50) return "text-orange-500"
    if (score >= 51 && score <= 75) return "text-yellow-500"
    if (score >= 76 && score <= 100) return "text-green-500"
    return "text-blue-600"
  }

  // Função para determinar cor do risk level
  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "low":
        return "text-green-500"
      case "medium":
        return "text-yellow-500"
      case "high":
        return "text-red-500"
      default:
        return "text-blue-600"
    }
  }

  // Função para determinar o risk level baseado na reputação
  const getRiskLevel = (reputation: number) => {
    if (reputation >= 76) return "Low"
    if (reputation >= 51) return "Medium"
    return "High"
  }

  const handleRepayLoan = () => {
    setShowRepayModal(true)
  }

  const handleAddCollateral = () => {
    setShowAddCollateralModal(true)
  }



  const handleRepayModalClose = () => {
    setShowRepayModal(false)
  }

  const handleAddCollateralModalClose = () => {
    setShowAddCollateralModal(false)
  }

  const handleRepayModalReturn = () => {
    setShowRepayModal(false)
  }

  const handleAddCollateralModalReturn = () => {
    setShowAddCollateralModal(false)
  }


  return (
    <>
      <Dialog open={isOpen && !showRepayModal && !showAddCollateralModal} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-3">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="flex items-center gap-2">
                <img 
                  src={`/images/${loan.asset === "USDT" ? "tether-usdt-logo.png" : loan.asset === "bSOL" ? "bluebgagio.png" : loan.asset.toLowerCase()}-logo.png`} 
                  alt={loan.asset} 
                  className={`w-6 h-6 ${loan.asset === "bSOL" ? "rounded-full object-cover" : ""}`} 
                />
                Manage Loan #{loan.id}
                <Badge variant="outline" className="ml-2">
                  {finalIsLender ? "Lender View" : "Borrower View"}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription className="text-sm">
              Manage your active loan details and perform actions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {/* Loan Status Overview */}
            <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
              <CardHeader className="pb-1 relative z-10">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <span>Loan Status</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] cursor-help">?</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Current loan state and key metrics such as principal, collateral, rate and due date.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Badge 
                    variant="default"
                    className="bg-green-500"
                  >
                    Active
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 relative z-10">
                <div className="grid grid-cols-4 gap-x-4 gap-y-2 items-center">
                  <span className="text-sm font-medium text-gray-600">Principal:</span>
                  <span className="font-bold text-lg">{loan.amount.toLocaleString()} {loan.asset}</span>
                  <span className="text-sm font-medium text-gray-600">Collateral:</span>
                  <span className="font-semibold">{loan.collateral} (875,000 SOL)</span>

                  <span className="text-sm font-medium text-gray-600">Interest Due:</span>
                  <span className="font-semibold text-green-600">{loan.interest}</span>
                  <span className="text-sm font-medium text-gray-600">Due Date:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{loan.dueDate || "N/A"}</span>

                  <span className="text-sm font-medium text-gray-600">Rate:</span>
                  <span className="font-semibold text-green-500">{loan.apr || loan.apy || "N/A"}</span>
                  <span className="hidden md:block"></span>
                  <span className="hidden md:block"></span>
                </div>
              </CardContent>
            </Card>

            {/* Counterparty Information */}
            <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
              <CardHeader className="pb-1 relative z-10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Counterparty Information
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] cursor-help">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Details about the other party in this loan, including identity snippet and reputation.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-600">
                        {loan.lender ? "Lender" : "Borrower"}:
                      </span>
                      <span className="font-mono text-sm">
                        {loan.lender || loan.borrower}
                      </span>
                    </div>
                    {loan.verified && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <ReputationBadge score={loan.reputation || 0} />
                </div>
              </CardContent>
            </Card>

            {/* Management Actions */}
            <Card className="border-2 border-gray-200 dark:border-gray-800 shadow-lg bg-transparent hover:shadow-xl transition-all duration-300 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-blue-100/20 to-blue-200/30 dark:from-blue-900/20 dark:via-blue-800/20 dark:to-blue-700/20 pointer-events-none"></div>
              <CardHeader className="pb-1 relative z-10">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-blue-600" />
                  Available Actions
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] cursor-help">?</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Contextual actions you can take on this loan, such as repay, extend, or add collateral.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {finalIsBorrower ? (
                    // Ações para Borrower
                    <>
                      <div className="bg-blue-50 dark:bg-blue-950 p-1 rounded-lg h-full flex flex-col">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5" />
                          Repay Loan
                        </h4>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          Pay back the principal amount plus accrued interest to close the loan.
                        </p>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          <div>Total to repay: <span className="font-bold">{loan.amount.toLocaleString()} {loan.asset} + {loan.interest}</span></div>
                        </div>
                        <Button 
                          onClick={handleRepayLoan}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white mt-auto"
                        >
                          Repay
                        </Button>
                      </div>
                      
                      <div className="bg-blue-50 dark:bg-blue-950 p-1 rounded-lg h-full flex flex-col">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5" />
                          Add Collateral
                        </h4>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          Increase your collateral to improve your loan-to-value ratio.
                        </p>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          <div>Current LTV: <span className="font-bold">{loan.collateral}</span></div>
                        </div>
                        <Button 
                          onClick={handleAddCollateral}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white mt-auto"
                        >
                          Add Collateral
                        </Button>
                      </div>
                    </>
                  ) : (
                    // Ações para Lender
                    <>
                      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
                        <h4 className="font-semibold text-gray-600 dark:text-gray-400 mb-2">
                          Lender Dashboard
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          No actions available at this time.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

        </DialogContent>
      </Dialog>

      {/* Repay Loan Modal */}
      <RepayLoanModal
        loan={loan}
        isOpen={showRepayModal}
        onClose={handleRepayModalClose}
        onReturn={handleRepayModalReturn}
      />

      {/* Add Collateral Modal */}
      <AddCollateralModal
        loan={loan}
        isOpen={showAddCollateralModal}
        onClose={handleAddCollateralModalClose}
        onReturn={handleAddCollateralModalReturn}
      />
    </>
  )
} 