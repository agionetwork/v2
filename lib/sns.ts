import { Connection, PublicKey } from "@solana/web3.js"

// Cache: wallet address -> .sol domain (or null if none found)
const domainCache = new Map<string, string | null>()
// Cache: .sol domain -> wallet address (or null if invalid)
const addressCache = new Map<string, string | null>()

/**
 * Resolve a wallet address to its .sol domain name (reverse lookup).
 * Returns the domain (e.g. "alice.sol") or null if not found.
 */
export async function resolveAddressToDomain(
  connection: Connection,
  walletAddress: string
): Promise<string | null> {
  if (domainCache.has(walletAddress)) {
    return domainCache.get(walletAddress) ?? null
  }

  try {
    const { getAllDomains, reverseLookup } = await import("@bonfida/spl-name-service")
    const ownerKey = new PublicKey(walletAddress)
    const domains = await getAllDomains(connection, ownerKey)

    if (!domains || domains.length === 0) {
      domainCache.set(walletAddress, null)
      return null
    }

    const domainName = await reverseLookup(connection, domains[0])
    const fullDomain = `${domainName}.sol`
    domainCache.set(walletAddress, fullDomain)
    return fullDomain
  } catch {
    domainCache.set(walletAddress, null)
    return null
  }
}

/**
 * Resolve a .sol domain name to a wallet address (forward lookup).
 * Returns the wallet address string or null if invalid.
 */
export async function resolveDomainToAddress(
  connection: Connection,
  domain: string
): Promise<string | null> {
  const cleanDomain = domain.toLowerCase().replace(/\.sol$/, "")
  const cacheKey = `${cleanDomain}.sol`

  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey) ?? null
  }

  try {
    const { resolve } = await import("@bonfida/spl-name-service")
    const owner = await resolve(connection, cleanDomain)
    const address = owner.toBase58()
    addressCache.set(cacheKey, address)
    return address
  } catch {
    addressCache.set(cacheKey, null)
    return null
  }
}

/**
 * Check if a string looks like a .sol domain.
 */
export function isSolDomain(input: string): boolean {
  return /^[a-zA-Z0-9-]+\.sol$/.test(input.trim())
}
