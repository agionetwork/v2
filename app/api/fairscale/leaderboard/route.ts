import { NextRequest, NextResponse } from "next/server"
import { isValidSolanaAddress } from "@/lib/agent/auth"
import { getFairScoresBatch, type FairScore } from "@/lib/fairscale"

export const dynamic = "force-dynamic"

/**
 * Score a list of wallets in batch and return them sorted by FairScale score
 * descending. Used by the leaderboard page so the heavy fan-out happens once
 * on the server instead of N round-trips from the browser.
 *
 * Two query shapes (POST is preferred for long lists; GET stays for tooling):
 *
 *   GET  /api/fairscale/leaderboard?wallets=A,B,C
 *   POST /api/fairscale/leaderboard   { wallets: ["A", "B", "C"] }
 */
export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("wallets")
  const wallets = (param || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
  return handle(wallets)
}

export async function POST(req: NextRequest) {
  let body: { wallets?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const wallets = Array.isArray(body.wallets) ? body.wallets.map(String) : []
  return handle(wallets)
}

async function handle(walletsRaw: string[]) {
  const wallets = walletsRaw.filter(isValidSolanaAddress)
  if (wallets.length === 0) {
    return NextResponse.json({ scores: [] })
  }
  const scores = await getFairScoresBatch(wallets)
  scores.sort((a: FairScore, b: FairScore) => b.score - a.score)
  return NextResponse.json({ scores })
}
