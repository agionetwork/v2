import { NextRequest, NextResponse } from "next/server"

const TAPESTRY_API_URL = process.env.TAPESTRY_API_URL || "https://api.usetapestry.dev/api/v1"
const TAPESTRY_API_KEY = process.env.TAPESTRY_API_KEY || ""
const TAPESTRY_NAMESPACE = "agio"

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const editProfileUrl = `${appUrl}/socialfi/edit-profile`

  try {
    const code = req.nextUrl.searchParams.get("code")
    const stateParam = req.nextUrl.searchParams.get("state")
    const error = req.nextUrl.searchParams.get("error")

    if (error) {
      return NextResponse.redirect(
        `${editProfileUrl}?twitter_error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${editProfileUrl}?twitter_error=missing_params`)
    }

    // Validate state against cookie
    const storedState = req.cookies.get("twitter_oauth_state")?.value
    const codeVerifier = req.cookies.get("twitter_code_verifier")?.value

    if (!storedState || !codeVerifier || storedState !== stateParam) {
      return NextResponse.redirect(`${editProfileUrl}?twitter_error=invalid_state`)
    }

    // Decode state to get wallet
    let wallet: string
    try {
      const decoded = JSON.parse(
        Buffer.from(stateParam, "base64url").toString("utf-8")
      )
      wallet = decoded.wallet
      if (!wallet) throw new Error("No wallet in state")
    } catch {
      return NextResponse.redirect(`${editProfileUrl}?twitter_error=invalid_state`)
    }

    // Exchange code for access token
    const clientId = process.env.TWITTER_CLIENT_ID!
    const clientSecret = process.env.TWITTER_CLIENT_SECRET!
    const redirectUri = `${appUrl}/api/auth/twitter/callback`

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenRes.ok) {
      console.error("Twitter token exchange failed:", tokenRes.status, await tokenRes.text())
      return NextResponse.redirect(`${editProfileUrl}?twitter_error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // Fetch Twitter user info
    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userRes.ok) {
      console.error("Twitter user fetch failed:", userRes.status)
      return NextResponse.redirect(`${editProfileUrl}?twitter_error=user_fetch_failed`)
    }

    const userData = await userRes.json()
    const twitterUsername = userData.data?.username

    if (!twitterUsername) {
      return NextResponse.redirect(`${editProfileUrl}?twitter_error=no_username`)
    }

    // Update Tapestry profile with verified twitter handle
    if (TAPESTRY_API_KEY) {
      try {
        const searchUrl = `${TAPESTRY_API_URL}/profiles/?walletAddress=${wallet}&namespace=${TAPESTRY_NAMESPACE}&pageSize=1&apiKey=${TAPESTRY_API_KEY}`
        const searchRes = await fetch(searchUrl)
        const searchData = await searchRes.json()
        const profiles = searchData.profiles || []

        if (profiles.length > 0) {
          const profileId = profiles[0].profile?.id || profiles[0].id
          if (profileId) {
            const updateUrl = `${TAPESTRY_API_URL}/profiles/${profileId}?apiKey=${TAPESTRY_API_KEY}`
            await fetch(updateUrl, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                properties: [
                  { key: "twitter", value: twitterUsername },
                  { key: "twitterVerified", value: "true" },
                ],
                execution: "FAST_UNCONFIRMED",
              }),
            })
          }
        }
      } catch (err) {
        console.error("Failed to update Tapestry profile:", err)
      }
    }

    // Redirect back with success
    const response = NextResponse.redirect(
      `${editProfileUrl}?twitter_verified=${encodeURIComponent(twitterUsername)}`
    )

    response.cookies.set("twitter_code_verifier", "", { maxAge: 0, path: "/" })
    response.cookies.set("twitter_oauth_state", "", { maxAge: 0, path: "/" })

    return response
  } catch (err) {
    console.error("Twitter OAuth callback error:", err)
    return NextResponse.redirect(`${editProfileUrl}?twitter_error=internal_error`)
  }
}
