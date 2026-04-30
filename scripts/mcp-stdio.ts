#!/usr/bin/env npx tsx
/**
 * Agio DeFi MCP Server — stdio transport for Claude Desktop.
 *
 * Usage:
 *   npx tsx scripts/mcp-stdio.ts
 *
 * Claude Desktop config (~/.claude/mcp.json):
 * {
 *   "mcpServers": {
 *     "agio-defi": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/agio-platform/scripts/mcp-stdio.ts"],
 *       "env": {
 *         "UPSTASH_REDIS_REST_URL": "...",
 *         "UPSTASH_REDIS_REST_TOKEN": "...",
 *         "PRIVY_APP_ID": "...",
 *         "PRIVY_APP_SECRET": "...",
 *         "TAPESTRY_API_KEY": "...",
 *         "NEXT_PUBLIC_SOLANA_RPC_URL": "...",
 *         "X402_TREASURY_WALLET": "..."
 *       }
 *     }
 *   }
 * }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createAgioMcpServer } from "../lib/mcp/server.js"

async function main() {
  const server = createAgioMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Use stderr for logging (stdout is reserved for JSON-RPC)
  console.error("Agio DeFi MCP server running on stdio")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
