"use client"

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error but don't show it to user for fetch errors and malformed events
    const errorMessage = error.message || error.toString()
    const errorStack = error.stack || ''
    
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('chrome-extension') ||
        errorMessage.includes('WalletConnect') ||
        errorMessage.includes("Cannot destructure property 'register'") ||
        errorMessage.includes('Cannot destructure property') ||
        errorMessage.includes('register') ||
        errorStack.includes('chrome-extension://') ||
        errorStack.includes('@walletconnect/') ||
        errorStack.includes('solana.js') ||
        errorStack.includes('btc.js') ||
        errorStack.includes('sui.js') ||
        errorStack.includes('inpage.js') ||
        errorStack.includes('injected.js') ||
        error.toString() === '[object Event]' ||
        error.constructor?.name === 'Event') {
      // Silenciar completamente - não logar nem mostrar
      this.setState({ hasError: false })
      return
    }
    
    console.error('Error caught by boundary:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback
      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }
      
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
            <button 
              onClick={this.resetError}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook to handle fetch errors
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error) => {
    // Suppress Chrome extension and WalletConnect errors
    if (error.message.includes('chrome-extension://') || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('WalletConnect') ||
        error.stack?.includes('chrome-extension://') ||
        error.stack?.includes('@walletconnect/')) {
      console.warn('Suppressed extension/wallet error:', error.message)
      return
    }
    
    console.error('Unhandled error:', error)
  }, [])

  return { handleError }
}

// Global error handler to suppress extension errors
export function setupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return

  // Handler for unhandled errors
  const handleUnhandledError = (event: ErrorEvent) => {
    // Suppress extension errors and malformed events
    if (event.error?.message?.includes('Failed to fetch') ||
        event.error?.message?.includes('chrome-extension') ||
        event.error?.stack?.includes('chrome-extension://') ||
        event.error?.stack?.includes('@walletconnect/') ||
        event.error?.toString() === '[object Event]' ||
        event.error?.constructor?.name === 'Event') {
      console.warn('Suppressed global extension/event error:', event.error?.message || event.error?.toString())
      event.preventDefault()
      return false
    }
  }

  // Handler for promise rejections
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (event.reason?.message?.includes('Failed to fetch') ||
        event.reason?.message?.includes('chrome-extension') ||
        event.reason?.stack?.includes('chrome-extension://') ||
        event.reason?.stack?.includes('@walletconnect/') ||
        event.reason?.toString() === '[object Event]' ||
        event.reason?.constructor?.name === 'Event') {
      console.warn('Suppressed promise rejection:', event.reason?.message || event.reason?.toString())
      event.preventDefault()
      return false
    }
  }

  window.addEventListener('error', handleUnhandledError)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)

  return () => {
    window.removeEventListener('error', handleUnhandledError)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }
}
