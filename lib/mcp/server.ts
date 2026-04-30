import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerFreeTools } from "./tools/free"
import { registerPaidTools } from "./tools/paid"
import { registerLendingTools } from "./tools/lending"
import { registerSocialTools } from "./tools/social"
import { registerBatchTools } from "./tools/batch"

/**
 * Create the Agio DeFi MCP server with all tools registered.
 * This factory is transport-agnostic — used by both the HTTP route
 * and the stdio script.
 */
export function createAgioMcpServer(): McpServer {
  const server = new McpServer({
    name: "agio-defi",
    version: "4.0.0",
    description:
      "Agio DeFi Protocol — peer-to-peer lending on Solana. " +
      "All lending operations are free in MCP — 1% origination fee is collected on-chain when offers are accepted. " +
      "Only create-agent ($0.10) and swap-tokens (0.05%) require x402 payment. " +
      "Use the swap-tokens tool (Jupiter Aggregator) to swap between any tokens. " +
      "Call get-platform-info to see setup instructions and pricing.",
  })

  registerFreeTools(server)
  registerPaidTools(server)
  registerLendingTools(server)
  registerSocialTools(server)
  registerBatchTools(server)

  return server
}
