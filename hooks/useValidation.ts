import { useState, useCallback } from "react"
import { LoanFormData } from "@/types/loan"
import { SECURITY_CONSTANTS, validateWalletAddress, validateCollateralRatio } from "@/constants/security"

interface ValidationState {
  errors: Record<string, string>
  touched: Record<string, boolean>
}

export function useValidation() {
  const [validationState, setValidationState] = useState<ValidationState>({
    errors: {},
    touched: {}
  })

  const validateField = useCallback((
    field: keyof LoanFormData,
    value: any,
    formData: LoanFormData,
    collateralPrice: number
  ): string => {
    switch (field) {
      case "loanAmount":
        if (value < SECURITY_CONSTANTS.MIN_LOAN_AMOUNT) {
          return `Loan amount must be at least ${SECURITY_CONSTANTS.MIN_LOAN_AMOUNT}`
        }
        if (value > SECURITY_CONSTANTS.MAX_LOAN_AMOUNT) {
          return `Loan amount cannot exceed ${SECURITY_CONSTANTS.MAX_LOAN_AMOUNT}`
        }
        break

      case "loanTerm":
        if (value < SECURITY_CONSTANTS.MIN_LOAN_TERM) {
          return `Loan term must be at least ${SECURITY_CONSTANTS.MIN_LOAN_TERM} days`
        }
        if (value > SECURITY_CONSTANTS.MAX_LOAN_TERM) {
          return `Loan term cannot exceed ${SECURITY_CONSTANTS.MAX_LOAN_TERM} days`
        }
        break

      case "apy":
        if (value < SECURITY_CONSTANTS.MIN_APY) {
          return `APY cannot be negative`
        }
        if (value > SECURITY_CONSTANTS.MAX_APY) {
          return `APY cannot exceed ${SECURITY_CONSTANTS.MAX_APY}%`
        }
        break

      case "receiverAddress":
        if (value && !validateWalletAddress(value)) {
          return "Invalid Solana wallet address"
        }
        break

      case "collateralAmount":
        if (!validateCollateralRatio(formData.loanAmount, value, collateralPrice)) {
          const ratio = (value * collateralPrice / formData.loanAmount) * 100
          if (ratio < SECURITY_CONSTANTS.MIN_COLLATERAL_RATIO) {
            return `Collateral ratio must be at least ${SECURITY_CONSTANTS.MIN_COLLATERAL_RATIO}%`
          }
          return `Collateral ratio cannot exceed ${SECURITY_CONSTANTS.MAX_COLLATERAL_RATIO}%`
        }
        break
    }
    return ""
  }, [])

  const handleFieldChange = useCallback((
    field: keyof LoanFormData,
    value: any,
    formData: LoanFormData,
    collateralPrice: number
  ) => {
    setValidationState(prev => {
      const error = validateField(field, value, formData, collateralPrice)
      return {
        errors: {
          ...prev.errors,
          [field]: error
        },
        touched: {
          ...prev.touched,
          [field]: true
        }
      }
    })
  }, [validateField])

  const handleFieldBlur = useCallback((field: keyof LoanFormData) => {
    setValidationState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [field]: true
      }
    }))
  }, [])

  const showFieldError = useCallback((field: keyof LoanFormData): boolean => {
    return validationState.touched[field] && !!validationState.errors[field]
  }, [validationState])

  const getFieldError = useCallback((field: keyof LoanFormData): string => {
    return validationState.errors[field] || ""
  }, [validationState])

  const resetValidation = useCallback(() => {
    setValidationState({
      errors: {},
      touched: {}
    })
  }, [])

  return {
    handleFieldChange,
    handleFieldBlur,
    showFieldError,
    getFieldError,
    resetValidation
  }
} 