import { NextRequest, NextResponse } from "next/server"
import { Keypair } from "@solana/web3.js"
import { createConnection } from "@/lib/program"
import { postPriceUpdatesForMints } from "@/lib/pyth-poster"
import { PYTH_FEED_IDS } from "@/lib/token-prices"

/**
 * POST /api/prices/post
 * Posts Pyth oracle price updates on-chain for a token pair.
 * Returns the ephemeral PriceUpdateV2 account addresses.
 * Schedules cleanup (rent reclaim) after 60 seconds.
 *
 * Body: { debtToken: string, collateralToken: string }
 * Response: { collateralPriceUpdate: string, debtPriceUpdate: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { debtToken, collateralToken } = await req.json()

    if (!debtToken || !collateralToken) {
      return NextResponse.json(
        { error: "debtToken and collateralToken are required" },
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

    const raw = process.env.FORECLOSURE_BOT_KEYPAIR
    if (!raw) {
      return NextResponse.json(
        { error: "Server not configured for price posting" },
        { status: 500 },
      )
    }
    const botKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))

    const connection = createConnection()
    const feedIds = [...new Set([collateralFeedId, debtFeedId])]

    const { priceUpdateAccounts, cleanup } = await postPriceUpdatesForMints(
      connection,
      botKeypair,
      feedIds,
    )

    const collateralPriceUpdate = priceUpdateAccounts[collateralFeedId]
    const debtPriceUpdate = priceUpdateAccounts[debtFeedId]

    if (!collateralPriceUpdate || !debtPriceUpdate) {
      cleanup().catch(() => {})
      return NextResponse.json(
        { error: "Failed to post one or more price updates" },
        { status: 500 },
      )
    }

    // Schedule cleanup after 60s — enough time for client to sign + send
    setTimeout(() => { cleanup().catch(() => {}) }, 60_000)

    return NextResponse.json({
      collateralPriceUpdate: collateralPriceUpdate.toBase58(),
      debtPriceUpdate: debtPriceUpdate.toBase58(),
    })
  } catch (error: any) {
    console.error("POST /api/prices/post error:", error)
    return NextResponse.json(
      { error: error.message || "Price posting failed" },
      { status: 500 },
    )
  }
}
