import { useState, useCallback, useEffect } from "react"
import { 
  LoanFormState, 
  LoanFormData, 
  INITIAL_FORM_STATE,
  calculateLoanSummary,
  LoanSummary,
  FeedbackState
} from "@/types/loan"
import { useSecurity } from "@/hooks/useSecurity"
import { ERROR_MESSAGES, SECURITY_CONSTANTS } from "@/constants/security"
import { debounce } from "@/lib/utils"

export function useLoanForm(collateralPrice: number) {
  const [formState, setFormState] = useState<LoanFormState>(INITIAL_FORM_STATE)
  const [summary, setSummary] = useState<LoanSummary>(calculateLoanSummary(INITIAL_FORM_STATE))
  const [feedback, setFeedback] = useState<FeedbackState>({ type: null, message: null })
  const [isDirty, setIsDirty] = useState<Record<keyof LoanFormData, boolean>>({
    loanAmount: false,
    collateralAmount: false,
    loanTerm: false,
    apy: false,
    token: false,
    tokenCollateral: false,
    receiverAddress: false,
    operationType: false
  })
  
  const { isRateLimited, checkRateLimit, validateForm, sanitizeFormData } = useSecurity()

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce((data: LoanFormData) => {
      const errors = validateForm(data, collateralPrice)
      setFormState(prev => ({ ...prev, errors }))
    }, 500),
    [collateralPrice, validateForm]
  )

  // Real-time field validation
  const validateField = useCallback((field: keyof LoanFormData, value: any) => {
    let error = ""

    switch (field) {
      case "loanAmount":
        if (value < SECURITY_CONSTANTS.MIN_LOAN_AMOUNT || value > SECURITY_CONSTANTS.MAX_LOAN_AMOUNT) {
          error = `Amount must be between ${SECURITY_CONSTANTS.MIN_LOAN_AMOUNT} and ${SECURITY_CONSTANTS.MAX_LOAN_AMOUNT}`
        }
        break
      case "loanTerm":
        if (value < SECURITY_CONSTANTS.MIN_LOAN_TERM || value > SECURITY_CONSTANTS.MAX_LOAN_TERM) {
          error = `Term must be between ${SECURITY_CONSTANTS.MIN_LOAN_TERM} and ${SECURITY_CONSTANTS.MAX_LOAN_TERM} days`
        }
        break
      case "apy":
        if (value < SECURITY_CONSTANTS.MIN_APY || value > SECURITY_CONSTANTS.MAX_APY) {
          error = `APY must be between ${SECURITY_CONSTANTS.MIN_APY}% and ${SECURITY_CONSTANTS.MAX_APY}%`
        }
        break
    }

    return error
  }, [])

  const handleValidation = useCallback(() => {
    const errors = validateForm(formState, collateralPrice)
    setFormState(prev => ({ ...prev, errors }))
    
    if (Object.keys(errors).length > 0) {
      setFeedback({
        type: "error",
        message: "Please correct the errors before proceeding"
      })
      return false
    }
    
    return true
  }, [formState, collateralPrice, validateForm])

  const updateField = useCallback(<K extends keyof LoanFormData>(field: K, value: LoanFormData[K]) => {
    setIsDirty(prev => ({ ...prev, [field]: true }))
    
    // Immediate field validation if field is dirty
    if (isDirty[field]) {
      const fieldError = validateField(field, value)
      setFormState(prev => ({
        ...prev,
        [field]: value,
        errors: { ...prev.errors, [field]: fieldError }
      }))
    } else {
      setFormState(prev => ({
        ...prev,
        [field]: value
      }))
    }

    // Trigger debounced full form validation
    debouncedValidate({ ...formState, [field]: value })
    
    // Update loan summary
    setSummary(calculateLoanSummary({ ...formState, [field]: value }))
    setFeedback({ type: null, message: null })
  }, [formState, isDirty, validateField, debouncedValidate])

  const resetForm = () => {
    setFormState(INITIAL_FORM_STATE)
    setSummary(calculateLoanSummary(INITIAL_FORM_STATE))
    setFeedback({ type: null, message: null })
    setIsDirty({
      loanAmount: false,
      collateralAmount: false,
      loanTerm: false,
      apy: false,
      token: false,
      tokenCollateral: false,
      receiverAddress: false,
      operationType: false
    })
  }

  const handleCreateLoan = async () => {
    if (isRateLimited) {
      setFeedback({
        type: "error",
        message: ERROR_MESSAGES.RATE_LIMIT
      })
      return
    }

    if (!checkRateLimit()) {
      return
    }

    if (!handleValidation()) {
      return
    }

    const sanitizedData = sanitizeFormData(formState)
    setFormState(prev => ({ ...prev, ...sanitizedData }))

    setFormState(prev => ({ ...prev, isLoading: true }))
    setFeedback({ type: "info", message: "Creating loan..." })

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))

      setFormState(prev => ({ ...prev, isSuccess: true }))
      setFeedback({
        type: "success",
        message: "Loan created successfully!"
      })
      
      setTimeout(() => {
        setFormState(prev => ({ ...prev, isSuccess: false }))
        setFeedback({ type: null, message: null })
        resetForm()
      }, 3000)
    } catch (error) {
      console.error("Error creating loan:", error)
      setFormState(prev => ({
        ...prev,
        errors: { submit: ERROR_MESSAGES.NETWORK_ERROR }
      }))
      setFeedback({
        type: "error",
        message: ERROR_MESSAGES.NETWORK_ERROR
      })
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const showFieldError = useCallback((field: keyof LoanFormData) => {
    return isDirty[field] ? formState.errors[field] || "" : ""
  }, [formState.errors, isDirty])

  return {
    formState,
    summary,
    feedback,
    isDirty,
    handleCreateLoan,
    resetForm,
    updateField,
    handleValidation,
    showFieldError
  }
} 