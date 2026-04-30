"use client"

import { useEffect, useState } from 'react'

export function GlobalErrorHandler() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Handler específico para eventos malformados do Next.js
    const handleNextJSError = (event: any) => {
      if (event?.error?.toString() === '[object Event]' ||
          event?.reason?.toString() === '[object Event]' ||
          event?.error?.constructor?.name === 'Event' ||
          event?.reason?.constructor?.name === 'Event') {
        console.warn('Suppressed Next.js malformed event:', event.error || event.reason)
        event.preventDefault?.()
        return false
      }
    }

    // Handler para erros de chunk loading
    const handleChunkError = (event: any) => {
      if (event?.error?.message?.includes('Loading chunk') ||
          event?.error?.message?.includes('ChunkLoadError') ||
          event?.reason?.message?.includes('Loading chunk') ||
          event?.reason?.message?.includes('ChunkLoadError')) {
        console.warn('Suppressed chunk loading error:', event.error || event.reason)
        event.preventDefault?.()
        return false
      }
    }

    // Adicionar listeners específicos para Next.js
    window.addEventListener('error', handleNextJSError)
    window.addEventListener('unhandledrejection', handleNextJSError)
    window.addEventListener('error', handleChunkError)
    window.addEventListener('unhandledrejection', handleChunkError)

    return () => {
      window.removeEventListener('error', handleNextJSError)
      window.removeEventListener('unhandledrejection', handleNextJSError)
      window.removeEventListener('error', handleChunkError)
      window.removeEventListener('unhandledrejection', handleChunkError)
    }
  }, [])

  // Não renderizar nada se não estiver montado
  if (!mounted) return null

  return null
}
