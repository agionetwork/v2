import { NextRequest, NextResponse } from "next/server"
import { getOwnerByAgentPublicKey, isRedisConfigured } from "@/lib/agent/redis"

/**
 * Batch resolve agent wallets → owner wallets.
 * POST { wallets: string[] }
 * Returns { mapping: Record<string, string | null> }
 */
export async function POST(req: NextRequest) {
  if (!isRedisConfigured()) {
    return NextResponse.json({ mapping: {} })
  }

  try {
    const { wallets } = await req.json()

    if (!Array.isArray(wallets) || wallets.length === 0) {
      return NextResponse.json({ mapping: {} })
    }

    // Cap at 100 to prevent abuse
    const capped = wallets.slice(0, 100)

    const results = await Promise.allSettled(
      capped.map((w: string) =>
        getOwnerByAgentPublicKey(w).then((owner) => ({ wallet: w, owner }))
      )
    )

    const mapping: Record<string, string | null> = {}
    for (const r of results) {
      if (r.status === "fulfilled") {
        mapping[r.value.wallet] = r.value.owner
      }
    }

    return NextResponse.json({ mapping })
  } catch {
    return NextResponse.json({ mapping: {} })
  }
}
