import { NextRequest, NextResponse } from "next/server"
import { PYTH_FEED_IDS } from "@/lib/token-prices"

const HERMES_BASE_URL = "https://hermes.pyth.network"

/**
 * GET /api/prices/data?debtToken=USDC&collateralToken=SOL
 *
 * Lightweight proxy that fetches binary price update data from Pyth Hermes.
 * Returns raw base64-encoded data for client-side instruction building.
 * No on-chain transaction — no bot keypair needed.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const debtToken = searchParams.get("debtToken")
  const collateralToken = searchParams.get("collateralToken")

  if (!debtToken || !collateralToken) {
    return NextResponse.json(
      { error: "debtToken and collateralToken query params required" },
      { status: 400 },
    )
  }

  const collateralFeedId = PYTH_FEED_IDS[collateralToken]
  const debtFeedId = PYTH_FEED_IDS[debtToken]
  if (!collateralFeedId || !debtFeedId) {
    return NextResponse.json(
      { error: `No Pyth feed ID for ${!collateralFeedId ? collateralToken : debtToken}` },
      { status: 400 },
    )
  }

  try {
    const feedIds = [...new Set([collateralFeedId, debtFeedId])]
    const idsParam = feedIds.map((id) => `ids[]=0x${id}`).join("&")
    const url = `${HERMES_BASE_URL}/v2/updates/price/latest?${idsParam}&encoding=base64`

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Hermes API error: ${res.status}` },
        { status: 502 },
      )
    }

    const hermes = await res.json()
    const data: string[] = hermes.binary?.data || []
    if (!data.length) {
      return NextResponse.json(
        { error: "Empty Hermes response — no price updates available" },
        { status: 502 },
      )
    }

    return NextResponse.json({
      data,
      feedIds: {
        collateral: collateralFeedId,
        debt: debtFeedId,
      },
    })
  } catch (error: any) {
    console.error("GET /api/prices/data error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch price data" },
      { status: 500 },
    )
  }
}
