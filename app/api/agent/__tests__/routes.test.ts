import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock Redis
vi.mock("@/lib/agent/redis", () => ({
  isRedisConfigured: vi.fn(() => true),
  getAgentConfig: vi.fn(),
  getAgentPublicKey: vi.fn(),
  getAgentHistory: vi.fn(),
  setAgentConfig: vi.fn(),
  hasAgent: vi.fn(),
}))

// Mock auth
vi.mock("@/lib/agent/auth", () => ({
  verifyWalletSignature: vi.fn(),
  isValidSolanaAddress: vi.fn(() => true),
}))

// Mock Solana connection
vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js")
  class MockConnection {
    getBalance = vi.fn().mockResolvedValue(5_000_000_000)
    getTokenAccountBalance = vi.fn().mockResolvedValue({
      value: { uiAmount: 100 },
    })
  }
  return {
    ...actual,
    Connection: MockConnection,
  }
})

vi.mock("@solana/spl-token", () => ({
  getAssociatedTokenAddressSync: vi.fn().mockReturnValue("mockAta"),
}))

vi.mock("@/config/solana", () => ({
  SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com" },
}))

vi.mock("@/lib/token-mints", () => ({
  TOKEN_MINTS: {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    EURC: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
  },
}))

import {
  isRedisConfigured,
  getAgentConfig,
  getAgentPublicKey,
  getAgentHistory,
  setAgentConfig,
  hasAgent,
} from "@/lib/agent/redis"
import { verifyWalletSignature } from "@/lib/agent/auth"

const WALLET = "7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs"

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"))
}

function authParams(wallet = WALLET) {
  return `&signature=dGVzdHNpZw==&message=agio-auth:${wallet}`
}

describe("GET /api/agent/status", () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import("@/app/api/agent/status/route")
    GET = mod.GET
  })

  it("returns 400 when wallet param is missing", async () => {
    const res = await GET(makeRequest("http://localhost/api/agent/status"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/wallet/i)
  })

  it("returns 400 when auth params are missing", async () => {
    const res = await GET(makeRequest(`http://localhost/api/agent/status?wallet=${WALLET}`))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/auth/i)
  })

  it("returns 400 when auth message doesn't match wallet", async () => {
    const res = await GET(
      makeRequest(
        `http://localhost/api/agent/status?wallet=${WALLET}&signature=dGVzdA==&message=agio-auth:WRONG`,
      ),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/auth message/i)
  })

  it("returns 401 when signature is invalid", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(false)
    const res = await GET(
      makeRequest(`http://localhost/api/agent/status?wallet=${WALLET}${authParams()}`),
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when Redis is not configured", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(isRedisConfigured).mockReturnValue(false)

    const res = await GET(
      makeRequest(`http://localhost/api/agent/status?wallet=${WALLET}${authParams()}`),
    )
    expect(res.status).toBe(404)
    vi.mocked(isRedisConfigured).mockReturnValue(true)
  })

  it("returns 404 when agent is not found", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(getAgentConfig).mockResolvedValue(null)
    vi.mocked(getAgentPublicKey).mockResolvedValue(null)

    const res = await GET(
      makeRequest(`http://localhost/api/agent/status?wallet=${WALLET}${authParams()}`),
    )
    expect(res.status).toBe(404)
  })

  it("returns 200 with config and balances when agent exists", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(getAgentConfig).mockResolvedValue({
      enabled: true,
      createdAt: "2025-01-01",
      lendEnabled: true,
      lendTokens: ["USDC"],
      lendMinApy: 5,
      lendMinAmountUsd: 100,
      lendMaxAmountUsd: 5000,
      lendMaxDuration: 30,
      lendAcceptedCollateral: ["SOL"],
      lendMinCollateralRatio: 150,
      lendMaxCollateralRatio: 300,
      lendMinHealthFactor: 1.3,
      lendAutoForeclose: true,
      lendAutoCreateOffers: false,
      borrowEnabled: false,
      borrowTokens: ["USDC"],
      borrowMaxApy: 15,
      borrowMinAmountUsd: 50,
      borrowMaxAmountUsd: 2000,
      borrowCollateralTokens: ["SOL"],
      borrowMinCollateralRatio: 150,
      borrowMaxCollateralRatio: 200,
      borrowMaxDuration: 30,
      borrowAutoRepay: true,
      borrowAddCollateralThreshold: 1.2,
      borrowAutoRepayOnWarning: false,
      borrowAutoCreateRequests: false,
      swapEnabled: false,
      swapSlippageBps: 50,
      swapAutoRebalance: false,
      socialAutoAcceptFriends: true,
      privacyEnabled: false,
      privacyMode: "never" as const,
    })
    vi.mocked(getAgentPublicKey).mockResolvedValue(WALLET)

    const res = await GET(
      makeRequest(`http://localhost/api/agent/status?wallet=${WALLET}${authParams()}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.enabled).toBe(true)
    expect(body.agentPublicKey).toBe(WALLET)
    expect(body.balances).toBeDefined()
    expect(body.balances.SOL).toBeGreaterThanOrEqual(0)
  })
})

describe("GET /api/agent/history", () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import("@/app/api/agent/history/route")
    GET = mod.GET
  })

  it("returns 400 when wallet is missing", async () => {
    const res = await GET(makeRequest("http://localhost/api/agent/history"))
    expect(res.status).toBe(400)
  })

  it("returns 401 when signature is invalid", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(false)
    const res = await GET(
      makeRequest(`http://localhost/api/agent/history?wallet=${WALLET}${authParams()}`),
    )
    expect(res.status).toBe(401)
  })

  it("returns paginated history", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(getAgentHistory).mockResolvedValue({
      actions: [
        {
          timestamp: "2025-01-01T00:00:00Z",
          type: "scan",
          details: "Lend scan",
          txHash: null,
          status: "success",
        },
      ],
      total: 1,
    })

    const res = await GET(
      makeRequest(
        `http://localhost/api/agent/history?wallet=${WALLET}${authParams()}&page=1&pageSize=10`,
      ),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.actions).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
  })
})

