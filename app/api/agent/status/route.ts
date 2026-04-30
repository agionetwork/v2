import { NextRequest, NextResponse } from "next/server"
import { Connection, PublicKey } from "@solana/web3.js"
import { getAssociatedTokenAddressSync } from "@solana/spl-token"
import { getAgentConfig, getAgentPublicKey, isRedisConfigured } from "@/lib/agent/redis"
import { verifyWalletSignature, isValidSolanaAddress } from "@/lib/agent/auth"
import { SOLANA_CONFIG } from "@/config/solana"
import { TOKEN_MINTS } from "@/lib/token-mints"

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

  if (!isRedisConfigured()) {
    return NextResponse.json({ error: "Agent services not configured" }, { status: 404 })
  }

  const [config, agentPubkey] = await Promise.all([
    getAgentConfig(wallet),
    getAgentPublicKey(wallet),
  ])

  if (!config || !agentPubkey) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  // Fetch balances
  const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")
  const agentPk = new PublicKey(agentPubkey)

  const balances: Record<string, number> = { SOL: 0, USDC: 0, EURC: 0 }

  try {
    const solBalance = await connection.getBalance(agentPk)
    balances.SOL = solBalance / 1e9

    for (const symbol of ["USDC", "EURC"] as const) {
      try {
        const mint = TOKEN_MINTS[symbol]
        const ata = getAssociatedTokenAddressSync(mint, agentPk)
        const tokenBalance = await connection.getTokenAccountBalance(ata)
        balances[symbol] = tokenBalance.value.uiAmount || 0
      } catch {
        // ATA doesn't exist = 0 balance
      }
    }
  } catch (err) {
    console.error("Balance fetch error:", err)
  }

  return NextResponse.json({
    config,
    agentPublicKey: agentPubkey,
    balances,
  })
}
