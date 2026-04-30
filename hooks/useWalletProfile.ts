"use client"

import { useState, useEffect, useRef } from "react"
import { searchProfiles, getCustomProperty } from "@/lib/tapestry"
import { useSolDomain } from "@/hooks/useSNS"

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + "..." + addr.slice(-4)
}

// Simple in-memory cache for agent → owner reverse lookups
const ownerCache = new Map<string, string | null>()

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
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [profileWallet, setProfileWallet] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const addressRef = useRef(address)

  // SNS domain for the original address (will be null if agent wallet has no domain)
  const solDomain = useSolDomain(address)

  useEffect(() => {
    addressRef.current = address
    if (!address) {
      setDisplayName(null)
      setProfileWallet(null)
      return
    }

    let cancelled = false
    setLoading(true)

    async function resolve() {
      if (!address) return

      // Step 1: Try Tapestry profile directly for this address
      try {
        const result = await searchProfiles(address, 1, 0)
        if (cancelled) return
        const profile = result.profiles?.[0]?.profile
        if (profile && profile.walletAddress?.toLowerCase() === address.toLowerCase()) {
          const name = getCustomProperty(profile, "displayName") || profile.username
          if (name) {
            setDisplayName(name)
            setProfileWallet(address)
            setLoading(false)
            return
          }
        }
      } catch {
        // continue to agent lookup
      }

      if (cancelled) return

      // Step 2: Try reverse lookup (agent → owner wallet)
      let ownerWallet: string | null = null
      if (ownerCache.has(address)) {
        ownerWallet = ownerCache.get(address) ?? null
      } else {
        try {
          const res = await fetch(`/api/agent/owner?agent=${address}`)
          if (cancelled) return
          const data = await res.json()
          ownerWallet = data.ownerWallet || null
          ownerCache.set(address, ownerWallet)
        } catch {
          ownerCache.set(address, null)
        }
      }

      if (cancelled) return

      // Step 3: If owner found, try Tapestry profile for the owner
      if (ownerWallet) {
        try {
          const result = await searchProfiles(ownerWallet, 1, 0)
          if (cancelled) return
          const profile = result.profiles?.[0]?.profile
          if (profile) {
            const name = getCustomProperty(profile, "displayName") || profile.username
            if (name) {
              setDisplayName(name)
              setProfileWallet(ownerWallet)
              setLoading(false)
              return
            }
          }
        } catch {
          // fall through
        }

        if (cancelled) return
        // Owner exists but no profile name — link to owner wallet anyway
        setProfileWallet(ownerWallet)
      } else {
        setProfileWallet(address)
      }

      // No Tapestry name found — displayName stays null, component falls back to solDomain/shortened
      setDisplayName(null)
      setLoading(false)
    }

    resolve()
    return () => { cancelled = true }
  }, [address])

  const finalName = displayName || solDomain || (address ? shortenAddress(address) : null)
  const finalWallet = profileWallet || address || null

  return {
    displayName: finalName,
    profileWallet: finalWallet,
    loading,
  }
}
