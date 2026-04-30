import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

describe("tapestry proxy", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  async function importRoute() {
    return await import("@/app/api/tapestry/route")
  }

  describe("GET", () => {
    it("reports configured status", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"
      const { GET } = await importRoute()
      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.configured).toBe(true)
    })
  })

  describe("POST", () => {
    it("returns 503 when API key is not configured", async () => {
      process.env.TAPESTRY_API_KEY = ""
      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ path: "/profiles", method: "GET" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error).toMatch(/not configured/i)
    })

    it("returns 400 for invalid path (missing /)", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"
      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ path: "no-leading-slash", method: "GET" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/path/i)
    })

    it("returns 400 when path is missing", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"
      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ method: "GET" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it("forwards valid requests to Tapestry API", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"
      process.env.TAPESTRY_API_URL = "https://api.usetapestry.dev/api/v1"

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ username: "testuser" }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ path: "/profiles/testuser", method: "GET" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.username).toBe("testuser")

      // Verify fetch was called with correct URL including API key
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("apiKey=test-key"),
        expect.objectContaining({ method: "GET" }),
      )

      vi.unstubAllGlobals()
    })

    it("returns Tapestry error status on failure", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Not found" }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ path: "/profiles/nonexistent", method: "GET" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(404)

      vi.unstubAllGlobals()
    })

    it("returns 405 for disallowed HTTP methods", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"
      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ path: "/profiles/test", method: "DELETE" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(405)
      const body = await res.json()
      expect(body.error).toMatch(/method not allowed/i)
    })

    it("returns 403 for disallowed path prefixes", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"
      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ path: "/admin/users", method: "GET" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toMatch(/path not allowed/i)
    })

    it("appends apiKey correctly when path has query params", async () => {
      process.env.TAPESTRY_API_KEY = "test-key"

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results: [] }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const { POST } = await importRoute()
      const req = new NextRequest("http://localhost/api/tapestry", {
        method: "POST",
        body: JSON.stringify({ path: "/profiles?limit=10", method: "GET" }),
      })
      await POST(req)

      // Should use & instead of ? since path already has query params
      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("?limit=10&apiKey=test-key")

      vi.unstubAllGlobals()
    })
  })
})
