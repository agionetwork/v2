import { useState, useCallback } from "react"
import { 
  SECURITY_CONSTANTS, 
  ERROR_MESSAGES, 
  validateWalletAddress, 
  validateCollateralRatio,
  formatErrorMessage,
  sanitizeInput
} from "@/constants/security"
import { LoanFormData } from "@/types/loan"

interface SecurityState {
  isRateLimited: boolean
  lastRequestTime: number
  requestCount: number
}

export function useSecurity() {
  const [securityState, setSecurityState] = useState<SecurityState>({
    isRateLimited: false,
    lastRequestTime: 0,
    requestCount: 0
  })

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now()
    const windowStart = now - SECURITY_CONSTANTS.RATE_LIMIT_WINDOW_MS

    if (securityState.lastRequestTime < windowStart) {
      // Reset if outside window
      setSecurityState({
        isRateLimited: false,
        lastRequestTime: now,
        requestCount: 1
      })
      return true
    }

    const newCount = securityState.requestCount + 1
    if (newCount > SECURITY_CONSTANTS.RATE_LIMIT_REQUESTS) {
      setSecurityState(prev => ({ ...prev, isRateLimited: true }))
      return false
    }

    setSecurityState({
      isRateLimited: false,
      lastRequestTime: now,
      requestCount: newCount
    })
    return true
  }, [securityState])

  const validateForm = useCallback((data: LoanFormData, collateralPrice: number): Record<string, string> => {
    const errors: Record<string, string> = {}

    // Validate loan amount
    if (data.loanAmount < SECURITY_CONSTANTS.MIN_LOAN_AMOUNT || 
        data.loanAmount > SECURITY_CONSTANTS.MAX_LOAN_AMOUNT) {
      errors.loanAmount = formatErrorMessage(ERROR_MESSAGES.INVALID_AMOUNT, {
        min: SECURITY_CONSTANTS.MIN_LOAN_AMOUNT,
        max: SECURITY_CONSTANTS.MAX_LOAN_AMOUNT
      })
    }

    // Validate loan term
    if (data.loanTerm < SECURITY_CONSTANTS.MIN_LOAN_TERM || 
        data.loanTerm > SECURITY_CONSTANTS.MAX_LOAN_TERM) {
      errors.loanTerm = formatErrorMessage(ERROR_MESSAGES.INVALID_TERM, {
        min: SECURITY_CONSTANTS.MIN_LOAN_TERM,
        max: SECURITY_CONSTANTS.MAX_LOAN_TERM
      })
    }

    // Validate APY
    if (data.apy < SECURITY_CONSTANTS.MIN_APY || 
        data.apy > SECURITY_CONSTANTS.MAX_APY) {
      errors.apy = formatErrorMessage(ERROR_MESSAGES.INVALID_APY, {
        min: SECURITY_CONSTANTS.MIN_APY,
        max: SECURITY_CONSTANTS.MAX_APY
      })
    }

    // Validate wallet address
    if (data.receiverAddress && !validateWalletAddress(data.receiverAddress)) {
      errors.receiverAddress = ERROR_MESSAGES.INVALID_WALLET
    }

    // Validate collateral ratio
    if (!validateCollateralRatio(data.loanAmount, data.collateralAmount, collateralPrice)) {
      const ratio = (data.collateralAmount * collateralPrice / data.loanAmount) * 100
      if (ratio < SECURITY_CONSTANTS.MIN_COLLATERAL_RATIO) {
        errors.collateralAmount = formatErrorMessage(ERROR_MESSAGES.INSUFFICIENT_COLLATERAL, {
          min: SECURITY_CONSTANTS.MIN_COLLATERAL_RATIO
        })
      } else {
        errors.collateralAmount = formatErrorMessage(ERROR_MESSAGES.EXCESSIVE_COLLATERAL, {
          max: SECURITY_CONSTANTS.MAX_COLLATERAL_RATIO
        })
      }
    }

    return errors
  }, [])

  const sanitizeFormData = useCallback((data: LoanFormData): LoanFormData => {
    return {
      ...data,
      receiverAddress: sanitizeInput(data.receiverAddress)
    }
  }, [])

  return {
    isRateLimited: securityState.isRateLimited,
    checkRateLimit,
    validateForm,
    sanitizeFormData
  }
} 