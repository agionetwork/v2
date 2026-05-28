'use client'

import { useContext, useMemo, useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { LoansContext } from '@/components/loans-provider'
import { useWalletContext } from '@/components/wallet-provider'

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
  // `connecting` covers the wallet-adapter init window where publicKey
  // briefly reads as null even though a wallet is about to attach. We
  // gate myWalletsReady on it so consumers don't render the unfiltered
  // marketplace before the user's wallet info is even known.
  const { publicKey, connecting } = useWallet()
  // The header uses a custom WalletProvider that stores the connected
  // address in sessionStorage and is the source of truth for "who's
  // logged in". A WalletSyncBridge mirrors it into the wallet-adapter
  // (used for signing), but that sync has a ~100 ms race AND silently
  // no-ops for wallets whose adapter package isn't registered in the
  // dashboard's WalletProvider (only Phantom is wired today). Filtering
  // is read-only and only needs an address, so we fall back to the
  // custom address whenever the adapter publicKey is still null —
  // dashboards then show the user's loans immediately on connect,
  // regardless of which wallet they use.
  const { address: customAddress } = useWalletContext()
  const effectiveAddress: string | null = publicKey?.toBase58() ?? customAddress ?? null

  // Resolve agent wallet (Privy wallet) so agent-created loans show as user's own
  const [agentWallet, setAgentWallet] = useState<string | null>(null)
  // Resolve stealth wallets (Cloak privacy mode) so private loans show as user's own
  const [stealthWallets, setStealthWallets] = useState<string[]>([])
  // Tracks whether the agent + stealth lookups have finished so
  // consumers can wait before rendering filters that depend on
  // isMyWallet. Without this, the marketplace briefly shows the
  // user's own agent/stealth offers before the late-arriving lookup
  // pulls them out (visible "6 → 4 offers" flicker on Surfer).
  const [agentResolved, setAgentResolved] = useState(false)
  const [stealthsResolved, setStealthsResolved] = useState(false)

  useEffect(() => {
    if (!effectiveAddress) {
      setAgentWallet(null)
      setStealthWallets([])
      setAgentResolved(true)
      setStealthsResolved(true)
      return
    }
    setAgentResolved(false)
    setStealthsResolved(false)
    const wallet = effectiveAddress
    let cancelled = false

    fetch(`/api/agent/public-key?wallet=${wallet}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        setAgentWallet(data.agentPublicKey || null)
        setAgentResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        setAgentWallet(null)
        setAgentResolved(true)
      })

    fetch(`/api/private-offer/list?wallet=${wallet}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        setStealthWallets(Array.isArray(data?.stealthPublicKeys) ? data.stealthPublicKeys : [])
        setStealthsResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        setStealthWallets([])
        setStealthsResolved(true)
      })

    return () => { cancelled = true }
  }, [effectiveAddress])

  // Adapter still attaching → wait. No wallet → ready immediately
  // (no filtering needed). Wallet attached → wait for both flag fetches.
  const myWalletsReady = connecting
    ? false
    : !effectiveAddress
      ? true
      : agentResolved && stealthsResolved

  const stealthSet = useMemo(() => new Set(stealthWallets), [stealthWallets])

  // True iff `addr` is a stealth wallet that the current user owns.
  const isMyStealth = useCallback(
    (addr: string | null) => !!addr && stealthSet.has(addr),
    [stealthSet],
  )

  // Check if an address belongs to the current user (owner wallet, agent wallet, or any of their stealths)
  const isMyWallet = useCallback((addr: string | null) => {
    if (!effectiveAddress || !addr) return false
    if (addr === effectiveAddress) return true
    if (agentWallet !== null && addr === agentWallet) return true
    if (stealthSet.has(addr)) return true
    return false
  }, [effectiveAddress, agentWallet, stealthSet])

  // Filter helpers — match owner, agent, and stealth wallets
  const myBorrowedLoans = useMemo(() => {
    if (!effectiveAddress) return []
    return loans.filter(l => isMyWallet(l.borrower))
  }, [loans, effectiveAddress, isMyWallet])

  const myLentLoans = useMemo(() => {
    if (!effectiveAddress) return []
    return loans.filter(l => isMyWallet(l.lender))
  }, [loans, effectiveAddress, isMyWallet])

  const myLoans = useMemo(() => {
    if (!effectiveAddress) return []
    return loans.filter(l => isMyWallet(l.borrower) || isMyWallet(l.lender))
  }, [loans, effectiveAddress, isMyWallet])

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
    stealthWallets,
    isMyWallet,
    isMyStealth,
    /**
     * True once the agent + stealth lookups have settled (or no
     * wallet is connected). Consumers that filter offers via
     * isMyWallet should wait for this before rendering, otherwise
     * the user's own agent/stealth offers leak into the marketplace
     * for a frame.
     */
    myWalletsReady,
  }
}
