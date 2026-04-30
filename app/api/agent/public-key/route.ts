import { NextRequest, NextResponse } from "next/server"
import { getAgentPublicKey, isRedisConfigured } from "@/lib/agent/redis"
import { isValidSolanaAddress } from "@/lib/agent/auth"

/**
 * Returns the agent's on-chain public key for a given owner wallet.
 * No auth required — agent public keys are visible on-chain.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ agentPublicKey: null })
  }

  if (!isRedisConfigured()) {
    return NextResponse.json({ agentPublicKey: null })
  }

  const agentPublicKey = await getAgentPublicKey(wallet)
  return NextResponse.json({ agentPublicKey: agentPublicKey || null })
}
