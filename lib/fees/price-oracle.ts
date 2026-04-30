/**
 * Token → USD price oracle for fee calculation.
 *
 * Stablecoins (USDC, EURC) are 1:1.
 * SOL uses Jupiter Price API with an in-memory cache (5min TTL).
 * Devnet uses a hardcoded fallback since price APIs may not work.
 */

const SOL_PRICE_CACHE: { price: number; fetchedAt: number } = {
  price: 150, // Reasonable fallback
  fetchedAt: 0,
}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get the USD price of a token.
 */
export async function getTokenPriceUsd(
  token: 'USDC' | 'EURC' | 'SOL' | string,
): Promise<number> {
  const upper = token.toUpperCase()

  // Stablecoins are always ~$1
  if (upper === 'USDC' || upper === 'EURC') return 1.0

  if (upper === 'SOL') {
    return getSolPriceUsd()
  }

  // Unknown tokens: can't price, return 0 (caller should handle)
  return 0
}

/**
 * Convert a token amount to USD.
 */
export async function convertToUsd(
  amount: number,
  token: 'USDC' | 'EURC' | 'SOL' | string,
): Promise<number> {
  const price = await getTokenPriceUsd(token)
  return amount * price
}

/**
 * Fetch SOL price from Jupiter Price API with caching.
 */
async function getSolPriceUsd(): Promise<number> {
  const now = Date.now()
  if (now - SOL_PRICE_CACHE.fetchedAt < CACHE_TTL_MS) {
    return SOL_PRICE_CACHE.price
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const resp = await fetch(
      'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112',
      { signal: controller.signal },
    )
    clearTimeout(timeout)

    if (resp.ok) {
      const data = await resp.json()
      const price = Number(
        data?.data?.['So11111111111111111111111111111111111111112']?.price,
      )
      if (price > 0) {
        SOL_PRICE_CACHE.price = price
        SOL_PRICE_CACHE.fetchedAt = now
        return price
      }
    }
  } catch {
    // Fall through to cached/fallback
  }

  // Return stale cache or fallback
  return SOL_PRICE_CACHE.price
}
