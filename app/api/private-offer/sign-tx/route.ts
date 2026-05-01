import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { signAndSendWithStealth, getStealthOwner } from "@/lib/agent/stealth"

/**
 * Sign and broadcast an Anchor tx (createLendOffer / createBorrowRequest)
 * with the user's stealth wallet. The client builds the unsigned tx using
 * the stealth pubkey as the signer; we sign + broadcast via Privy.
 *
 * Auth: signature proves the caller owns `wallet`. Server then verifies that
 * `stealthPublicKey` belongs to that user before signing.
 */
export async function POST(req: NextRequest) {
  try {
    const { wallet, signature, message, stealthPublicKey, serializedTx } = await req.json()
    if (!wallet || !signature || !message || !stealthPublicKey || !serializedTx) {
      return NextResponse.json(
        { error: "Missing wallet, signature, message, stealthPublicKey, or serializedTx" },
        { status: 400 },
      )
    }
    if (!verifyWalletSignature(wallet, signature, message)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const owner = await getStealthOwner(stealthPublicKey)
    if (owner !== wallet) {
      return NextResponse.json(
        { error: "Stealth wallet does not belong to caller" },
        { status: 403 },
      )
    }

    const txHash = await signAndSendWithStealth(stealthPublicKey, serializedTx)
    return NextResponse.json({ success: true, txHash })
  } catch (err: any) {
    console.error("[private-offer/sign-tx]", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