describe("GET /api/agent/config", () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import("@/app/api/agent/config/route")
    GET = mod.GET
  })

  it("returns 400 without wallet", async () => {
    const res = await GET(makeRequest("http://localhost/api/agent/config"))
    expect(res.status).toBe(400)
  })

  it("returns config when authenticated", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(getAgentConfig).mockResolvedValue({
      enabled: false,
      createdAt: "2025-01-01",
      lendEnabled: false,
      lendTokens: ["USDC"],
      lendMinApy: 5,
      lendMinAmountUsd: 100,
      lendMaxAmountUsd: 5000,
      lendMaxDuration: 30,
      lendAcceptedCollateral: ["SOL"],
      lendMinCollateralRatio: 150,
      lendMaxCollateralRatio: 300,
      lendMinHealthFactor: 1.3,
      lendAutoForeclose: true,
      lendAutoCreateOffers: false,
      borrowEnabled: false,
      borrowTokens: ["USDC"],
      borrowMaxApy: 15,
      borrowMinAmountUsd: 50,
      borrowMaxAmountUsd: 2000,
      borrowCollateralTokens: ["SOL"],
      borrowMinCollateralRatio: 150,
      borrowMaxCollateralRatio: 200,
      borrowMaxDuration: 30,
      borrowAutoRepay: true,
      borrowAddCollateralThreshold: 1.2,
      borrowAutoRepayOnWarning: false,
      borrowAutoCreateRequests: false,
      swapEnabled: false,
      swapSlippageBps: 50,
      swapAutoRebalance: false,
      socialAutoAcceptFriends: true,
      privacyEnabled: false,
      privacyMode: "never" as const,
    })

    const res = await GET(
      makeRequest(`http://localhost/api/agent/config?wallet=${WALLET}${authParams()}`),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config).toBeDefined()
  })
})

describe("PUT /api/agent/config", () => {
  let PUT: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import("@/app/api/agent/config/route")
    PUT = mod.PUT
  })

  it("returns 400 when fields are missing", async () => {
    const req = new NextRequest("http://localhost/api/agent/config", {
      method: "PUT",
      body: JSON.stringify({}),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it("returns 401 when signature is invalid", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(false)
    const req = new NextRequest("http://localhost/api/agent/config", {
      method: "PUT",
      body: JSON.stringify({
        wallet: WALLET,
        signature: "invalid",
        message: `agio-auth:${WALLET}`,
        config: { lendMinApy: 10 },
      }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it("validates config ranges", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(hasAgent).mockResolvedValue(true)

    const req = new NextRequest("http://localhost/api/agent/config", {
      method: "PUT",
      body: JSON.stringify({
        wallet: WALLET,
        signature: "valid",
        message: `agio-auth:${WALLET}`,
        config: { lendMinApy: 200 }, // over 100
      }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/lendMinApy/)
  })

  it("validates invalid tokens", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(hasAgent).mockResolvedValue(true)

    const req = new NextRequest("http://localhost/api/agent/config", {
      method: "PUT",
      body: JSON.stringify({
        wallet: WALLET,
        signature: "valid",
        message: `agio-auth:${WALLET}`,
        config: { lendTokens: ["INVALID_TOKEN"] },
      }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid token/)
  })

  it("merges config and preserves createdAt and enabled", async () => {
    vi.mocked(verifyWalletSignature).mockReturnValue(true)
    vi.mocked(hasAgent).mockResolvedValue(true)
    vi.mocked(getAgentConfig).mockResolvedValue({
      enabled: true,
      createdAt: "2025-01-01",
      lendEnabled: true,
      lendTokens: ["USDC"],
      lendMinApy: 5,
      lendMinAmountUsd: 100,
      lendMaxAmountUsd: 5000,
      lendMaxDuration: 30,
      lendAcceptedCollateral: ["SOL"],
      lendMinCollateralRatio: 150,
      lendMaxCollateralRatio: 300,
      lendMinHealthFactor: 1.3,
      lendAutoForeclose: true,
      lendAutoCreateOffers: false,
      borrowEnabled: false,
      borrowTokens: ["USDC"],
      borrowMaxApy: 15,
      borrowMinAmountUsd: 50,
      borrowMaxAmountUsd: 2000,
      borrowCollateralTokens: ["SOL"],
      borrowMinCollateralRatio: 150,
      borrowMaxCollateralRatio: 200,
      borrowMaxDuration: 30,
      borrowAutoRepay: true,
      borrowAddCollateralThreshold: 1.2,
      borrowAutoRepayOnWarning: false,
      borrowAutoCreateRequests: false,
      swapEnabled: false,
      swapSlippageBps: 50,
      swapAutoRebalance: false,
      socialAutoAcceptFriends: true,
      privacyEnabled: false,
      privacyMode: "never" as const,
    })
    vi.mocked(setAgentConfig).mockResolvedValue()

    const req = new NextRequest("http://localhost/api/agent/config", {
      method: "PUT",
      body: JSON.stringify({
        wallet: WALLET,
        signature: "valid",
        message: `agio-auth:${WALLET}`,
        config: { lendMinApy: 10, enabled: false, createdAt: "HACKED" },
      }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Preserved original values
    expect(body.config.createdAt).toBe("2025-01-01")
    expect(body.config.enabled).toBe(true)
    // Updated value
    expect(body.config.lendMinApy).toBe(10)
  })
})
