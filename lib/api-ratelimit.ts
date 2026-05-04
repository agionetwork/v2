import { Redis } from "@upstash/redis"

let redisClient: Redis | null = null

function getRedis(): Redis | null {
  if (redisClient) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redisClient = new Redis({ url, token })
  return redisClient
}

export interface RateLimitResult {
  /** Maximum requests allowed in the window. */
  limit: number
  /** Requests remaining in the current window. */
  remaining: number
  /** Unix epoch seconds when the current window resets. */
  reset: number
  /** True if the request is over the limit. */
  exceeded: boolean
}

/**
 * Fixed-window per-key rate limit using INCR + EXPIRE on Upstash.
 * Returns headers + decision. Enforcement (returning 429) is the caller's job
 * so this util can be used in advisory mode.
 *
 * If Upstash is not configured, returns a permissive result so dev still works.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis()
  const now = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(now / windowSeconds)
  const reset = (bucket + 1) * windowSeconds

  if (!redis) {
    return { limit, remaining: limit, reset, exceeded: false }
  }

  const redisKey = `ratelimit:${key}:${bucket}`
  try {
    const count = await redis.incr(redisKey)
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds)
    }
    const remaining = Math.max(0, limit - count)
    return { limit, remaining, reset, exceeded: count > limit }
  } catch {
    return { limit, remaining: limit, reset, exceeded: false }
  }
}

/** Standard X-RateLimit-* response headers for a given result. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  }
}

/** Get a stable per-client key from a NextRequest, falling back to "anonymous". */
export function getClientKey(req: Request): string {
  const headers = req.headers
  const xff = headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() || "anonymous"
  const realIp = headers.get("x-real-ip")
  if (realIp) return realIp
  return "anonymous"
}
