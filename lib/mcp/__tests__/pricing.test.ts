import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Redis before importing the module under test
const mockRedisGet = vi.fn()
vi.mock("@/lib/agent/redis", () => ({
  isRedisConfigured: vi.fn(() => false),
  getRedis: () => ({
    get: mockRedisGet,
  }),
}))

import { getToolPrice, getAllPrices, isPaidTool } from "@/lib/mcp/pricing"
import { isRedisConfigured } from "@/lib/agent/redis"

describe("pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getToolPrice", () => {
    it("returns the default price when Redis is not configured", async () => {
      const price = await getToolPrice("create-agent")
      expect(price).toBe(0.10)
    })

    it("returns 0 for free tools", async () => {
      const price = await getToolPrice("list-loans")
      expect(price).toBe(0)
    })

    it("returns 0 for proportional fee tools (fee computed at runtime)", async () => {
      // v2: proportional tools return 0 in getToolPrice — actual fee is from calculateFee()
      const price = await getToolPrice("swap-tokens")
      expect(price).toBe(0)
    })

    it("returns 0 for unknown tools", async () => {
      const price = await getToolPrice("nonexistent-tool")
      expect(price).toBe(0)
    })

    it("returns Redis override when available", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true)
      mockRedisGet.mockResolvedValue(0.50)

      const price = await getToolPrice("create-agent")
      expect(price).toBe(0.50)
      expect(mockRedisGet).toHaveBeenCalledWith("mcp:pricing:create-agent")
    })

    it("falls back to default when Redis returns null", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true)
      mockRedisGet.mockResolvedValue(null)

      const price = await getToolPrice("create-agent")
      expect(price).toBe(0.10)
    })
  })

  describe("isPaidTool", () => {
    it("returns true for paid tools (flat fee)", async () => {
      expect(await isPaidTool("create-agent")).toBe(true)
    })

    it("returns true for proportional fee tools", async () => {
      expect(await isPaidTool("create-lend-offer")).toBe(true)
      expect(await isPaidTool("swap-tokens")).toBe(true)
    })

    it("returns false for free tools", async () => {
      expect(await isPaidTool("list-loans")).toBe(false)
    })

    it("returns false for now-free tools (v2)", async () => {
      expect(await isPaidTool("create-profile")).toBe(false)
      expect(await isPaidTool("follow-user")).toBe(false)
      expect(await isPaidTool("configure-agent")).toBe(false)
    })
  })

  describe("getAllPrices", () => {
    it("returns all default prices when Redis is not configured", async () => {
      const prices = await getAllPrices()
      expect(prices["list-loans"]).toBe(0)
      expect(prices["create-agent"]).toBe(0.10)
      // v2: proportional tools show 0 in static table
      expect(prices["swap-tokens"]).toBe(0)
      expect(prices["create-lend-offer"]).toBe(0)
      // v2: now-free tools show 0
      expect(prices["create-profile"]).toBe(0)
      expect(prices["follow-user"]).toBe(0)
      expect(Object.keys(prices).length).toBeGreaterThan(20)
    })
  })
})
