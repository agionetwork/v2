import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { getStealthWalletsForUser } from "@/lib/agent/stealth"

/**
 * Return the stealth wallets that belong to the calling user. The on-chain
 * loans signed by these stealth wallets are private to outside observers but
 * fully visible to the user (and to anyone holding a viewing key).
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

    const stealthPublicKeys = await getStealthWalletsForUser(wallet)
    return NextResponse.json({ success: true, stealthPublicKeys })
  } catch (err: any) {
    console.error("[private-offer/list]", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
