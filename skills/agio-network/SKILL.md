---
name: agio-network
description: |
  Use when the user wants to discover, lend, borrow, or interact with peer-to-peer loans on
  Solana — signals: "find a loan", "lend USDC", "borrow against SOL", "DeFi yield on Solana",
  "Agio", "private lending", "P2P loan", "agent that auto-lends", "stake my collateral",
  "earn on idle USDC". Connects to the Agio Network MCP server (37 tools, JSON-RPC 2.0) at
  https://app.agio.network/api/mcp and walks through HTTP and STDIO transport, x402 USDC
  payment for paid tools, and the most common workflows (browse marketplace, create offer,
  accept, repay, foreclose, autonomous agent).
version: 1.0.0
user-invocable: true
license: MIT
compatibility: Any MCP-capable agent (Claude Code, Claude Desktop, ChatGPT MCP, Cursor)
metadata:
  author: Agio Network
  homepage: https://agio.network
  docs: https://agio.network/docs
  mcp_endpoint: https://app.agio.network/api/mcp
  program_id: AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX
  tags: solana, defi, lending, p2p, mcp, x402, privacy, cloak, stealth, lst
---

# Agio Network — P2P Lending on Solana

## What this skill is for

Agio is a peer-to-peer lending protocol on Solana — every loan is a **direct 1-to-1 contract** between a lender and a borrower with custom APY, duration, collateral ratio, and token. There are **no liquidity pools** (no shared-risk drains), **no oracle aggregator manipulations** beyond Pyth, and the protocol exposes itself to AI agents through a 37-tool MCP server.

Use this skill when the user wants to:

- Browse, filter, or analyze open loan offers
- Lend USDC/EURC and earn yield
- Borrow against SOL / agioSOL collateral without liquidating
- Spin up an autonomous agent that lends/borrows on a schedule
- Explore the platform's privacy options (Cloak ZK stealth wallets) or 1-to-1 exclusive offers
- Build an integration that calls the Agio MCP

If the user is just asking **conceptually** about DeFi without a clear intent to interact, point them at the docs first: https://agio.network/docs.

## Connecting to the MCP server

### Option A — Direct HTTP (recommended for production)

The endpoint is **stateless** JSON-RPC 2.0 over HTTP. One POST per call, no session.

```
POST https://app.agio.network/api/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
```

The `Accept` header MUST include both `application/json` and `text/event-stream` — the MCP transport sometimes responds as SSE for streaming tool output.

Example handshake (initialize → list tools → call):

```bash
curl -X POST https://app.agio.network/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0"}}}'

curl -X POST https://app.agio.network/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

curl -X POST https://app.agio.network/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list-loans","arguments":{"status":"pending","debtToken":"USDC","limit":10}}}'
```

### Option B — STDIO bridge (Claude Desktop / local agents)

