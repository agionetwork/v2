import { NextRequest, NextResponse } from "next/server"
import { getAgentConfig } from "@/lib/agent/redis"
import { executeAgentCycle } from "@/lib/agent/executor"

export async function POST(req: NextRequest) {
  try {
    const { wallet } = await req.json()

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 })
    }

    const config = await getAgentConfig(wallet)
    if (!config || !config.enabled) {
      return NextResponse.json({ error: "Agent not active" }, { status: 400 })
    }

    await executeAgentCycle(wallet)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Agent cycle error:", message, err)
    return NextResponse.json({ error: message || "Internal error" }, { status: 500 })
  }
}
