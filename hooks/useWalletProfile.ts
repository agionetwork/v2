"use client"

import { useState, useEffect, useRef } from "react"
import { searchProfiles, getCustomProperty } from "@/lib/tapestry"
import { useSolDomain } from "@/hooks/useSNS"
import { useIsStealth } from "@/hooks/useIsStealth"

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + "..." + addr.slice(-4)
}

// Simple in-memory cache for agent → owner reverse lookups
const ownerCache = new Map<string, string | null>()

// Module-level cache of fully-resolved profile records, keyed by the
// pubkey we were asked to resolve. A page (e.g. /loan-offers) can
// pre-warm this with prefetchWalletProfile(...) so per-row hooks
// return synchronously on their first render — no async flicker.
type ResolvedRecord = { displayName: string | null; profileWallet: string | null }
const profileCache = new Map<string, ResolvedRecord>()
const profileInflight = new Map<string, Promise<ResolvedRecord>>()

/**
 * Run the same resolution chain useWalletProfile does, but standalone
 * so callers can warm the module cache in batch. Subsequent hook
 * mounts for the same address return synchronously.
 */
export async function prefetchWalletProfile(address: string): Promise<ResolvedRecord> {
  if (!address) return { displayName: null, profileWallet: null }
  const cached = profileCache.get(address)
  if (cached) return cached
  const inflight = profileInflight.get(address)
  if (inflight) return inflight

  const job = (async (): Promise<ResolvedRecord> => {
    let displayName: string | null = null
    let profileWallet: string | null = null

    try {
      const result = await searchProfiles(address, 1, 0)
      const profile = result.profiles?.[0]?.profile
      if (profile && profile.walletAddress?.toLowerCase() === address.toLowerCase()) {
        const name = getCustomProperty(profile, "displayName") || profile.username
        if (name) {
          displayName = name
          profileWallet = address
        }
      }
    } catch { /* fall through */ }

    if (!displayName) {
      let ownerWallet: string | null = ownerCache.has(address) ? (ownerCache.get(address) ?? null) : null
      if (!ownerCache.has(address)) {
        try {
          const res = await fetch(`/api/agent/owner?agent=${address}`)
          const data = await res.json()
          ownerWallet = data.ownerWallet || null
        } catch { /* leave null */ }
        ownerCache.set(address, ownerWallet)
      }
      if (ownerWallet) {
        try {
          const result = await searchProfiles(ownerWallet, 1, 0)
          const profile = result.profiles?.[0]?.profile
          if (profile) {
            const name = getCustomProperty(profile, "displayName") || profile.username
            if (name) {
              displayName = name
              profileWallet = ownerWallet
            } else {
              profileWallet = ownerWallet
            }
          } else {
            profileWallet = ownerWallet
          }
        } catch {
          profileWallet = ownerWallet
        }
      } else {
        profileWallet = address
      }
    }

    const record: ResolvedRecord = { displayName, profileWallet }
    profileCache.set(address, record)
    profileInflight.delete(address)
    return record
  })()

  profileInflight.set(address, job)
  return job
}

/**
 * Convenience: pre-warm a list of pubkeys in parallel. Resolves once
 * every entry has a cache record (success or definitive miss).
 */
export async function prefetchWalletProfiles(addresses: (string | null | undefined)[]): Promise<void> {
  const unique = Array.from(
    new Set(addresses.filter((a): a is string => !!a)),
  )
  if (unique.length === 0) return
  await Promise.all(unique.map((a) => prefetchWalletProfile(a)))
}

/**
 * Resolves a wallet address to a Tapestry display name and profile link.
 * If the address is an agent wallet, performs a reverse lookup to find the
 * owner wallet and then resolves the owner's Tapestry profile.
 *
 * Returns:
 *  - displayName: Tapestry display name > SNS domain > shortened address
 *  - profileWallet: the owner wallet to link to (may differ from input if agent)
 *  - loading: whether resolution is in progress
 */
export function useWalletProfile(address: string | null | undefined) {
  // Seed initial state from the module cache so consumers that pre-warmed
  // (via prefetchWalletProfiles) render the resolved name on first paint —
  // no empty cell, no name-after-row flicker.
  const cached = address ? profileCache.get(address) : null
  const [displayName, setDisplayName] = useState<string | null>(cached?.displayName ?? null)
  const [profileWallet, setProfileWallet] = useState<string | null>(cached?.profileWallet ?? null)
  const [loading, setLoading] = useState(!!address && !cached)
  const addressRef = useRef(address)

  // SNS domain for the original address (will be null if agent wallet has no domain)
  const solDomain = useSolDomain(address)

  // Stealth wallets must NEVER resolve to a Tapestry profile, SNS domain, or
  // agent owner — that would defeat the privacy of the on-chain offer. The
  // server check is yes/no only, never the owner. See `/api/stealth/check`.
  const isStealth = useIsStealth(address)

  useEffect(() => {
    addressRef.current = address
    if (!address) {
      setDisplayName(null)
      setProfileWallet(null)
      return
    }

    if (isStealth) {
      setDisplayName(null)
      setProfileWallet(null)
      setLoading(false)
      return
    }

    // Cache hit — already resolved, no async work needed.
    const hit = profileCache.get(address)
    if (hit) {
      setDisplayName(hit.displayName)
      setProfileWallet(hit.profileWallet)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    prefetchWalletProfile(address)
      .then((record) => {
        if (cancelled) return
        setDisplayName(record.displayName)
        setProfileWallet(record.profileWallet)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setDisplayName(null)
        setProfileWallet(address ?? null)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [address, isStealth])

  // Stealth: never disclose anything beyond a fixed mask + no profile link.
  if (isStealth) {
    return {
      displayName: "Anonymous",
      profileWallet: null,
      isStealth: true,
      loading: false,
    }
  }

  const finalName = displayName || solDomain || (address ? shortenAddress(address) : null)
  const finalWallet = profileWallet || address || null

  return {
    displayName: finalName,
    profileWallet: finalWallet,
    isStealth: false,
    loading,
  }
}