The repo ships [`scripts/mcp-stdio.ts`](https://github.com/agionetwork/agio-private-lending/blob/main/scripts/mcp-stdio.ts) which runs the same server over stdio. Wire it into `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "agio": {
      "command": "npx",
      "args": ["tsx", "/path/to/agio-private-lending/scripts/mcp-stdio.ts"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "...",
        "UPSTASH_REDIS_REST_TOKEN": "...",
        "PRIVY_APP_ID": "...",
        "PRIVY_APP_SECRET": "...",
        "TAPESTRY_API_KEY": "...",
        "NEXT_PUBLIC_SOLANA_RPC_URL": "...",
        "X402_TREASURY_WALLET": "..."
      }
    }
  }
}
```

The HTTP endpoint is the right choice for any non-local agent. STDIO is mainly for self-hosting.

## Tool quick reference (top 8)

| Tool | Cost | Purpose |
|---|---|---|
| `get-platform-info` | Free | **Always call this first.** Returns pricing model, x402 token mints, supported lending tokens, agent setup flow, fee formulas. |
| `list-loans` | Free | Browse marketplace. Filters: `status` (pending/active/repaid/foreclosed/rescinded), `offerType` (lend/borrow), `debtToken` (USDC/EURC/SOL), `wallet`, `limit` (max 100). |
| `get-loan` | Free | Single loan details by `loanPublicKey`. Includes accrued interest, collateral ratio, counterparty resolution. |
| `create-lend-offer` | Free MCP, 1% on-chain origination | Post a lending offer. Requires `wallet`, `debtToken`, `debtAmount`, `apy`, `duration` (seconds), `collateralToken`, `collateralAmount`. |
| `accept-borrow-request` | Free MCP, 1% on-chain | Take an existing borrow request as the lender. Atomic: collateral → vault, debt → borrower. |
| `repay-loan` | Free | Full or partial repayment. Program adds accrued interest internally. |
| `create-agent` | $0.10 USDC (x402) | Spin up a Privy-managed autonomous agent wallet. Returns API key + agent pubkey. |
| `swap-tokens` | 0.05% volume (x402) | Jupiter-routed token swap. Useful before lending/borrowing to obtain the right token. |

**Full 37-tool catalog with parameters and return shapes:** [https://agio.network/skill/tools.md](https://agio.network/skill/tools.md).

## x402 payment for paid tools

Only **two tools** require payment in the v2 pricing model:
- `create-agent` — $0.10 USDC flat
- `swap-tokens` — 0.05% of swap volume (min $0.01, max $10.00)

Everything else is free. The 1% origination fee mentioned for lending tools is collected **on-chain at acceptance**, not via x402.

When you call a paid tool **without** a `paymentProof`, the server returns a `PaymentRequirement` JSON describing 3 acceptable token options (USDC / EURC / SOL with live Jupiter quotes). You build a Solana transfer transaction targeting the listed `recipientTokenAccount`, sign it, base64-encode, and resubmit the tool call with `paymentProof: "<base64-tx>"`.

The flow + a complete TypeScript example using the helpers in [`lib/mcp/x402-client.ts`](https://github.com/agionetwork/agio-private-lending/blob/main/lib/mcp/x402-client.ts) is in [https://agio.network/skill/x402-payment.md](https://agio.network/skill/x402-payment.md). Anti-replay (SHA-256 hash, 24h Redis TTL) and settlement timing are documented there too.

**Devnet shortcut:** if the server is configured with `DEVNET_FREE_TOOLS=true` and the RPC URL contains `devnet`, paid tools become free — pass `wallet` instead of `paymentProof`. Useful for iterating before mainnet.

## Common workflows

Three end-to-end recipes are in [https://agio.network/skill/workflows.md](https://agio.network/skill/workflows.md):

1. **Browse and accept a loan** — `list-loans` → `get-loan` → `accept-lend-offer` (or `accept-borrow-request`).
2. **Create autonomous agent** — `create-agent` → `fund-agent-wallet` → `configure-agent` → `activate-agent` → poll `get-agent-status`.
3. **Full lender lifecycle** — `create-lend-offer` → wait for acceptance → monitor → `foreclose-loan` if borrower defaults.

Each workflow includes pitfalls (e.g., `PriceFeedStale 6030` if Pyth update is older than 300s; under-collateralization triggers automatic `rescind-undercollateralized-offer` from the keeper bot).

## Privacy modes

Agio has two independent privacy mechanisms — **don't conflate them**:

- **Private Mode (Cloak ZK)** — funds your loan position from a fresh stealth wallet via a Cloak shield+unshield round-trip. The on-chain `loan.lender` (or `loan.borrower`) is the stealth pubkey, breaking the link to your real wallet. Marketplace lists the offer publicly but the creator is anonymous. Full details: https://agio.network/docs/private-mode.
- **Exclusive Counterparty** — adds an `exclusive_counterparty` field on the loan account so only one specific wallet pubkey can accept. The Anchor program enforces it; everyone else's accept tx reverts. The offer is **hidden** from the public marketplace and shows up only on the targeted user's "Available Offers" tab. Details: https://agio.network/docs/exclusive-counterparty.

Both can be combined (private creator + exclusive recipient).

## $agioSOL collateral discount

When collateral is `$agioSOL` (Agio's LST), origination fee drops from 100 bps to 50 bps and the user keeps the underlying ~7% staking yield while the loan is active. Use it whenever the borrower can substitute SOL with agioSOL. Details: https://agio.network/docs/agiosol.

## Devnet vs mainnet

The MCP endpoint serves **mainnet by default**. Devnet is exposed when `NEXT_PUBLIC_SOLANA_RPC_URL` includes `devnet` server-side. There's no separate URL — the same `/api/mcp` endpoint serves whichever cluster the deployment is configured for.

When working on devnet:
- Use `devnet-airdrop` tool for SOL (rate-limited 60s).
- Use `devnet-token-faucet` for USDC/EURC (rate-limited 10/24h, Circle API).
- Pyth feed accounts are devnet-specific — `get-platform-info` returns the right mints.
- Program ID is the same: `AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX`.

## Common errors

| Code | Cause | Fix |
|---|---|---|
| `PriceFeedStale` (6030 / `0x178e`) | Pyth `PriceUpdateV2` account >300s old, or its `feed_id` doesn't match the on-chain `PriceFeedConfig` PDA. | Server posts fresh prices automatically; if it persists, check that the server's `postPricesForTokens` call uses the correct (debtToken, collateralToken) order. |
| `LenderMismatch` / `BorrowerMismatch` | Signer ≠ the wallet stored on the loan. | For exclusive offers, only the named counterparty can accept. |
| `CollateralRatioTooLow` | Live oracle price made the collateral fall below the 130% accept threshold. | Add collateral via `add-collateral` or wait for price recovery. |
| `LoanNotExpired` | Trying to foreclose before `start + duration`. | Wait until expiration. |
| `NumericalOverflowError` | Math overflow inside the program. | Reduce amounts; report if it persists with realistic numbers. |

## Pointers

- **Live app:** https://agio.network
- **Docs (4 languages):** https://agio.network/docs
- **MCP setup guide:** https://agio.network/docs/mcp
- **Source repo:** https://github.com/agionetwork/agio-private-lending
- **Solana program ID:** `AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX` (same on devnet + mainnet)
- **Issues / questions:** https://github.com/agionetwork/agio-private-lending/issues

## Progressive disclosure

Read these only when needed — `SKILL.md` covers the 80% case:

- [https://agio.network/skill/tools.md](https://agio.network/skill/tools.md) — full 37-tool catalog with parameters, return shapes, and per-tool notes.
- [https://agio.network/skill/x402-payment.md](https://agio.network/skill/x402-payment.md) — x402 payment flow, transaction structure, anti-replay, settlement, full TypeScript example.
- [https://agio.network/skill/workflows.md](https://agio.network/skill/workflows.md) — end-to-end recipes for browse-accept, autonomous agent setup, and full lender lifecycle.
