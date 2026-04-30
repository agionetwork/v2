"use client"

import { useCallback, useState, useEffect, useRef } from "react"
import { useConnection } from "@solana/wallet-adapter-react"
import { resolveAddressToDomain, resolveDomainToAddress, isSolDomain } from "@/lib/sns"

/**
 * Imperative hook for resolving SNS .sol domains on demand.
 */
export function useSNS() {
  const { connection } = useConnection()

  const getDomain = useCallback(
    async (walletAddress: string): Promise<string | null> => {
      if (!walletAddress) return null
      return resolveAddressToDomain(connection, walletAddress)
    },
    [connection]
  )

  const getAddress = useCallback(
    async (domain: string): Promise<string | null> => {
      if (!domain) return null
      return resolveDomainToAddress(connection, domain)
    },
    [connection]
  )

  return { getDomain, getAddress, isSolDomain }
}

/**
 * Declarative hook that resolves a wallet address to its .sol domain.
 * Returns the domain string (e.g. "alice.sol") or null while loading/unavailable.
 */
export function useSolDomain(walletAddress: string | undefined | null): string | null {
  const { connection } = useConnection()
  const [domain, setDomain] = useState<string | null>(null)
  const addressRef = useRef(walletAddress)

  useEffect(() => {
    addressRef.current = walletAddress
    if (!walletAddress) {
      setDomain(null)
      return
    }

    let cancelled = false
    resolveAddressToDomain(connection, walletAddress).then((result) => {
      if (!cancelled && addressRef.current === walletAddress) {
        setDomain(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, [walletAddress, connection])

  return domain
}
