import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { hasAgent, createDefaultConfig } from "@/lib/agent/redis"
import { createAgentWallet } from "@/lib/agent/privy"

export async function POST(req: NextRequest) {
  try {
    const { wallet, signature, message } = await req.json()

    if (!wallet || !signature || !message) {
      return NextResponse.json({ error: "Missing wallet, signature, or message" }, { status: 400 })
    }

    if (!verifyWalletSignature(wallet, signature, message)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    if (await hasAgent(wallet)) {
      return NextResponse.json({ error: "Agent already exists for this wallet" }, { status: 409 })
    }

    const { publicKey } = await createAgentWallet(wallet)
    await createDefaultConfig(wallet)

    return NextResponse.json({ success: true, agentPublicKey: publicKey })
  } catch (err: any) {
    console.error("Agent create error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
