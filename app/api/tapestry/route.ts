import { NextRequest, NextResponse } from "next/server"

const TAPESTRY_API_URL = process.env.TAPESTRY_API_URL || "https://api.usetapestry.dev/api/v1"
const TAPESTRY_API_KEY = process.env.TAPESTRY_API_KEY || ""

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"])
const ALLOWED_PATH_PREFIXES = ["/profiles", "/contents", "/followers", "/search", "/likes"]

export async function GET() {
  return NextResponse.json({ configured: !!TAPESTRY_API_KEY })
}

export async function POST(req: NextRequest) {
  if (!TAPESTRY_API_KEY) {
    return NextResponse.json({ error: "Tapestry not configured" }, { status: 503 })
  }

  try {
    const { path, method, body } = await req.json()

    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const normalizedMethod = (method || "GET").toUpperCase()
    if (!ALLOWED_METHODS.has(normalizedMethod)) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
    }

    const pathWithoutQuery = path.split("?")[0]
    if (!ALLOWED_PATH_PREFIXES.some((p) => pathWithoutQuery.startsWith(p))) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 403 })
    }

    const separator = path.includes("?") ? "&" : "?"
    const url = `${TAPESTRY_API_URL}${path}${separator}apiKey=${TAPESTRY_API_KEY}`

    const res = await fetch(url, {
      method: normalizedMethod,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      // Log the upstream payload so the dev terminal shows what
      // Tapestry actually rejected, rather than a silent 500.
      console.warn(
        "[tapestry-proxy] upstream returned",
        res.status,
        path,
        data,
      )
      return NextResponse.json(
        { error: "Tapestry API error", status: res.status, upstream: data ?? null },
        { status: res.status },
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    // Network errors (DNS, connection refused, timeout, …) end up here.
    // Surface them in the response and the dev terminal so a misconfigured
    // TAPESTRY_API_URL or an upstream outage isn't swallowed as a bare 500.
    const message = err instanceof Error ? err.message : String(err)
    console.error("[tapestry-proxy] network/parse failure:", message)
    return NextResponse.json(
      { error: "Tapestry proxy failed", detail: message },
      { status: 502 },
    )
  }
}
