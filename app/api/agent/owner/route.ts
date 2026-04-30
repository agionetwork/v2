import { NextRequest, NextResponse } from "next/server"
import { getOwnerByAgentPublicKey, isRedisConfigured } from "@/lib/agent/redis"
import { isValidSolanaAddress } from "@/lib/agent/auth"

/**
 * Reverse lookup: given an agent's on-chain public key, returns the owner wallet.
 * No auth required — used by the UI to resolve agent wallets to profile names.
 */
export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get("agent")
  if (!agent || !isValidSolanaAddress(agent)) {
    return NextResponse.json({ ownerWallet: null })
  }

  if (!isRedisConfigured()) {
    return NextResponse.json({ ownerWallet: null })
  }

  const ownerWallet = await getOwnerByAgentPublicKey(agent)
  return NextResponse.json({ ownerWallet: ownerWallet || null })
}
