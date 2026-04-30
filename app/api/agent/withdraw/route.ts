import { NextRequest, NextResponse } from "next/server"
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { getAgentPublicKey } from "@/lib/agent/redis"
import { signAndSendTransaction } from "@/lib/agent/privy"
import { SOLANA_CONFIG } from "@/config/solana"
import { TOKEN_MINTS, TOKEN_DECIMALS, resolveTokenProgram } from "@/lib/token-mints"

export async function POST(req: NextRequest) {
  try {
    const { wallet, signature, message, token, amount } = await req.json()

    if (!wallet || !signature || !message || !token || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!verifyWalletSignature(wallet, signature, message)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const agentPubkey = await getAgentPublicKey(wallet)
    if (!agentPubkey) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    // Security: withdrawals always go back to the owner's wallet
    const destination = wallet

    const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")
    const agentPk = new PublicKey(agentPubkey)
    const destPk = new PublicKey(destination)

    const tx = new Transaction()
    const { blockhash } = await connection.getLatestBlockhash("confirmed")
    tx.recentBlockhash = blockhash
    tx.feePayer = agentPk

    if (token === "SOL") {
      const lamports = Math.round(amount * 1e9)
      tx.add(
        SystemProgram.transfer({
          fromPubkey: agentPk,
          toPubkey: destPk,
          lamports,
        }),
      )
    } else {
      const mint = TOKEN_MINTS[token]
      if (!mint) {
        return NextResponse.json({ error: `Unknown token: ${token}` }, { status: 400 })
      }

      const decimals = TOKEN_DECIMALS[token] || 6
      const rawAmount = Math.round(amount * 10 ** decimals)

      // Resolve token program from on-chain mint (handles Token-2022 like EURC)
      const tokProg = await resolveTokenProgram(connection, mint)
      const sourceAta = getAssociatedTokenAddressSync(mint, agentPk, false, tokProg)
      const destAta = getAssociatedTokenAddressSync(mint, destPk, false, tokProg)

      // Ensure destination ATA exists
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(agentPk, destAta, destPk, mint, tokProg),
      )
      tx.add(
        createTransferInstruction(sourceAta, destAta, agentPk, rawAmount, [], tokProg),
      )
    }

    const serialized = tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64")

    const txHash = await signAndSendTransaction(wallet, serialized)

    return NextResponse.json({ success: true, txHash })
  } catch (err: any) {
    console.error("Agent withdraw error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
