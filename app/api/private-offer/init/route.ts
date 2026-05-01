import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { createStealthWallet } from "@/lib/agent/stealth"

/**
 * Mint a fresh stealth wallet for a user. Returns the stealth pubkey so the
 * client can fund it via the Cloak shield→unshield round-trip and use it as
 * the lender/borrower in the subsequent createLendOffer / createBorrowRequest.
 *
 * Auth: signature on `Initialize private offer for {wallet}` proves the
 * caller controls `wallet`.
 */
export async function POST(req: NextRequest) {
  try {
    const { wallet, signature, message } = await req.json()
    if (!wallet || !signature || !message) {
      return NextResponse.json(
        { error: "Missing wallet, signature, or message" },
        { status: 400 },
      )
    }
    if (!verifyWalletSignature(wallet, signature, message)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const ref = await createStealthWallet(wallet)
    return NextResponse.json({
      success: true,
      stealthPublicKey: ref.publicKey,
    })
  } catch (err: any) {
    console.error("[private-offer/init]", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
