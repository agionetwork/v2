import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { getActiveAgents } from "@/lib/agent/redis"
import { executeAgentCycle } from "@/lib/agent/executor"

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
})

export async function POST(req: NextRequest) {
  // Verify QStash signature
  try {
    const body = await req.text()
    const signature = req.headers.get("upstash-signature") || ""

    const isValid = await receiver.verify({
      body,
      signature,
      url: req.url,
    })

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  } catch {
    // Allow local dev without QStash
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 })
    }
  }

  const startTime = Date.now()
  const MAX_RUNTIME_MS = 50_000 // 50s guard (Vercel limit = 60s)

  try {
    const activeWallets = await getActiveAgents()

    if (activeWallets.length === 0) {
      return NextResponse.json({ message: "No active agents", processed: 0 })
    }

    let processed = 0
    const errors: string[] = []

    // Process agents sequentially to avoid RPC rate limits
    for (const userWallet of activeWallets) {
      // Time guard
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        break
      }

      try {
        await executeAgentCycle(userWallet)
        processed++
      } catch (err: any) {
        errors.push(`${userWallet}: ${err.message}`)
        console.error(`Agent cycle error for ${userWallet}:`, err)
      }
    }

    return NextResponse.json({
      message: "Cron completed",
      processed,
      total: activeWallets.length,
      errors: errors.length > 0 ? errors : undefined,
      durationMs: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error("Cron job error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
