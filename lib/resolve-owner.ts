import {
  getOwnerByAgentPublicKey,
  getAgentPublicKey,
  getActiveAgents,
  isRedisConfigured,
  getRedis,
} from "@/lib/agent/redis"

// In-memory cache: wallet -> ownerWallet (TTL-based)
const ownerCache = new Map<string, { owner: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Fallback reverse map: agentPubkey → ownerWallet, built from active agents
let reverseMapCache: Map<string, string> | null = null
let reverseMapExpiry = 0
const REVERSE_MAP_TTL_MS = 5 * 60 * 1000

/**
 * Build a complete agent→owner reverse map from forward lookups.
 * Uses both `agents:active` and `agents:all` sets for comprehensive coverage.
 * Agents that were deactivated (removed from `agents:active`) are still found
 * via `agents:all` which persists across activation/deactivation cycles.
 */
async function buildReverseMap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (reverseMapCache && reverseMapExpiry > now) return reverseMapCache

  // Collect owners from both active and all-time sets
  const ownerSet = new Set<string>()
  const activeOwners = await getActiveAgents()
  for (const w of activeOwners) ownerSet.add(w)

  try {
    const allOwners = await getRedis().smembers("agents:all")
    for (const w of allOwners) ownerSet.add(w)
  } catch { /* agents:all may not exist yet */ }

  const map = new Map<string, string>()

  const lookups = await Promise.allSettled(
    Array.from(ownerSet).map((owner) =>
      getAgentPublicKey(owner).then((pk) => ({ owner, pk })),
    ),
  )

  for (const r of lookups) {
    if (r.status === "fulfilled" && r.value.pk) {
      map.set(r.value.pk, r.value.owner)
    }
  }

  reverseMapCache = map
  reverseMapExpiry = now + REVERSE_MAP_TTL_MS
  return map
}

/**
 * Resolves a wallet address to its owner.
 * If the wallet is an agent (Privy) wallet, returns the owner wallet.
 * If the wallet is already an owner or external wallet, returns itself.
 *
 * Uses two resolution strategies:
 * 1. Primary: `agent:reverse:{pubkey}` Redis key (O(1))
 * 2. Fallback: build reverse map from all active agents' forward keys (cached)
 *
 * Self-heals: if found via fallback, repairs the missing reverse key.
 */
export async function resolveOwner(wallet: string): Promise<string> {
  if (!wallet) return wallet

  const cached = ownerCache.get(wallet)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.owner
  }

  if (!isRedisConfigured()) return wallet

  try {
    // Primary: direct reverse key lookup
    const owner = await getOwnerByAgentPublicKey(wallet)
    if (owner) {
      ownerCache.set(wallet, { owner, expiresAt: Date.now() + CACHE_TTL_MS })
      return owner
    }

    // Fallback: build reverse map from active agents' forward lookups
    const reverseMap = await buildReverseMap()
    const fallbackOwner = reverseMap.get(wallet)
    if (fallbackOwner) {
      // Self-heal: write the missing reverse key for future lookups
      getRedis().set(`agent:reverse:${wallet}`, fallbackOwner).catch(() => {})
      ownerCache.set(wallet, { owner: fallbackOwner, expiresAt: Date.now() + CACHE_TTL_MS })
      return fallbackOwner
    }

    // Not an agent wallet — cache as self
    ownerCache.set(wallet, { owner: wallet, expiresAt: Date.now() + CACHE_TTL_MS })
    return wallet
  } catch {
    return wallet
  }
}

/**
 * Batch resolve multiple wallets to their owners.
 * Returns Map<inputWallet, resolvedOwnerWallet>
 */
export async function resolveOwners(wallets: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(wallets.filter(Boolean))]
  const result = new Map<string, string>()
  const uncached: string[] = []
  const now = Date.now()

  for (const w of unique) {
    const cached = ownerCache.get(w)
    if (cached && cached.expiresAt > now) {
      result.set(w, cached.owner)
    } else {
      uncached.push(w)
    }
  }

  if (uncached.length === 0 || !isRedisConfigured()) {
    for (const w of uncached) result.set(w, w)
    return result
  }

  // Primary: batch reverse key lookups
  const lookups = await Promise.allSettled(
    uncached.map((w) =>
      getOwnerByAgentPublicKey(w).then((owner) => ({ wallet: w, owner })),
    ),
  )

  const stillUnresolved: string[] = []
  for (const r of lookups) {
    if (r.status === "fulfilled") {
      if (r.value.owner) {
        ownerCache.set(r.value.wallet, { owner: r.value.owner, expiresAt: now + CACHE_TTL_MS })
        result.set(r.value.wallet, r.value.owner)
      } else {
        stillUnresolved.push(r.value.wallet)
      }
    } else {
      const idx = lookups.indexOf(r)
      if (idx >= 0 && uncached[idx]) stillUnresolved.push(uncached[idx])
    }
  }

  // Fallback: use reverse map for any unresolved wallets
  if (stillUnresolved.length > 0) {
    const reverseMap = await buildReverseMap()
    for (const w of stillUnresolved) {
      const fallbackOwner = reverseMap.get(w)
      if (fallbackOwner) {
        // Self-heal the missing reverse key
        getRedis().set(`agent:reverse:${w}`, fallbackOwner).catch(() => {})
        ownerCache.set(w, { owner: fallbackOwner, expiresAt: now + CACHE_TTL_MS })
        result.set(w, fallbackOwner)
      } else {
        ownerCache.set(w, { owner: w, expiresAt: now + CACHE_TTL_MS })
        result.set(w, w)
      }
    }
  }

  return result
}
