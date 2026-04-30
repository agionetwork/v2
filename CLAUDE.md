# Project guidance for Claude Code

This is a hackathon repo (Colosseum Frontier — Private Lending Track) building **Agio Private Lending**: P2P loans with optional ZK privacy via the Cloak SDK on Solana.

## Architecture

- **Frontend**: Next.js 16 (Turbopack), React 19, Tailwind, shadcn/ui — at repo root.
- **Anchor program**: Rust, deployed to devnet at `AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX`. Source under `program/programs/agio/`.
- **Agent system**: Privy server-side wallets + Upstash Redis. Tx allowlist via `lib/agent/tx-validator.ts`.
- **MCP server**: `POST /api/mcp` — 14 tools (6 free, 8 paid via x402 USDC). Stdio wrapper at `scripts/mcp-stdio.ts`.
- **Cloak integration** (this hackathon): wrappers in `lib/cloak/` (to be created), opt-in privacy per loan.

## Critical patterns (don't relitigate)

- `hooks/useLoans.ts` is `'use client'` — server code must import shared types from `lib/loan-utils.ts` instead.
- `LoansProvider` fetches `/api/loans` (server-side route), NOT browser→Helius (avoids CORS/extension issues).
- Privy: `signTransaction` (not `signAndSendTransaction`) + broadcast via our own Helius RPC. Avoids blockhash mismatch.
- MCP transport: `WebStandardStreamableHTTPServerTransport` for Next.js compat.
- x402: `tx.feePayer` doubles as auth (proves wallet ownership without separate signature).
- Anti-replay: Redis 24h TTL keyed on payment signature.
- Pricing: Redis `mcp:pricing:{toolName}` with code defaults.

## Cloak integration rules

- Privacy is **opt-in per loan**, never forced. Agent config: `privacyEnabled` + `privacyMode: "always" | "ask" | "never"` (default `"never"`).
- Always show cost breakdown before user confirms a private loan (origination fee delta, ZK proof costs, relayer fees, total in USD).
- Standard loans use the existing PDA escrow flow unchanged.
- Private loans use Cloak for token movement; Agio program still tracks loan logic (terms, expiry, matching).
- When in doubt, prefer hybrid (private transfers + public escrow) over delaying ship.

## BUG-030 fix (already applied)

The `foreclose_loan_v2` instruction previously called `calculate_liquidation` with `threshold_bps = BPS_DIVISOR`, expecting "always liquidatable" — but that threshold actually requires `col_value <= debt_value` (under-collateralization). Healthy expired loans returned `is_liquidatable=false` and the lender received zero collateral.

Fix: added `force_liquidation: bool` parameter to `calculate_liquidation`. `foreclose_loan_v2` passes `true`; `liquidate_loan` passes `false`. See:
- `program/programs/agio/src/utils/liquidation.rs`
- `program/programs/agio/src/instructions/foreclose_loan_v2.rs`
- `program/programs/agio/src/instructions/liquidate_loan.rs`

Anchor program needs rebuild + redeploy before the demo.

## Conventions

- TypeScript strict mode. ESLint + Prettier in CI.
- Tests via Vitest (`pnpm test`). Anchor tests via `anchor test` from `program/`.
- Don't add comments unless they explain a non-obvious *why* (hidden constraint, workaround, surprising behavior).
- Don't write multi-paragraph docstrings.
- Use markdown links for code refs in chat: `[file.ts:42](path/file.ts#L42)`.

## Useful commands

```bash
pnpm dev                     # frontend on :3000
pnpm test                    # vitest
cd program && anchor build   # build program
cd program && anchor test    # run program tests
```

## Environment

Required env vars (see `env.example`):
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_SOLANA_RPC_URL` (Helius devnet)
- `NEXT_PUBLIC_PROGRAM_ID`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `X402_TREASURY_WALLET`
- `FORECLOSURE_BOT_KEYPAIR` (JSON array)
- `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- *(new)* `CLOAK_API_KEY` or whatever the SDK requires
