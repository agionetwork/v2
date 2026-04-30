#!/usr/bin/env npx tsx
/**
 * Test script for external AI agents connecting to the Agio platform.
 *
 * Demonstrates the full MCP flow an external agent would follow:
 *  1. Initialize MCP session
 *  2. List available tools
 *  3. Get platform info
 *  4. List loans (free)
 *  5. Get leaderboard (free)
 *  6. Create profile (paid — devnet free mode)
 *  7. Create agent (paid — devnet free mode)
 *  8. Airdrop devnet SOL to agent wallet (free)
 *  9. Get agent status (free)
 * 10. Configure agent — lend + borrow (paid — devnet free mode)
 * 11. Update profile — username, bio, avatar (paid — devnet free mode)
 * 12. Request USDC & EURC from Circle faucet (free)
 * 13. Verify agent balances (free)
 * 14. Create a lend offer — 1 day max on devnet (paid — devnet free mode)
 * 15. Activate agent bot (paid — devnet free mode)
 * 16. Run one agent cycle manually (paid — devnet free mode)
 * 17. Get agent history (free)
 *
 * Prerequisites:
 * - The Agio platform must be running (npm run dev)
 * - DEVNET_FREE_TOOLS=true in .env
 * - NEXT_PUBLIC_SOLANA_CLUSTER=devnet in .env
 * - CIRCLE_API_KEY in .env (for Circle faucet, optional)
 *
 * Note: Twitter/X verification requires OAuth browser redirect and
 * cannot be done via MCP. Agents must authenticate via the web UI.
 *
 * Usage:
 *   npx tsx scripts/test-external-agent.ts [baseUrl] [wallet]
 *
 * Examples:
 *   npx tsx scripts/test-external-agent.ts
 *   npx tsx scripts/test-external-agent.ts http://localhost:3000
 *   npx tsx scripts/test-external-agent.ts http://localhost:3000 YourWalletAddress
 */

import { Keypair } from "@solana/web3.js"

const BASE_URL = process.argv[2] || "http://localhost:3000"
const MCP_URL = `${BASE_URL}/api/mcp`
// Generate a valid Solana wallet address (Tapestry requires a real base58 pubkey)
const TEST_WALLET = process.argv[3] || Keypair.generate().publicKey.toBase58()

let requestId = 0

async function mcpRequest(method: string, params?: any): Promise<any> {
  requestId++
  const body = {
    jsonrpc: "2.0",
    id: requestId,
    method,
    params: params || {},
  }

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  const json = await res.json()
  if (json.error) {
    throw new Error(`MCP Error ${json.error.code}: ${json.error.message}`)
  }

  return json.result
}

async function callTool(name: string, args: Record<string, any> = {}): Promise<any> {
  const result = await mcpRequest("tools/call", { name, arguments: args })

  // Parse the text content from MCP response
  if (result?.content?.[0]?.text) {
    return JSON.parse(result.content[0].text)
  }

  return result
}

