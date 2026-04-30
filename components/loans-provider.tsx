'use client'

import { createContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import type { ParsedLoan } from '@/lib/loan-utils'

const CACHE_KEY = 'agio_loans_cache'
const CACHE_TTL = 30_000 // 30 seconds

interface CachedLoans {
  loans: ParsedLoan[]
  timestamp: number
}

function loadCachedLoans(): ParsedLoan[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const cached: CachedLoans = JSON.parse(raw)
    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.loans
  } catch { /* ignore */ }
  return []
}

function saveCachedLoans(loans: ParsedLoan[]) {
  try {
    const data: CachedLoans = { loans, timestamp: Date.now() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

interface LoansContextValue {
  loans: ParsedLoan[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export const LoansContext = createContext<LoansContextValue | null>(null)

export function LoansProvider({ children }: { children: ReactNode }) {
  const [loans, setLoans] = useState<ParsedLoan[]>(() => loadCachedLoans())
  const [loading, setLoading] = useState(() => loadCachedLoans().length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchLoans = useCallback(async (attempt = 0) => {
    // Only show loading spinner if we have no cached data
    if (attempt === 0 && loadCachedLoans().length === 0) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/loans')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const parsed: ParsedLoan[] = await res.json()
      setLoans(parsed)
      saveCachedLoans(parsed)
    } catch (err: any) {
      console.error('Failed to fetch loans:', err)
      // Retry up to 2 times with exponential backoff
      if (attempt < 2) {
        const delay = (attempt + 1) * 2000
        setTimeout(() => fetchLoans(attempt + 1), delay)
        return
      }
      setError(err.message || 'Failed to fetch loans')
      // Keep cached data instead of clearing
      const cached = loadCachedLoans()
      if (cached.length > 0) {
        setLoans(cached)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLoans()
    const interval = setInterval(fetchLoans, 30_000) // 30s polling
    return () => clearInterval(interval)
  }, [fetchLoans])

  const value = useMemo(() => ({
    loans,
    loading,
    error,
    refetch: fetchLoans,
  }), [loans, loading, error, fetchLoans])

  return (
    <LoansContext.Provider value={value}>
      {children}
    </LoansContext.Provider>
  )
}
