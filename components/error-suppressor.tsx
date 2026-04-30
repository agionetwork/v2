"use client"

import { useEffect } from 'react'

export function ErrorSuppressor() {
  useEffect(() => {
    // Ensure error suppression is active on client side
    const suppressErrors = () => {
      // Override console.error
      const originalConsoleError = console.error
      console.error = function(...args: any[]) {
        // Verificar todos os argumentos para objetos Event
        for (let i = 0; i < args.length; i++) {
          const arg = args[i]
          if (!arg) continue
          
          // Verificar se é um objeto Event
          if (arg instanceof Event || 
              arg.constructor?.name === 'Event' ||
              arg.toString() === '[object Event]' ||
              (typeof arg === 'object' && arg.constructor === Event) ||
              (typeof arg === 'object' && arg.constructor?.name === 'Event')) {
            return // Silent suppression
          }
          
          // Verificar mensagem
          const message = typeof arg === 'string' ? arg : (arg?.message || arg?.toString() || '')
          if (message === '[object Event]' ||
              message.includes('[object Event]') ||
              message.includes("Cannot destructure property 'register'") ||
              message.includes('Cannot destructure property') ||
              message.includes('register') ||
              message.includes('EIP-6963') ||
              message.includes('RequestProviderEvent') ||
              message.includes('Failed to fetch') ||
              message.includes('chrome-extension') ||
              message.includes('injected.js') ||
              message.includes('inpage.js') ||
              message.includes('solana.js') ||
              message.includes('btc.js') ||
              message.includes('sui.js')) {
            return // Silent suppression
          }
        }
        originalConsoleError.apply(console, args)
      }

      // Override window.onerror
      const originalOnError = window.onerror
      window.onerror = function(message, source, lineno, colno, error) {
        // Verificar se message é [object Event]
        if (message === '[object Event]' || 
            (typeof message === 'string' && message.includes('[object Event]'))) {
          return true // Silent suppression
        }
        
        if (error) {
          // Verificar se error é um Event
          if (error instanceof Event || 
              error.constructor?.name === 'Event' ||
              error.toString() === '[object Event]' ||
              (typeof error === 'object' && error.constructor === Event)) {
            return true // Silent suppression
          }
          
          const errorMessage = error.message || error.toString()
          const errorStack = error.stack || ''
          
          if (
            errorMessage === '[object Event]' ||
            errorMessage.includes("Cannot destructure property 'register'") ||
            errorMessage.includes('register') ||
            errorStack.includes('chrome-extension://') ||
            errorStack.includes('solana.js') ||
            errorStack.includes('btc.js') ||
            errorStack.includes('sui.js') ||
            errorStack.includes('inpage.js') ||
            errorStack.includes('injected.js')
          ) {
            return true // Silent suppression
          }
        }
        if (originalOnError) {
          return originalOnError(message, source, lineno, colno, error)
        }
        return false
      }

      // Override window.onunhandledrejection
      const originalOnUnhandledRejection = window.onunhandledrejection
      window.onunhandledrejection = function(event) {
        if (event.reason) {
          const reasonMessage = event.reason.message || event.reason.toString()
          const reasonStack = event.reason.stack || ''
          
          if (
            event.reason.toString() === '[object Event]' ||
            event.reason.constructor?.name === 'Event' ||
            (typeof event.reason === 'object' && event.reason instanceof Event) ||
            reasonMessage.includes("Cannot destructure property 'register'") ||
            reasonMessage.includes('register') ||
            reasonStack.includes('chrome-extension://') ||
            reasonStack.includes('solana.js') ||
            reasonStack.includes('btc.js') ||
            reasonStack.includes('sui.js') ||
            reasonStack.includes('inpage.js') ||
            reasonStack.includes('injected.js')
          ) {
            event.preventDefault()
            return // Silent suppression
          }
        }
        // Note: Not calling original handler to avoid type issues
      }

      // Add event listeners for additional suppression
      const errorHandler = (event: ErrorEvent) => {
        if (event.error && (
          event.error.toString() === '[object Event]' ||
          event.error.constructor?.name === 'Event' ||
          (typeof event.error === 'object' && event.error instanceof Event) ||
          (event.error.message && event.error.message.includes('Failed to fetch')) ||
          (event.error.message && event.error.message.includes('chrome-extension')) ||
          (event.error.message && event.error.message.includes('Cannot destructure property')) ||
          (event.error.message && event.error.message.includes('register')) ||
          (event.error.message && event.error.message.includes('EIP-6963')) ||
          (event.error.message && event.error.message.includes('RequestProviderEvent'))
        )) {
          event.preventDefault()
          return false
        }
      }

      const rejectionHandler = (event: PromiseRejectionEvent) => {
        if (event.reason && (
          event.reason.toString() === '[object Event]' ||
          event.reason.constructor?.name === 'Event' ||
          (typeof event.reason === 'object' && event.reason instanceof Event) ||
          (event.reason.message && event.reason.message.includes('Failed to fetch')) ||
          (event.reason.message && event.reason.message.includes('chrome-extension')) ||
          (event.reason.message && event.reason.message.includes('Cannot destructure property')) ||
          (event.reason.message && event.reason.message.includes('register')) ||
          (event.reason.message && event.reason.message.includes('EIP-6963')) ||
          (event.reason.message && event.reason.message.includes('RequestProviderEvent'))
        )) {
          event.preventDefault()
          return false
        }
      }

      window.addEventListener('error', errorHandler, true)
      window.addEventListener('unhandledrejection', rejectionHandler, true)

      // Client-side error suppressor activated
    }

    // Run immediately
    suppressErrors()

    // Also run after a short delay to catch any late errors
    const timeoutId = setTimeout(suppressErrors, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [])

  return null // This component doesn't render anything
}
