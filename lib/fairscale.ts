import { getRedis, isRedisConfigured } from "@/lib/agent/redis"

/**
 * Server-side client for FairScale on-chain reputation scores.
 *
 * Scores are 0-5. We split into tiers for legibility:
 *   < 2     Bronze
 *   2 - 3   Silver
 *   3 - 4   Gold
 *   >= 4    Platinum
 *
 * Caching is Redis-backed with a 6 hour TTL. Failures keep the last known
 * value (fail-open), so a transient FairScale outage never empties the
 * leaderboard.
 */

const FAIR_BASE = process.env.FAIRSCALE_API_URL || "https://api.fairscale.xyz"
const FAIR_KEY = process.env.FAIRSCALE_API_KEY
const FAIR_TTL_SECS = 6 * 60 * 60 // 6 hours
const FAIR_NEGATIVE_TTL_SECS = 5 * 60 // 5 minutes for misses (e.g. unknown wallet)

export type FairTier = "bronze" | "silver" | "gold" | "platinum" | "unrated"

export interface FairScore {
  wallet: string
  score: number
  subOnchain: number | null
  subSocial: number | null
  subBehavioral: number | null
  tier: FairTier
  /** Unix epoch seconds. */
  lastUpdated: number
  /** Where the value came from on this read. */
  source: "live" | "cache" | "miss"
}

export function classifyTier(score: number): FairTier {
  if (!Number.isFinite(score) || score <= 0) return "unrated"
  if (score >= 4) return "platinum"
  if (score >= 3) return "gold"
  if (score >= 2) return "silver"
  return "bronze"
}

interface CachedRecord {
  score: number
  subOnchain: number | null
  subSocial: number | null
  subBehavioral: number | null
  fetchedAt: number
}

const cacheKey = (wallet: string) => `fairscale:score:${wallet}`

async function readCache(wallet: string): Promise<CachedRecord | null> {
  if (!isRedisConfigured()) return null
  try {
    const raw = await getRedis().get(cacheKey(wallet))
    if (!raw) return null
    return typeof raw === "string" ? (JSON.parse(raw) as CachedRecord) : (raw as CachedRecord)
  } catch {
    return null
  }
}

async function writeCache(wallet: string, rec: CachedRecord, ttl: number): Promise<void> {
  if (!isRedisConfigured()) return
  try {
    await getRedis().set(cacheKey(wallet), JSON.stringify(rec), { ex: ttl })
  } catch {
    // best-effort
  }
}

function buildResult(wallet: string, rec: CachedRecord, source: FairScore["source"]): FairScore {
  return {
    wallet,
    score: rec.score,
    subOnchain: rec.subOnchain,
    subSocial: rec.subSocial,
    subBehavioral: rec.subBehavioral,
    tier: classifyTier(rec.score),
    lastUpdated: rec.fetchedAt,
    source,
  }
}

function emptyResult(wallet: string, fetchedAt = Math.floor(Date.now() / 1000)): FairScore {
  return {
    wallet,
    score: 0,
    subOnchain: null,
    subSocial: null,
    subBehavioral: null,
    tier: "unrated",
    lastUpdated: fetchedAt,
    source: "miss",
  }
}

/**
 * Fetch a single wallet's FairScale score. Returns cached value when fresh,
 * otherwise calls the upstream API and caches the result. On upstream failure
 * we return the stale cached value if any (fail-open) so the leaderboard is
 * resilient to transient API outages.
 */
export async function getFairScore(wallet: string, opts: { forceRefresh?: boolean } = {}): Promise<FairScore> {
  const cached = await readCache(wallet)
  if (cached && !opts.forceRefresh) {
    return buildResult(wallet, cached, "cache")
  }

  if (!FAIR_KEY) {
    if (cached) return buildResult(wallet, cached, "cache")
    return emptyResult(wallet)
  }

  try {
    const res = await fetch(`${FAIR_BASE}/score/${wallet}`, {
      method: "GET",
      headers: { fairkey: FAIR_KEY, accept: "application/json" },
      cache: "no-store",
    })
    if (res.status === 404) {
      // Wallet not found in FairScale's index. Cache a short negative result
      // so we don't hammer the API for inactive wallets.
      const empty: CachedRecord = {
        score: 0,
        subOnchain: null,
        subSocial: null,
        subBehavioral: null,
        fetchedAt: Math.floor(Date.now() / 1000),
      }
      await writeCache(wallet, empty, FAIR_NEGATIVE_TTL_SECS)
      return buildResult(wallet, empty, "live")
    }
    if (!res.ok) {
      throw new Error(`FairScale ${res.status}`)
    }
    const data = await res.json()
    const sub = data?.sub_scores ?? data?.subScores ?? {}
    const rec: CachedRecord = {
      score: Number(data?.score ?? 0),
      subOnchain: sub?.onchain != null ? Number(sub.onchain) : null,
      subSocial: sub?.social != null ? Number(sub.social) : null,
      subBehavioral: sub?.behavioral != null ? Number(sub.behavioral) : null,
      fetchedAt: Math.floor(Date.now() / 1000),
    }
    await writeCache(wallet, rec, FAIR_TTL_SECS)
    return buildResult(wallet, rec, "live")
  } catch {
    // Fail-open: return last known value if we have one, else an empty result.
    if (cached) return buildResult(wallet, cached, "cache")
    return emptyResult(wallet)
  }
}

/**
 * Fetch many wallets in parallel with a small concurrency cap so we don't
 * blow through the FairScale rate limit on big leaderboards.
 */
export async function getFairScoresBatch(wallets: string[]): Promise<FairScore[]> {
  const unique = Array.from(new Set(wallets))
  const out: FairScore[] = []
  const CONCURRENCY = 5
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const slice = unique.slice(i, i + CONCURRENCY)
    const results = await Promise.all(slice.map((w) => getFairScore(w)))
    out.push(...results)
  }
  return out
}

export const FAIRSCALE_TIER_LABELS: Record<FairTier, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  unrated: "Unrated",
}
