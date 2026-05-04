import { NextRequest, NextResponse } from "next/server"
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { isValidSolanaAddress } from "@/lib/agent/auth"

export const dynamic = "force-dynamic"

function isDevnet(): boolean {
  return (
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet") ||
    false
  )
}

export async function POST(req: NextRequest) {
  if (!isDevnet()) {
    return NextResponse.json(
      { error: "Faucet is only available on devnet." },
      { status: 400 },
    )
  }

  let body: { wallet?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const wallet = body.wallet
  const type = body.type

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: "wallet is required and must be a valid Solana address." },
      { status: 400 },
    )
  }

  if (type !== "sol" && type !== "tokens") {
    return NextResponse.json(
      { error: "type must be 'sol' or 'tokens'." },
      { status: 400 },
    )
  }

  if (type === "sol") {
    try {
      const conn = new Connection("https://api.devnet.solana.com", "confirmed")
      const pk = new PublicKey(wallet)
      const sig = await conn.requestAirdrop(pk, 1 * LAMPORTS_PER_SOL)
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed")
      await conn.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed",
      )
      return NextResponse.json({ success: true, type: "sol", amount: 1, signature: sig })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const rateLimited =
        msg.includes("429") || msg.toLowerCase().includes("rate") || msg.includes("Too Many")
      return NextResponse.json(
        {
          error: rateLimited
            ? "Public devnet airdrop is rate-limited. Try faucet.solana.com or wait a minute."
            : `Airdrop failed: ${msg}`,
        },
        { status: rateLimited ? 429 : 500 },
      )
    }
  }

  // type === "tokens" — Circle faucet for USDC + EURC
  const circleApiKey = process.env.CIRCLE_API_KEY
  if (!circleApiKey) {
    return NextResponse.json(
      {
        error:
          "USDC/EURC faucet not configured. Use faucet.circle.com directly to request tokens for your wallet.",
        externalUrl: "https://faucet.circle.com",
      },
      { status: 503 },
    )
  }

  try {
    const res = await fetch("https://api.circle.com/v1/faucet/drips", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${circleApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: wallet,
        blockchain: "SOL-DEVNET",
        native: false,
        usdc: true,
        eurc: true,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Circle faucet rejected the request (HTTP ${res.status}): ${text}` },
        { status: res.status === 429 ? 429 : 502 },
      )
    }

    return NextResponse.json({ success: true, type: "tokens", received: ["USDC", "EURC"] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Faucet request failed: ${msg}` }, { status: 502 })
  }
}
