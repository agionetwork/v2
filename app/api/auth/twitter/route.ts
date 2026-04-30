import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

function base64url(buffer: Buffer): string {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 })
  }

  const clientId = process.env.TWITTER_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "Twitter OAuth not configured" }, { status: 503 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const redirectUri = `${appUrl}/api/auth/twitter/callback`

  // PKCE parameters
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  )

  // State embeds wallet address for callback
  const statePayload = JSON.stringify({ wallet, nonce: crypto.randomUUID() })
  const state = base64url(Buffer.from(statePayload))

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read users.read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`

  const response = NextResponse.json({ url: authUrl })

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  }

  response.cookies.set("twitter_code_verifier", codeVerifier, cookieOptions)
  response.cookies.set("twitter_oauth_state", state, cookieOptions)

  return response
}
