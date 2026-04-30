import { NextRequest, NextResponse } from "next/server"
import { getAgentHistory } from "@/lib/agent/redis"
import { verifyWalletSignature, isValidSolanaAddress } from "@/lib/agent/auth"

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet param" }, { status: 400 })
  }
  if (!isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
  }

  const signature = req.nextUrl.searchParams.get("signature")
  const message = req.nextUrl.searchParams.get("message")
  if (!signature || !message) {
    return NextResponse.json({ error: "Missing auth params" }, { status: 400 })
  }
  if (message !== `agio-auth:${wallet}`) {
    return NextResponse.json({ error: "Invalid auth message" }, { status: 400 })
  }
  if (!verifyWalletSignature(wallet, signature, message)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get("pageSize") || "20", 10)

  const { actions, total } = await getAgentHistory(wallet, page, pageSize)

  return NextResponse.json({ actions, total, page, pageSize })
}
