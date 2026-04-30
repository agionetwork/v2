import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Keypair, Transaction, SystemProgram, PublicKey } from "@solana/web3.js"

// Mock Redis
const mockRedisGet = vi.fn()
const mockRedisSet = vi.fn()
vi.mock("@/lib/agent/redis", () => ({
  isRedisConfigured: vi.fn(() => false),
  getRedis: () => ({
    get: mockRedisGet,
    set: mockRedisSet,
  }),
}))

// Mock config
vi.mock("@/config/solana", () => ({
  SOLANA_CONFIG: {
    RPC_URL: "https://api.devnet.solana.com",
    CLUSTER: "devnet",
  },
}))

// Mock token mints with real-looking pubkeys
const MOCK_USDC = Keypair.generate().publicKey
const MOCK_EURC = Keypair.generate().publicKey
const MOCK_SOL = new PublicKey("So11111111111111111111111111111111111111112")

vi.mock("@/lib/token-mints", () => ({
  TOKEN_MINTS: {
    USDC: MOCK_USDC,
    EURC: MOCK_EURC,
    SOL: MOCK_SOL,
  },
  TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
}))

describe("x402-verify", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    // Set treasury wallet for tests
    vi.stubEnv("X402_TREASURY_WALLET", Keypair.generate().publicKey.toBase58())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("getTreasuryWallet", () => {
    it("throws when X402_TREASURY_WALLET is not set", async () => {
      // We need to test the createPaymentRequirement function which calls getTreasuryWallet
      vi.stubEnv("X402_TREASURY_WALLET", "")

      // Force re-import to reset cached wallet
      vi.resetModules()

      // Re-mock dependencies
      vi.doMock("@/lib/agent/redis", () => ({
        isRedisConfigured: vi.fn(() => false),
        getRedis: () => ({ get: vi.fn(), set: vi.fn() }),
      }))
      vi.doMock("@/config/solana", () => ({
        SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com", CLUSTER: "devnet" },
      }))
      vi.doMock("@/lib/token-mints", () => ({
        TOKEN_MINTS: { USDC: MOCK_USDC, EURC: MOCK_EURC, SOL: MOCK_SOL },
        TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
      }))

      const { createPaymentRequirement } = await import("@/lib/mcp/x402-verify")

      await expect(createPaymentRequirement(0.01, "test")).rejects.toThrow(
        "X402_TREASURY_WALLET environment variable is not set",
      )
    })
  })

  describe("verifyX402Payment", () => {
    it("rejects a transaction with no fee payer (corrupt binary)", async () => {
      vi.resetModules()
      vi.doMock("@/lib/agent/redis", () => ({
        isRedisConfigured: vi.fn(() => false),
        getRedis: () => ({ get: vi.fn(), set: vi.fn() }),
      }))
      vi.doMock("@/config/solana", () => ({
        SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com", CLUSTER: "devnet" },
      }))
      vi.doMock("@/lib/token-mints", () => ({
        TOKEN_MINTS: { USDC: MOCK_USDC, EURC: MOCK_EURC, SOL: MOCK_SOL },
        TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
      }))

      const { verifyX402Payment } = await import("@/lib/mcp/x402-verify")

      // Construct a minimal wire-format buffer with 0 signatures:
      // [0x00] num_signatures=0, then a minimal message header
      // This creates a Transaction.from() that has no feePayer
      const buf = Buffer.alloc(4 + 32 + 32)
      buf[0] = 0 // 0 signatures
      buf[1] = 0 // num_required_signatures
      buf[2] = 0 // num_readonly_signed
      buf[3] = 0 // num_readonly_unsigned
      const proof = buf.toString("base64")

      const result = await verifyX402Payment(proof, 0.01)
      expect(result.valid).toBe(false)
      // Should fail during deserialization or because no fee payer
      expect(result.error).toBeDefined()
    })

    it("rejects an unsigned transaction", async () => {
      vi.resetModules()
      vi.doMock("@/lib/agent/redis", () => ({
        isRedisConfigured: vi.fn(() => false),
        getRedis: () => ({ get: vi.fn(), set: vi.fn() }),
      }))
      vi.doMock("@/config/solana", () => ({
        SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com", CLUSTER: "devnet" },
      }))
      vi.doMock("@/lib/token-mints", () => ({
        TOKEN_MINTS: { USDC: MOCK_USDC, EURC: MOCK_EURC, SOL: MOCK_SOL },
        TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
      }))

      const { verifyX402Payment } = await import("@/lib/mcp/x402-verify")

      const payer = Keypair.generate()
      const tx = new Transaction()
      tx.recentBlockhash = "11111111111111111111111111111111"
      tx.feePayer = payer.publicKey
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1000,
        }),
      )

      // Serialize WITHOUT signing — tx has fee payer but no real signature
      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
      const proof = serialized.toString("base64")

      const result = await verifyX402Payment(proof, 0.01)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("signature verification failed")
    })

    it("rejects when Redis not configured in production", async () => {
      vi.stubEnv("NODE_ENV", "production")
      const treasuryKey = Keypair.generate().publicKey.toBase58()
      vi.stubEnv("X402_TREASURY_WALLET", treasuryKey)

      // Mock fetch for Jupiter price API (needed for SOL→USDC conversion)
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ outAmount: "1000000" }), // 1 USDC
      }) as any

      vi.resetModules()
      vi.doMock("@/lib/agent/redis", () => ({
        isRedisConfigured: vi.fn(() => false),
        getRedis: () => ({ get: vi.fn(), set: vi.fn() }),
      }))
      vi.doMock("@/config/solana", () => ({
        SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com", CLUSTER: "devnet" },
      }))
      vi.doMock("@/lib/token-mints", () => ({
        TOKEN_MINTS: { USDC: MOCK_USDC, EURC: MOCK_EURC, SOL: MOCK_SOL },
        TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
      }))

      const { verifyX402Payment } = await import("@/lib/mcp/x402-verify")
      const treasury = new PublicKey(treasuryKey)

      // Create a properly signed transaction that transfers SOL to treasury
      const payer = Keypair.generate()
      const tx = new Transaction()
      tx.recentBlockhash = "11111111111111111111111111111111"
      tx.feePayer = payer.publicKey
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: treasury,
          lamports: 100_000_000, // 0.1 SOL
        }),
      )
      tx.sign(payer)

      const proof = tx.serialize().toString("base64")

      const result = await verifyX402Payment(proof, 0.01)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Redis is not configured")
      expect(result.error).toContain("production")

      // Restore
      globalThis.fetch = originalFetch
    })

    it("rejects malformed base64 input", async () => {
      vi.resetModules()
      vi.doMock("@/lib/agent/redis", () => ({
        isRedisConfigured: vi.fn(() => false),
        getRedis: () => ({ get: vi.fn(), set: vi.fn() }),
      }))
      vi.doMock("@/config/solana", () => ({
        SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com", CLUSTER: "devnet" },
      }))
      vi.doMock("@/lib/token-mints", () => ({
        TOKEN_MINTS: { USDC: MOCK_USDC, EURC: MOCK_EURC, SOL: MOCK_SOL },
        TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
      }))

      const { verifyX402Payment } = await import("@/lib/mcp/x402-verify")

      const result = await verifyX402Payment("not-a-valid-transaction", 0.01)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe("checkRateLimit", () => {
    it("denies in production when Redis is not configured", async () => {
      vi.stubEnv("NODE_ENV", "production")

      vi.resetModules()
      vi.doMock("@/lib/agent/redis", () => ({
        isRedisConfigured: vi.fn(() => false),
        getRedis: () => ({ get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn() }),
      }))
      vi.doMock("@/config/solana", () => ({
        SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com", CLUSTER: "devnet" },
      }))
      vi.doMock("@/lib/token-mints", () => ({
        TOKEN_MINTS: { USDC: MOCK_USDC, EURC: MOCK_EURC, SOL: MOCK_SOL },
        TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
      }))

      const { checkRateLimit } = await import("@/lib/mcp/x402-verify")

      const allowed = await checkRateLimit("some-wallet", false)
      expect(allowed).toBe(false)
    })

    it("allows in development when Redis is not configured", async () => {
      vi.stubEnv("NODE_ENV", "development")

      vi.resetModules()
      vi.doMock("@/lib/agent/redis", () => ({
        isRedisConfigured: vi.fn(() => false),
        getRedis: () => ({ get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn() }),
      }))
      vi.doMock("@/config/solana", () => ({
        SOLANA_CONFIG: { RPC_URL: "https://api.devnet.solana.com", CLUSTER: "devnet" },
      }))
      vi.doMock("@/lib/token-mints", () => ({
        TOKEN_MINTS: { USDC: MOCK_USDC, EURC: MOCK_EURC, SOL: MOCK_SOL },
        TOKEN_DECIMALS: { USDC: 6, EURC: 6, SOL: 9 },
      }))

      const { checkRateLimit } = await import("@/lib/mcp/x402-verify")

      const allowed = await checkRateLimit("some-wallet", false)
      expect(allowed).toBe(true)
    })
  })
})