function log(step: string, data?: any) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`  ${step}`)
  console.log("=".repeat(60))
  if (data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function main() {
  console.log(`\nAgio MCP External Agent Test`)
  console.log(`MCP Endpoint: ${MCP_URL}`)
  console.log(`Test Wallet: ${TEST_WALLET}`)
  console.log()

  // Step 1: Initialize session
  log("Step 1: Initialize MCP session")
  try {
    const initResult = await mcpRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-agent", version: "1.0.0" },
    })
    console.log("Server:", initResult.serverInfo?.name, "v" + initResult.serverInfo?.version)
  } catch (err: any) {
    console.error("Init failed:", err.message)
    console.log("(This is OK — some MCP servers don't require initialization)")
  }

  // Step 2: List tools
  log("Step 2: List available tools")
  try {
    const tools = await mcpRequest("tools/list")
    const toolNames = tools.tools?.map((t: any) => t.name) || []
    console.log(`Found ${toolNames.length} tools:`)
    for (const name of toolNames) {
      const tool = tools.tools.find((t: any) => t.name === name)
      console.log(`  - ${name}: ${tool.description?.slice(0, 80)}...`)
    }
  } catch (err: any) {
    console.error("Failed to list tools:", err.message)
  }

  // Step 3: Get platform info
  log("Step 3: Get platform info")
  try {
    const info = await callTool("get-platform-info")
    console.log("Platform:", info.platform)
    console.log("Network:", info.caip2Network)
    console.log("Devnet Free Mode:", info.devnetFreeMode)
    console.log("Accepted Tokens:", info.acceptedPaymentTokens?.join(", "))
    console.log("Agent Setup Flow:")
    for (const step of info.agentSetupFlow || []) {
      console.log(`  ${step}`)
    }

    if (!info.devnetFreeMode) {
      console.log("\n⚠ WARNING: Devnet free mode is NOT enabled.")
      console.log("  Set DEVNET_FREE_TOOLS=true in .env to test without x402 payments.")
      console.log("  Without devnet free mode, paid tools will require real x402 payment proofs.")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 4: List loans (free tool)
  log("Step 4: List loans (free)")
  try {
    const loans = await callTool("list-loans", { limit: 5 })
    console.log(`Total loans: ${loans.total}`)
    if (loans.loans?.length > 0) {
      for (const loan of loans.loans.slice(0, 3)) {
        console.log(`  - ${loan.offerType} ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY`)
      }
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 5: Get leaderboard (free tool)
  log("Step 5: Get leaderboard (free)")
  try {
    const leaderboard = await callTool("get-leaderboard", { limit: 5 })
    console.log(`Top ${leaderboard.total} wallets:`)
    for (const entry of leaderboard.leaderboard || []) {
      console.log(`  - ${entry.wallet.slice(0, 8)}... : ${entry.points} pts`)
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 6: Create profile (paid — needs devnet free mode)
  log("Step 6: Create profile (paid — devnet free mode)")
  try {
    const profile = await callTool("create-profile", {
      wallet: TEST_WALLET,
      username: `agent_${Date.now().toString(36)}`,
    })
    if (profile.success) {
      console.log("Profile created:", profile.profile?.profile?.username)
    } else if (profile.paymentRequired) {
      console.log("Payment required (devnet free mode not enabled)")
      console.log("Price:", profile.price, "USDC")
    } else {
      console.log("Result:", profile.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 7: Create agent (paid — needs devnet free mode)
  log("Step 7: Create agent (paid — devnet free mode)")
  try {
    const agent = await callTool("create-agent", { wallet: TEST_WALLET })
    if (agent.success) {
      console.log("Agent created!")
      console.log("Agent wallet:", agent.agentPublicKey)
      console.log("Config:", JSON.stringify(agent.config, null, 2))
    } else if (agent.paymentRequired) {
      console.log("Payment required (devnet free mode not enabled)")
      console.log("Price:", agent.price, "USDC")
    } else {
      console.log("Result:", agent.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 8: Airdrop devnet SOL to agent wallet
  log("Step 8: Airdrop devnet SOL to agent wallet (free)")
  try {
    const airdrop = await callTool("devnet-airdrop", { wallet: TEST_WALLET, amount: 1 })
    if (airdrop.success) {
      console.log("Airdrop successful!")
      console.log("Tx:", airdrop.txSignature)
      console.log("Agent wallet:", airdrop.agentWallet)
      console.log("New balance:", airdrop.newBalanceSol, "SOL")
    } else {
      console.log("Result:", airdrop.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 9: Get agent status (free — verify balance)
  log("Step 9: Get agent status (free — verify funded)")
  try {
    const status = await callTool("get-agent-status", { wallet: TEST_WALLET })
    if (status.success) {
      console.log("Agent enabled:", status.config?.enabled)
      console.log("Agent wallet:", status.agentPublicKey)
      console.log("Balances:", status.balances)
    } else {
      console.log("Result:", status.error || "No agent found")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 10: Configure agent — lend + borrow (paid — needs devnet free mode)
  log("Step 10: Configure agent — lend + borrow (paid — devnet free mode)")
  try {
    const config = await callTool("configure-agent", {
      wallet: TEST_WALLET,
      lendEnabled: true,
      lendTokens: ["USDC"],
      lendMinApy: 5,
      lendMinAmountUsd: 1,
      lendMaxAmountUsd: 1000,
      lendMaxDuration: 1,
      lendAcceptedCollateral: ["SOL"],
      lendMinCollateralRatio: 150,
      lendAutoForeclose: true,
      lendAutoCreateOffers: true,
      borrowEnabled: true,
      borrowTokens: ["USDC"],
      borrowMaxApy: 15,
      borrowMinAmountUsd: 1,
      borrowMaxAmountUsd: 500,
      borrowCollateralTokens: ["SOL"],
      borrowMaxDuration: 1,
      borrowAutoRepay: true,
      borrowAutoCreateRequests: true,
    })
    if (config.success) {
      console.log("Agent configured!")
      console.log("Lend enabled:", config.config?.lendEnabled)
      console.log("Lend tokens:", config.config?.lendTokens)
      console.log("Auto-create lend offers:", config.config?.lendAutoCreateOffers)
      console.log("Borrow enabled:", config.config?.borrowEnabled)
      console.log("Borrow tokens:", config.config?.borrowTokens)
      console.log("Auto-create borrow requests:", config.config?.borrowAutoCreateRequests)
    } else if (config.paymentRequired) {
      console.log("Payment required (devnet free mode not enabled)")
    } else {
      console.log("Result:", config.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 11: Update profile (paid — needs devnet free mode)
  log("Step 11: Update profile — username, bio, avatar (paid — devnet free mode)")
  try {
    const profile = await callTool("update-profile", {
      wallet: TEST_WALLET,
      displayName: "Agio Test Agent",
      bio: "Autonomous DeFi lending agent on Agio | Powered by AI",
      profileImage: "https://api.dicebear.com/7.x/bottts/png?seed=" + TEST_WALLET.slice(0, 8),
    })
    if (profile.success) {
      console.log("Profile updated!")
      console.log("Display name:", profile.profile?.profile?.displayName || "Agio Test Agent")
      console.log("Bio:", profile.profile?.profile?.bio || "(set)")
    } else if (profile.paymentRequired) {
      console.log("Payment required (devnet free mode not enabled)")
    } else {
      console.log("Result:", profile.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 12: Request USDC & EURC from Circle faucet (free)
  log("Step 12: Request USDC & EURC from Circle faucet (free)")
  try {
    const faucet = await callTool("devnet-token-faucet", {
      wallet: TEST_WALLET,
      usdc: true,
      eurc: true,
    })
    if (faucet.success) {
      console.log("Circle faucet request sent!")
      console.log("Tokens requested:", faucet.tokensRequested?.join(", "))
      console.log("Agent wallet:", faucet.agentWallet)
      console.log("(Tokens may take a few seconds to arrive)")
    } else {
      console.log("Result:", faucet.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
    console.log("(Circle faucet requires CIRCLE_API_KEY in .env)")
  }

  // Wait a few seconds for Circle faucet tokens to arrive
  console.log("\nWaiting 5 seconds for faucet tokens to arrive...")
  await new Promise((resolve) => setTimeout(resolve, 5000))

  // Step 13: Verify agent balances (free)
  log("Step 13: Verify agent balances (free)")
  try {
    const status = await callTool("get-agent-status", { wallet: TEST_WALLET })
    if (status.success) {
      console.log("Agent enabled:", status.config?.enabled)
      console.log("Agent wallet:", status.agentPublicKey)
      console.log("Balances:")
      if (status.balances) {
        for (const [token, amount] of Object.entries(status.balances)) {
          console.log(`  ${token}: ${amount}`)
        }
      }
    } else {
      console.log("Result:", status.error || "No agent found")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 14: Create a lend offer (paid — needs devnet free mode)
  log("Step 14: Create a lend offer — 1 day (paid — devnet free mode)")
  try {
    const offer = await callTool("create-lend-offer", {
      wallet: TEST_WALLET,
      debtToken: "USDC",
      collateralToken: "SOL",
      debtAmount: 10,
      collateralAmount: 0.1,
      duration: 1,
      apy: 8.5,
    })
    if (offer.success) {
      console.log("Lend offer created!")
      console.log("Tx:", offer.txHash)
      console.log("Message:", offer.message)
    } else if (offer.paymentRequired) {
      console.log("Payment required (devnet free mode not enabled)")
    } else {
      console.log("Result:", offer.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 15: Activate agent bot (paid — needs devnet free mode)
  log("Step 15: Activate agent bot (paid — devnet free mode)")
  try {
    const activate = await callTool("activate-agent", { wallet: TEST_WALLET })
    if (activate.success) {
      console.log("Agent activated!")
      console.log("Message:", activate.message)
    } else if (activate.paymentRequired) {
      console.log("Payment required (devnet free mode not enabled)")
    } else {
      console.log("Result:", activate.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 16: Run one agent cycle manually (paid — needs devnet free mode)
  log("Step 16: Run one agent cycle manually (paid — devnet free mode)")
  try {
    const cycle = await callTool("run-agent-cycle", { wallet: TEST_WALLET })
    if (cycle.success) {
      console.log("Agent cycle completed!")
      console.log("Message:", cycle.message)
    } else if (cycle.paymentRequired) {
      console.log("Payment required (devnet free mode not enabled)")
    } else {
      console.log("Result:", cycle.error || "Unknown")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Step 17: Get agent history (free)
  log("Step 17: Get agent history (free)")
  try {
    const history = await callTool("get-agent-history", { wallet: TEST_WALLET })
    if (history.success) {
      console.log(`Total actions: ${history.total || 0}`)
      for (const action of (history.actions || []).slice(0, 5)) {
        console.log(`  - [${action.timestamp}] ${action.type}: ${action.details} (${action.status})`)
      }
    } else {
      console.log("Result:", history.error || "No history found")
    }
  } catch (err: any) {
    console.error("Failed:", err.message)
  }

  // Done
  log("Test Complete — Full Agent Lifecycle")
  console.log("All 17 steps executed. Review the output above for results.")
  console.log()
  console.log("To run with devnet free mode:")
  console.log("  1. Add DEVNET_FREE_TOOLS=true to .env")
  console.log("  2. Ensure NEXT_PUBLIC_SOLANA_CLUSTER=devnet")
  console.log("  3. Add CIRCLE_API_KEY=<your-key> to .env (for USDC/EURC faucet)")
  console.log("  4. Restart the dev server: npm run dev")
  console.log("  5. Re-run this script")
  console.log()
  console.log("Note: Twitter/X verification requires OAuth browser redirect")
  console.log("  and must be done via the web UI at /socialfi/profile/<wallet>")
  console.log()
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
