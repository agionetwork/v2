# Agio Private Lending

P2P lending on Solana with **optional ZK privacy via Cloak**. Built for the Colosseum Frontier Hackathon — Private Lending Track.

> Agio is a P2P lending protocol where AI agents lend, borrow, and manage collateral. With Cloak integration, every loan is **opt-in private**: stealth addresses, shielded transfers, viewing-key audit. Standard public loans still work — users choose per loan.

- **Live demo:** https://agio.network
- **Program ID (devnet):** `AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX`
- **Hackathon plan:** [EXECUTION_PLAN.md](EXECUTION_PLAN.md)

## Repo layout

```
agio-private-lending/
├── app/                Next.js 16 frontend + API routes
├── components/         React UI components
├── lib/
│   ├── agent/          Privy-based lending bot agents
│   ├── mcp/            MCP server (14 tools, x402 USDC payments)
│   ├── cloak/          Cloak SDK wrappers (private transfers, stealth, viewing keys)
│   └── ...
├── hooks/              React hooks (loans, prices, profiles)
├── public/             Static assets
├── scripts/            Build, deploy, MCP stdio bridge
├── program/            Anchor program (Rust) — agio lending protocol
│   ├── programs/agio/  Source (instructions, state, utils)
│   ├── tests/          Anchor tests
│   └── Anchor.toml
└── EXECUTION_PLAN.md   Hackathon execution plan
```

## Quick start

```bash
# Install
pnpm install

# Frontend (devnet)
cp env.example .env.local
# Edit .env.local: NEXT_PUBLIC_PRIVY_APP_ID, RPC_URL, etc.
pnpm dev

# Anchor program (separate workspace)
cd program
pnpm install
anchor build
anchor test
```

## Key features

### Dual-mode lending (the Cloak integration)

Every loan can be Standard or Private. User chooses per-loan; agent config sets default.

| | Standard | Private |
|---|---|---|
| On-chain visibility | Wallets, amounts, terms public | Stealth addresses, encrypted amounts |
| Origination fee | 1.0% | 1.5% (+0.5% privacy premium) |
| ZK proof costs | none | ~0.005 SOL per proof |
| Relayer fees | none | ~0.001 SOL per tx |
| Audit | block explorer | viewing key (platform, user, scoped) |

Cloak SDK capabilities used: **Private Transfers**, **Stealth Addresses**, **Viewing Keys**, **Private Swaps (Orca)**.

### Lending bot agents

Each user can launch a Privy-managed server-side wallet that scans the offer book and lends/borrows on their behalf. Transaction allowlist (`lib/agent/tx-validator.ts`) restricts the agent to Agio program instructions.

### MCP server with x402 payments

`POST /api/mcp` exposes 14 tools — 6 free read-only, 8 paid via x402 USDC. Any MCP client (Claude Desktop, Cursor, custom) can read protocol state for free and pay USDC to act.

## Status (hackathon checklist)

See [EXECUTION_PLAN.md](EXECUTION_PLAN.md) section 4 for the day-by-day timeline. Pre-hackathon blockers tracked in section 9.

## License

MIT
