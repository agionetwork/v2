import { NextRequest, NextResponse } from "next/server"
import { isValidSolanaAddress, verifyWalletSignature } from "@/lib/agent/auth"
import { getStealthWalletsForUser } from "@/lib/agent/stealth"
import { generateViewingKey } from "@/lib/cloak/client"
import { isRedisConfigured } from "@/lib/agent/redis"

export const dynamic = "force-dynamic"

interface Body {
  /** Owner wallet that controls the stealth set. */
  wallet?: string
  /**
   * Disclosure scope:
   *   "all"             — every stealth bound to this owner
   *   "<stealthPubkey>" — a single stealth wallet
   */
  scope?: string
  /** Optional expiry, in days. Default 30. Max 365. */
  expiresInDays?: number
  /** Wallet signature over `message` proving ownership of `wallet`. */
  signature?: string
  /** The signed message — must be `agio-compliance:{wallet}`. */
  message?: string
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const wallet = body.wallet
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: "wallet is required and must be a valid Solana address." },
      { status: 400 },
    )
  }

  // Auth gate: the caller must prove they control `wallet` before we mint
  // a viewing key over its stealth set. Without this, any client could
  // request keys decrypting any other user's private loan history.
  const { signature, message } = body
  if (!signature || !message) {
    return NextResponse.json(
      { error: "Missing wallet signature. Sign agio-compliance:<wallet> and pass signature + message." },
      { status: 401 },
    )
  }
  if (message !== `agio-compliance:${wallet}`) {
    return NextResponse.json(
      { error: "Signed message must be exactly agio-compliance:<wallet>." },
      { status: 400 },
    )
  }
  if (!verifyWalletSignature(wallet, signature, message)) {
    return NextResponse.json(
      { error: "Signature does not verify against wallet." },
      { status: 401 },
    )
  }

  if (!isRedisConfigured()) {
    return NextResponse.json(
      { error: "Redis is not configured on the server." },
      { status: 503 },
    )
  }

  const stealthSet = await getStealthWalletsForUser(wallet)
  if (stealthSet.length === 0) {
    return NextResponse.json(
      { error: "No stealth wallets found for this owner. Create a private offer first." },
      { status: 404 },
    )
  }

  const requested = body.scope || "all"
  if (requested !== "all" && !stealthSet.includes(requested)) {
    return NextResponse.json(
      { error: "Requested scope is not one of your stealth wallets." },
      { status: 403 },
    )
  }

  const days = Math.min(365, Math.max(1, Math.floor(body.expiresInDays ?? 30)))
  const expiresAt = Math.floor(Date.now() / 1000) + days * 86400

  try {
    const vk = await generateViewingKey(requested, expiresAt)
    return NextResponse.json({
      success: true,
      scope: requested,
      key: vk.key,
      expiresAt: vk.expiresAt,
      stealthCount: requested === "all" ? stealthSet.length : 1,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Viewing-key generation failed: ${msg}` }, { status: 500 })
  }
}
