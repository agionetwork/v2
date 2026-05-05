import { NextRequest, NextResponse } from "next/server"
import { isValidSolanaAddress } from "@/lib/agent/auth"
import { getFairScore } from "@/lib/fairscale"

export const dynamic = "force-dynamic"

/**
 * GET /api/fairscale/score?wallet={pubkey}[&refresh=1]
 *
 * Returns the FairScale reputation score for a single wallet, with sub-scores
 * and a tier label. Cached server-side. Pass refresh=1 to skip cache.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")
  const refresh = req.nextUrl.searchParams.get("refresh") === "1"

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: "wallet query param is required and must be a valid Solana address." },
      { status: 400 },
    )
  }

  try {
    const score = await getFairScore(wallet, { forceRefresh: refresh })
    return NextResponse.json(score)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
