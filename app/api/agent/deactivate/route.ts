import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { getAgentConfig, setAgentConfig, removeActiveAgent } from "@/lib/agent/redis"

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
    if (!config) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    config.enabled = false
    await setAgentConfig(wallet, config)
    await removeActiveAgent(wallet)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Agent deactivate error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
