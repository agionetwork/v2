import { useMemo } from "react"
import { LoanFormData, LoanSummary, TokenInfo } from "@/types/loan"

export function useCalculations(formData: LoanFormData, tokenInfo: TokenInfo) {
  const summary = useMemo<LoanSummary>(() => {
    const totalRepayment = formData.loanAmount * (1 + (formData.apy / 100) * (formData.loanTerm / 365))
    const interest = totalRepayment - formData.loanAmount
    const dailyInterest = (formData.apy / 100) * formData.loanAmount / 365

    return {
      totalRepayment,
      interest,
      dailyInterest
    }
  }, [formData.loanAmount, formData.apy, formData.loanTerm])

  const formattedValues = useMemo(() => {
    const adjustedLoanAmount = formData.loanAmount / Math.pow(10, tokenInfo.decimals)
    const adjustedCollateralAmount = formData.collateralAmount / Math.pow(10, tokenInfo.decimals)

    return {
      adjustedLoanAmount,
      adjustedCollateralAmount,
      collateralRatio: (adjustedCollateralAmount / adjustedLoanAmount) * 100
    }
  }, [formData.loanAmount, formData.collateralAmount, tokenInfo.decimals])

  return {
    summary,
    formattedValues
  }
} 