import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { getAgentConfig, getAgentPublicKey } from "@/lib/agent/redis"
import { executeAgentCycle } from "@/lib/agent/executor"

export async function POST(req: NextRequest) {
  try {
    const { wallet, signature, message } = await req.json()

    if (!wallet || !signature || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!verifyWalletSignature(wallet, signature, message)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const config = await getAgentConfig(wallet)
    if (!config || !config.enabled) {
      return NextResponse.json({ error: "Agent not active" }, { status: 400 })
    }

    const agentPubkey = await getAgentPublicKey(wallet)
    if (!agentPubkey) {
      return NextResponse.json({ error: "Agent wallet not found" }, { status: 404 })
    }

    await executeAgentCycle(wallet)

    return NextResponse.json({ success: true, message: "Agent cycle executed" })
  } catch (err: any) {
    console.error("Agent run error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
