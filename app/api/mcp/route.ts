import { NextRequest, NextResponse } from "next/server"
import { createAgioMcpServer } from "@/lib/mcp/server"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

export const dynamic = "force-dynamic"

/**
 * MCP endpoint for external AI agents (Web Standard Streamable HTTP transport).
 *
 * Stateless: each request creates a fresh server + transport.
 * Compatible with Vercel serverless functions and any Web Standard runtime.
 */
export async function POST(req: NextRequest) {
  try {
    const server = createAgioMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no sessions
      enableJsonResponse: true,
    })

    await server.connect(transport)

    // WebStandardStreamableHTTPServerTransport.handleRequest takes a Request
    // and returns a Response — perfect for Next.js App Router
    return await transport.handleRequest(req)
  } catch (err: any) {
    console.error("MCP request error:", err)
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: err.message || "Internal error" },
        id: null,
      },
      { status: 500 },
    )
  }
}

/**
 * GET handler for SSE stream.
 * Returns 405 since we use stateless JSON responses.
 */
export async function GET(req: NextRequest) {
  try {
    const server = createAgioMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    await server.connect(transport)
    return await transport.handleRequest(req)
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not supported in stateless mode" },
        id: null,
      },
      { status: 405 },
    )
  }
}

/**
 * DELETE handler for session cleanup.
 * Returns 405 since we don't maintain sessions.
 */
export async function DELETE(req: NextRequest) {
  try {
    const server = createAgioMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    await server.connect(transport)
    return await transport.handleRequest(req)
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "No sessions to clean up" },
        id: null,
      },
      { status: 405 },
    )
  }
}
