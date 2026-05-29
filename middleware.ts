import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, rateLimitHeaders, getClientKey } from '@/lib/api-ratelimit'

const API_RATE_LIMIT = 60
const API_RATE_WINDOW_SECONDS = 60
const RATE_LIMIT_ENFORCE = process.env.RATE_LIMIT_ENFORCE === 'true'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Apply rate-limit headers to public REST API routes (not MCP — it has its
  // own per-wallet limiter via x402-verify, not Actions — those are signed,
  // not /api/admin and /api/cron — server-only).
  if (
    path.startsWith('/api/') &&
    !path.startsWith('/api/mcp') &&
    !path.startsWith('/api/actions') &&
    !path.startsWith('/api/admin') &&
    !path.startsWith('/api/cron')
  ) {
    const clientKey = getClientKey(request)
    const result = await rateLimit(`api:${clientKey}`, API_RATE_LIMIT, API_RATE_WINDOW_SECONDS)
    const headers = rateLimitHeaders(result)

    if (result.exceeded && RATE_LIMIT_ENFORCE) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.', retryAfter: result.reset },
        {
          status: 429,
          headers: { ...headers, 'Retry-After': String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))) },
        },
      )
    }

    const apiResponse = NextResponse.next()
    Object.entries(headers).forEach(([k, v]) => apiResponse.headers.set(k, v))
    return apiResponse
  }

  // Skip CSP for MCP endpoint (JSON-RPC, not browser requests)
  if (
    request.nextUrl.pathname.startsWith('/api/mcp') ||
    request.nextUrl.pathname.startsWith('/api/actions')
  ) {
    return NextResponse.next()
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const isDev = process.env.NODE_ENV === 'development'

  // Build CSP directives
  const cspDirectives = [
    `default-src 'self'`,
    // unsafe-inline required: Next.js RSC emits inline scripts (self.__next_f.push)
    // that cannot carry nonce attributes. Without unsafe-inline they are blocked by CSP.
    // Cloak's snarkjs uses BOTH WebAssembly.compile() (needs 'wasm-unsafe-eval')
    // AND `new Function()` for runtime witness generation (needs 'unsafe-eval').
    // Without 'unsafe-eval' in prod, snarkjs throws CSP errors mid-proof.
    // chrome-extension: / moz-extension: needed so wallet extensions
    // (Phantom, Solflare, Backpack, …) can inject their inpage scripts
    // and resources. Without these, the extension's content script may
    // fail to load its inpage bundle, leaving window.solana etc unset
    // and the wallet "undetected" even though it's installed.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: chrome-extension: moz-extension:`,
    // Cloak SDK (snarkjs) generates ZK proofs in a Web Worker spawned from a
    // blob URL. Without `worker-src 'self' blob:` the worker is blocked and
    // proof generation hangs around 30%.
    `worker-src 'self' blob:`,
    // Styles need unsafe-inline for shadcn/tailwind inline style injection
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: https: chrome-extension: moz-extension:`,
    `connect-src 'self' chrome-extension: moz-extension: https://hermes.pyth.network https://api.coingecko.com https://api.devnet.solana.com https://api.mainnet-beta.solana.com https://api.testnet.solana.com https://*.helius-rpc.com wss://*.helius-rpc.com wss://api.devnet.solana.com wss://api.mainnet-beta.solana.com wss://api.testnet.solana.com https://alerts-api.dial.to https://dialectapi.to`,
    `font-src 'self' https://fonts.gstatic.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ]

  const cspHeader = cspDirectives.join('; ')

  // Store nonce in request header so layout.tsx can read it
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  response.headers.set('Content-Security-Policy', cspHeader)

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
