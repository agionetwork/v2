"use client"

import { useEffect } from 'react'

export function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Monitora erros
    const errorHandler = (event: ErrorEvent) => {
      console.error('Error:', event.error || event.message || 'Unknown error')
    }

    // Monitora rejeições de promises
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason || 'Unknown rejection')
    }

    // Adiciona listeners
    window.addEventListener('error', errorHandler)
    window.addEventListener('unhandledrejection', rejectionHandler)

    // Cleanup
    return () => {
      window.removeEventListener('error', errorHandler)
      window.removeEventListener('unhandledrejection', rejectionHandler)
    }
  }, [])

  return null
}
