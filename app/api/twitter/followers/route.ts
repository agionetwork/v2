import { NextResponse } from "next/server"

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || ""
const TWITTER_USERNAME = "agio_network"
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

let cachedCount: number | null = null
let cachedAt = 0

export async function GET() {
  if (!TWITTER_BEARER_TOKEN) {
    return NextResponse.json({ followers: null, error: "Twitter API not configured" })
  }

  // Return cached value if fresh
  if (cachedCount !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ followers: cachedCount, cached: true })
  }

  try {
    const res = await fetch(
      `https://api.x.com/2/users/by/username/${TWITTER_USERNAME}?user.fields=public_metrics`,
      {
        headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
        next: { revalidate: 600 },
      }
    )

    if (!res.ok) {
      const text = await res.text()
      console.error("Twitter API error:", res.status, text)
      return NextResponse.json({ followers: cachedCount, error: `Twitter API ${res.status}` })
    }

    const data = await res.json()
    const followers = data?.data?.public_metrics?.followers_count

    if (typeof followers === "number") {
      cachedCount = followers
      cachedAt = Date.now()
      return NextResponse.json({ followers })
    }

    return NextResponse.json({ followers: cachedCount, error: "Unexpected response format" })
  } catch (err: any) {
    console.error("Twitter followers fetch error:", err.message)
    return NextResponse.json({ followers: cachedCount, error: err.message })
  }
}
