// Server-side token price fetching (no React dependencies)
// Shared logic used by both hooks/useTokenPrices.ts (client) and lib/agent/executor.ts (server)

export const PYTH_FEED_IDS: Record<string, string> = {
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  USDC: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  EURC: "76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c",
}

const HERMES_BASE_URL = "https://hermes.pyth.network"

const COINGECKO_IDS: Record<string, string> = {
  SOL: "solana",
  USDC: "usd-coin",
  EURC: "euro-coin",
}

const MOCK_PRICES: Record<string, number> = {
  SOL: 80.0,
  USDC: 1.0,
  EURC: 1.08,
}

async function fetchPythPrices(): Promise<Record<string, number> | null> {
  try {
    const idsParam = Object.values(PYTH_FEED_IDS)
      .map((id) => `ids[]=0x${id}`)
      .join("&")
    const url = `${HERMES_BASE_URL}/v2/updates/price/latest?${idsParam}&parsed=true`

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(`Hermes API error: ${response.status}`)

    const data = await response.json()
    const parsed: Array<{ id: string; price: { price: string; expo: number } }> = data.parsed

    if (!parsed || parsed.length === 0) throw new Error("No parsed prices returned")

    const idToSymbol: Record<string, string> = {}
    for (const [symbol, feedId] of Object.entries(PYTH_FEED_IDS)) {
      idToSymbol[feedId] = symbol
    }

    const prices: Record<string, number> = {}
    for (const feed of parsed) {
      const symbol = idToSymbol[feed.id]
      if (!symbol) continue
      const rawPrice = parseInt(feed.price.price, 10)
      const expo = feed.price.expo
      prices[symbol] = Math.round(rawPrice * Math.pow(10, expo) * 10000) / 10000
    }

    return Object.keys(prices).length > 0 ? prices : null
  } catch (err) {
    console.warn("Pyth Network failed:", err)
    return null
  }
}

async function fetchCoinGeckoPrices(): Promise<Record<string, number> | null> {
  try {
    const tokenIds = Object.values(COINGECKO_IDS).join(",")
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)

    const data = await response.json()
    return {
      SOL: data.solana?.usd || 80.0,
      USDC: data["usd-coin"]?.usd || 1.0,
      EURC: data["euro-coin"]?.usd || 1.08,
    }
  } catch (err) {
    console.warn("CoinGecko API failed:", err)
    return null
  }
}

/**
 * Fetch token prices from Pyth → CoinGecko → mock fallback.
 * Returns a simple { SOL: number, USDC: number, EURC: number } map.
 */
export async function fetchTokenPrices(): Promise<Record<string, number>> {
  const pyth = await fetchPythPrices()
  if (pyth) return pyth

  const cg = await fetchCoinGeckoPrices()
  if (cg) return cg

  return { ...MOCK_PRICES }
}
