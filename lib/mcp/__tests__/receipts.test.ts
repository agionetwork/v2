import { describe, it, expect, vi, beforeEach } from "vitest"

// In-memory Redis mock
const store = new Map<string, string[]>()
const ttls = new Map<string, number>()

vi.mock("@/lib/agent/redis", () => ({
  isRedisConfigured: vi.fn(() => true),
  getRedis: () => ({
    lpush: vi.fn(async (key: string, value: string) => {
      if (!store.has(key)) store.set(key, [])
      store.get(key)!.unshift(value)
      return store.get(key)!.length
    }),
    ltrim: vi.fn(async (key: string, start: number, end: number) => {
      const list = store.get(key) || []
      store.set(key, list.slice(start, end + 1))
    }),
    expire: vi.fn(async (key: string, seconds: number) => {
      ttls.set(key, seconds)
    }),
    llen: vi.fn(async (key: string) => (store.get(key) || []).length),
    lrange: vi.fn(async (key: string, start: number, end: number) => {
      const list = store.get(key) || []
      return list.slice(start, end + 1)
    }),
  }),
}))

import { recordReceipt, getReceipts, type PaymentReceipt } from "@/lib/mcp/receipts"

function makeReceipt(overrides: Partial<PaymentReceipt> = {}): PaymentReceipt {
  return {
    id: `receipt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    wallet: "TestWallet123",
    toolName: "create-agent",
    amount: 0.10,
    token: "USDC",
    txSignature: "sig123",
    timestamp: new Date().toISOString(),
    success: true,
    ...overrides,
  }
}

describe("receipts", () => {
  beforeEach(() => {
    store.clear()
    ttls.clear()
  })

  describe("recordReceipt", () => {
    it("stores a receipt in Redis", async () => {
      const receipt = makeReceipt()
      await recordReceipt(receipt)

      const key = `mcp:receipts:${receipt.wallet}`
      expect(store.has(key)).toBe(true)
      expect(store.get(key)!.length).toBe(1)

      const stored = JSON.parse(store.get(key)![0])
      expect(stored.toolName).toBe("create-agent")
      expect(stored.amount).toBe(0.10)
    })

    it("stores multiple receipts in order (newest first)", async () => {
      await recordReceipt(makeReceipt({ id: "r1", toolName: "tool-a" }))
      await recordReceipt(makeReceipt({ id: "r2", toolName: "tool-b" }))

      const key = "mcp:receipts:TestWallet123"
      const items = store.get(key)!.map((s) => JSON.parse(s))
      expect(items[0].toolName).toBe("tool-b")
      expect(items[1].toolName).toBe("tool-a")
    })
  })

  describe("getReceipts", () => {
    it("returns empty when no receipts exist", async () => {
      const result = await getReceipts("EmptyWallet")
      expect(result.receipts).toEqual([])
      expect(result.total).toBe(0)
    })

    it("returns receipts with pagination", async () => {
      // Store 5 receipts
      for (let i = 0; i < 5; i++) {
        await recordReceipt(makeReceipt({ id: `r${i}` }))
      }

      const page1 = await getReceipts("TestWallet123", 1, 2)
      expect(page1.receipts.length).toBe(2)
      expect(page1.total).toBe(5)
      expect(page1.page).toBe(1)
      expect(page1.pageSize).toBe(2)

      const page2 = await getReceipts("TestWallet123", 2, 2)
      expect(page2.receipts.length).toBe(2)
    })

    it("filters out malformed JSON entries", async () => {
      const key = "mcp:receipts:BadData"
      store.set(key, [
        JSON.stringify(makeReceipt({ id: "valid" })),
        "not-valid-json{{{",
        JSON.stringify(makeReceipt({ id: "also-valid" })),
      ])

      const result = await getReceipts("BadData", 1, 10)
      expect(result.receipts.length).toBe(2)
      expect(result.receipts[0].id).toBe("valid")
      expect(result.receipts[1].id).toBe("also-valid")
    })
  })

  describe("when Redis is not configured", () => {
    it("recordReceipt silently no-ops", async () => {
      const { isRedisConfigured } = await import("@/lib/agent/redis")
      vi.mocked(isRedisConfigured).mockReturnValue(false)

      await recordReceipt(makeReceipt())
      // No error thrown

      vi.mocked(isRedisConfigured).mockReturnValue(true)
    })

    it("getReceipts returns empty", async () => {
      const { isRedisConfigured } = await import("@/lib/agent/redis")
      vi.mocked(isRedisConfigured).mockReturnValue(false)

      const result = await getReceipts("AnyWallet")
      expect(result.receipts).toEqual([])
      expect(result.total).toBe(0)

      vi.mocked(isRedisConfigured).mockReturnValue(true)
    })
  })
})
