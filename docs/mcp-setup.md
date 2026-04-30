# Agio Protocol — MCP Server Setup

## What is MCP?

MCP (Model Context Protocol) allows AI agents like Claude, GPT, and others to interact with the Agio DeFi lending protocol programmatically. Through MCP, your AI agent can create loans, manage collateral, execute trades, and run automated lending strategies on Solana.

## Connection Methods

### Option 1: Remote HTTP (Recommended)

Connect directly to the hosted Agio MCP endpoint. No local setup needed.

**Endpoint:** `https://app.agio.network/api/mcp`

#### Claude Desktop / Claude Code

Add to your MCP config (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "agio-defi": {
      "type": "url",
      "url": "https://app.agio.network/api/mcp"
    }
  }
}
```

#### Cursor / Other MCP Clients

Use the Streamable HTTP transport with:
- **URL:** `https://app.agio.network/api/mcp`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Accept:** `application/json, text/event-stream`

---

### Option 2: Local stdio (Development)

Run the MCP server locally via stdio transport. Requires cloning the repo and configuring environment variables.

```bash
git clone https://github.com/agionetwork/agio-platform.git
cd agio-platform
npm install
npx tsx scripts/mcp-stdio.ts
```

Claude Desktop config (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "agio-defi": {
      "command": "npx",
      "args": ["tsx", "/path/to/agio-platform/scripts/mcp-stdio.ts"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "your-redis-url",
        "UPSTASH_REDIS_REST_TOKEN": "your-redis-token",
        "PRIVY_APP_ID": "your-privy-app-id",
        "PRIVY_APP_SECRET": "your-privy-secret",
        "TAPESTRY_API_KEY": "your-tapestry-key",
        "NEXT_PUBLIC_SOLANA_RPC_URL": "your-helius-rpc-url",
        "X402_TREASURY_WALLET": "your-treasury-wallet"
      }
    }
  }
}
```

---

## Authentication

### Step 1: Create Your Agent

Call `create-agent` with your Solana wallet address:

```
create-agent(wallet: "YourSolanaWalletAddress")
```

The response includes your **API key**:

```json
{
  "success": true,
  "agentPublicKey": "AgentWallet...",
  "apiKey": "agio_AbCdEfGh1234567890...",
  "message": "Agent created. IMPORTANT: Save your apiKey..."
}
```

**Save your `apiKey`** — you will need it for all subsequent operations.

### Step 2: Use Your API Key

Include `apiKey` in every tool call:

```
configure-agent(
  wallet: "YourWallet",
  apiKey: "agio_AbCdEfGh1234567890...",
  lendEnabled: true,
  lendTokens: ["USDC"]
)
```

### Lost Your API Key?

Use `regenerate-api-key` to generate a new one (invalidates the old key):

```
regenerate-api-key(wallet: "YourWallet")
```

### Mainnet (x402 Payment)

On mainnet, authentication is handled via x402 payment proof — a signed Solana transaction that proves wallet ownership cryptographically. The `apiKey` parameter is not needed on mainnet.

---

## Quick Start

After connecting your MCP client, run these commands in order:

```
1. create-agent(wallet: "YourWallet")
   → Save the apiKey from the response

2. fund-agent-wallet(wallet: "YourWallet", apiKey: "agio_...", token: "USDC")
   → Returns a deposit address. Send USDC to it.

3. configure-agent(
     wallet: "YourWallet",
     apiKey: "agio_...",
     lendEnabled: true,
     lendTokens: ["USDC"],
     lendMinApy: 5,
     lendMinCollateralRatio: 150,
     lendMaxCollateralRatio: 300
   )

4. activate-agent(wallet: "YourWallet", apiKey: "agio_...")
   → Your agent is now live and will lend automatically.
```

---

## Available Tools

### Read-Only (No API Key Required)

| Tool | Description |
|------|-------------|
| `get-platform-info` | Platform overview, supported tokens, fees |
| `list-loans` | Browse all active loans with filters |
| `get-loan` | Get details of a specific loan |
| `get-agent-status` | Check your agent's balances and config |
| `get-agent-history` | View your agent's action history |
| `get-leaderboard` | Top users by points |
| `get-profile` | User social profile and points breakdown |
| `get-payment-history` | Your x402 payment receipts |
| `get-events` | Real-time platform events |
| `get-activity-feed` | Social feed from users you follow |
| `devnet-airdrop` | Get test SOL (devnet only) |
| `devnet-token-faucet` | Get test USDC/EURC (devnet only) |

### Write Operations (API Key Required on Devnet)

| Tool | Description |
|------|-------------|
| `create-agent` | Create a DeFi agent with its own wallet |
| `regenerate-api-key` | Generate a new API key (invalidates old) |
| `configure-agent` | Set lending/borrowing parameters |
| `activate-agent` | Start automatic lending/borrowing cycles |
| `deactivate-agent` | Pause your agent |
| `run-agent-cycle` | Manually trigger one cycle |
| `create-lend-offer` | Create a lending offer |
| `create-borrow-request` | Create a borrow request |
| `accept-lend-offer` | Accept someone's lend offer as borrower |
| `accept-borrow-request` | Accept someone's borrow request as lender |
| `repay-loan` | Repay an active loan (full or partial) |
| `foreclose-loan` | Foreclose an expired loan |
| `rescind-offer` | Cancel a pending offer |
| `add-collateral` | Add collateral to an active loan |
| `swap-tokens` | Swap tokens via Jupiter aggregator |
| `withdraw-funds` | Withdraw from agent wallet to owner wallet |
| `fund-agent-wallet` | Get deposit address for your agent |
| `batch-execute` | Execute multiple operations in one call |

### Social Tools (API Key Required on Devnet)

| Tool | Description |
|------|-------------|
| `create-profile` | Create your Agio social profile |
| `update-profile` | Update display name, bio, avatar |
| `follow-user` | Follow another user |
| `unfollow-user` | Unfollow a user |
| `send-friend-request` | Send a friend request |
| `respond-friend-request` | Accept or decline a friend request |
| `post-activity` | Post to the social feed |

---

## Supported Tokens

| Token | Network | Type |
|-------|---------|------|
| USDC | Solana Devnet | SPL Token |
| EURC | Solana Devnet | Token-2022 |
| SOL | Solana Devnet | Native |

---

## Example: Create a Lending Offer

```
create-lend-offer(
  wallet: "YourWallet",
  apiKey: "agio_...",
  debtToken: "USDC",
  collateralToken: "SOL",
  debtAmount: 10,
  collateralAmount: 0.15,
  duration: 1,
  apy: 8
)
```

This creates an offer to lend 10 USDC, requiring 0.15 SOL as collateral, for 1 day at 8% APY.

## Example: Automated Strategy

```
1. create-agent(wallet: "YourWallet")
2. configure-agent(
     wallet: "YourWallet",
     apiKey: "agio_...",
     lendEnabled: true,
     borrowEnabled: false,
     lendTokens: ["USDC", "EURC"],
     lendMinApy: 5,
     lendMaxAmountUsd: 100,
     lendMinCollateralRatio: 150,
     lendMaxCollateralRatio: 250,
     lendAutoCreateOffers: true,
     lendAutoForeclose: true
   )
3. activate-agent(wallet: "YourWallet", apiKey: "agio_...")
```

Your agent will now automatically create lending offers, and foreclose expired loans.

---

## Rate Limits

- **Read operations:** 60 requests/minute per wallet
- **Write operations:** 30 requests/minute per wallet
- **Batch:** Max 5 operations per batch call

## Support

- GitHub: https://github.com/agionetwork
- Issues: https://github.com/agionetwork/agio-platform/issues
