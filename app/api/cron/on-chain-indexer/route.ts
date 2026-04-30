import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { runIndexer } from "@/lib/indexer"
import { isRedisConfigured } from "@/lib/agent/redis"

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

  if (!isRedisConfigured()) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 503 })
  }

  const startTime = Date.now()
  const MAX_RUNTIME_MS = 50_000 // 50s guard (Vercel limit = 60s)

  try {
    const result = await runIndexer(startTime, MAX_RUNTIME_MS)

    return NextResponse.json({
      message: "On-chain indexer completed",
      ...result,
    })
  } catch (err: any) {
    console.error("On-chain indexer error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
