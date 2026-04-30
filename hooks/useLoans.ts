'use client'

import { useContext, useMemo, useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { LoansContext } from '@/components/loans-provider'

// Re-export shared types and functions from loan-utils so existing client
// imports (`from '@/hooks/useLoans'`) keep working without changes.
export { LoanStatus, parseLoanAccounts, getStatusLabel, formatDuration } from '@/lib/loan-utils'
export type { ParsedLoan, OfferType } from '@/lib/loan-utils'

// Import LoanStatus for use inside this file
import { LoanStatus } from '@/lib/loan-utils'

export function useLoans() {
  const context = useContext(LoansContext)
  if (!context) {
    throw new Error('useLoans must be used within a LoansProvider')
  }

  const { loans, loading, error, refetch } = context
  const { publicKey } = useWallet()

  // Resolve agent wallet (Privy wallet) so agent-created loans show as user's own
  const [agentWallet, setAgentWallet] = useState<string | null>(null)

  useEffect(() => {
    if (!publicKey) {
      setAgentWallet(null)
      return
    }
    const wallet = publicKey.toBase58()
    let cancelled = false
    fetch(`/api/agent/public-key?wallet=${wallet}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setAgentWallet(data.agentPublicKey || null)
      })
      .catch(() => {
        if (!cancelled) setAgentWallet(null)
      })
    return () => { cancelled = true }
  }, [publicKey])

  // Check if an address belongs to the current user (owner wallet or agent wallet)
  const isMyWallet = useCallback((addr: string | null) => {
    if (!publicKey || !addr) return false
    const pk = publicKey.toBase58()
    return addr === pk || (agentWallet !== null && addr === agentWallet)
  }, [publicKey, agentWallet])

  // Filter helpers — match both owner wallet and agent wallet
  const myBorrowedLoans = useMemo(() => {
    if (!publicKey) return []
    return loans.filter(l => isMyWallet(l.borrower))
  }, [loans, publicKey, isMyWallet])

  const myLentLoans = useMemo(() => {
    if (!publicKey) return []
    return loans.filter(l => isMyWallet(l.lender))
  }, [loans, publicKey, isMyWallet])

  const myLoans = useMemo(() => {
    if (!publicKey) return []
    return loans.filter(l => isMyWallet(l.borrower) || isMyWallet(l.lender))
  }, [loans, publicKey, isMyWallet])

  const activeLoans = useMemo(() =>
    loans.filter(l => l.status === LoanStatus.Accepted),
  [loans])

  const openOffers = useMemo(() =>
    loans.filter(l => l.status === LoanStatus.Pending && l.privateStatus === 0),
  [loans])

  // Lend offers: lender posted, waiting for borrower to accept (public only)
  const availableLendOffers = useMemo(() =>
    loans.filter(l => l.status === LoanStatus.Pending && l.offerType === 'lend' && l.privateStatus === 0),
  [loans])

  // Borrow requests: borrower posted, waiting for lender to accept (public only)
  const availableBorrowOffers = useMemo(() =>
    loans.filter(l => l.status === LoanStatus.Pending && l.offerType === 'borrow' && l.privateStatus === 0),
  [loans])

  return {
    loans,
    loading,
    error,
    refetch,
    myBorrowedLoans,
    myLentLoans,
    myLoans,
    activeLoans,
    openOffers,
    availableBorrowOffers,
    availableLendOffers,
    agentWallet,
    isMyWallet,
  }
}
