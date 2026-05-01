import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
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
    isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`
      : `script-src 'self' 'unsafe-inline' blob:`,
    // Cloak SDK (snarkjs) generates ZK proofs in a Web Worker spawned from a
    // blob URL. Without `worker-src 'self' blob:` the worker is blocked and
    // proof generation hangs around 30%.
    `worker-src 'self' blob:`,
    // Styles need unsafe-inline for shadcn/tailwind inline style injection
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: https:`,
    `connect-src 'self' https://hermes.pyth.network https://api.coingecko.com https://api.devnet.solana.com https://api.mainnet-beta.solana.com https://api.testnet.solana.com https://*.helius-rpc.com wss://*.helius-rpc.com wss://api.devnet.solana.com wss://api.mainnet-beta.solana.com wss://api.testnet.solana.com https://alerts-api.dial.to https://dialectapi.to`,
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
