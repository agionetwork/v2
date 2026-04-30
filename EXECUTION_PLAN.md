# AGIO NETWORK × CLOAK — Hackathon Execution Plan

**Project:** Agio Private Lending — P2P loans with ZKP privacy on Solana
**Team:** Agio Network Core Team
**Hackathon:** Colosseum Frontier — Private Lending Track
**SDK:** `@cloak.dev/sdk`
**Repo:** github.com/agionetwork/agio-private-lending

---

## 1. Elevator pitch

Agio is a P2P lending protocol on Solana where AI agents autonomously lend, borrow, and manage collateral. Today, every loan is public — wallets, amounts, strategies, all indexed forever. With Cloak integration, Agio becomes the first lending protocol on Solana to offer **optional private loans**: users who need discretion toggle privacy on and get stealth addresses, shielded transfers, and encrypted escrow — paying a small premium for the ZK proof costs. Users who prefer cheap, transparent lending keep the standard mode. Both share the same marketplace, the same agents, the same collateral rules. Compliance teams audit private loans via viewing keys. **Choice, not mandate.**

## 2. Cloak SDK capabilities used

Four of five SDK capabilities, each load-bearing for private mode:

| Capability | How Agio uses it |
|---|---|
| Private Transfers (USDC, USDT, SOL) | Lender funds loan via shielded USDC transfer. Borrower receives debt privately. Repayment + collateral flow through shielded channels. |
| Stealth Addresses | Lender and borrower never see each other's real wallet. Loan matching happens via stealth addresses derived from each party's meta-address. |
| Viewing Keys | Platform compliance: Agio holds a platform viewing key to audit all loans. User compliance: users share viewing keys with auditors/tax advisors. Scoped keys: time-limited keys for regulators. |
| Private Swaps (Orca) | Foreclosure liquidation: SOL→USDC swap goes through Cloak's private Orca integration so liquidation doesn't move the market or signal foreclosure publicly. |

Remove Cloak and private lending is impossible. Public lending continues to work without it.

## 2B. Opt-in privacy model — cost transparency

Privacy is per-loan **choice**, not platform mandate. Agent config:

- `privacyEnabled: bool` (default `false`)
- `privacyMode: "always" | "ask" | "never"` (default `"never"`)

Per-loan UI shows:

```
Standard:  1.0% origination fee — fully public on-chain
Private:   1.5% origination fee + ~0.005 SOL per ZK proof + ~0.001 SOL relayer
           Wallets hidden, amounts encrypted, viewing-key audit
```

Mixed matching: a private offer can match a standard request (privacy preserved on private side only). Standard side pays no premium.

## 3. Architecture (dual mode)

```
Public mode  : User wallet → Agio escrow PDA → on-chain loan (fully visible)
Private mode : User wallet → Cloak shield → stealth address → Agio private escrow
                                                        → viewing-key audit
```

- **Public** uses current Anchor PDA escrow (unchanged).
- **Private** uses Cloak for token movement; Agio program still tracks loan logic (terms, expiry, matching).
- Stealth addresses decouple wallet identity (private mode only).
- Relayer pays gas so stealth addresses never need SOL.

## 4. Timeline (2 weeks)

### Days 1-2 — setup & SDK exploration
- Install Cloak SDK and Claude skills (`npm i @cloak.dev/sdk`, `npx @cloak.dev/claude-skills`)
- Run `/cloak-shield`, `/cloak-send`, `/cloak-pay`, `/cloak-swap`
- Read full SDK docs and API reference
- Test shield → transfer → unshield with USDC

### Days 3-5 — private fund/withdraw
- Add `privacyEnabled` and `privacyMode` to agent config
- Add per-loan privacy toggle with cost breakdown (UI)
- Implement `fund-agent-private`: `createUtxo()` → shielded balance
- Implement `withdraw-private`: `fullWithdraw()` / `partialWithdraw()` to user's stealth address
- Generate stealth meta-address per agent during creation
- Verify on-chain: no link between user wallet and agent

### Days 6-9 — private lending lifecycle
- `create-lend-offer` private mode (offer funded from shielded UTXO; details encrypted)
- `accept-lend-offer` private mode (collateral via `createUtxo`, debt via `transact`)
- Private repayment (debt + interest via `transact` to lender's stealth)
- Private foreclosure (collateral UTXO → lender; optional private SOL→USDC via Cloak/Orca)
- Test full lifecycles: happy path + foreclosure path

### Days 10-11 — viewing key compliance
- Generate platform + user viewing keys per agent/user
- Compliance dashboard: input viewing key → decrypted history table → CSV export
- Scoped (time-limited) viewing key for regulators
- Test full audit trail of a private loan

### Days 12-13 — frontend, UX, polish
- Private loan badge/indicator
- Privacy mode toggle in agent settings
- Shield/unshield progress indicator (proof gen ~2-5s)
- Error handling: insufficient shielded balance, proof timeout, relayer down, invalid viewing key
- Mobile-responsive compliance dashboard
- Landing page section explaining private lending

### Day 14 — demo, README, submission
- Demo video (under 5 min): problem → Agio overview → dual mode → live private flow → standard side-by-side → architecture → opt-in rationale → vision
- Comprehensive README
- Submit to arena.colosseum.org
- Final fresh-wallet test

## 5. Deliverables

**Required:**
- Working live deployment (Vercel)
- Public GitHub repo
- README (problem, SDK usage, setup, deployed links)
- Demo video < 5 min
- Colosseum submission

**Extras:**
- Compliance dashboard with viewing-key input + CSV export
- MCP integration (agents interact via natural language)
- Existing user base (9 active wallets, 20+ loans completed)
- Beta testing history (28+ rounds, 20 bugs fixed, 6 vulns patched)
- Blinks integration for viral distribution

## 6. Tech stack

| Layer | Existing (Agio) | New (Cloak) |
|---|---|---|
| Framework | Next.js 16 (Turbopack) | — |
| Wallets | Privy (agent wallets) | Stealth addresses |
| Chain | Solana Web3.js / Anchor | — |
| Privacy | — | `@cloak.dev/sdk` (Groth16, relayer, Orca) |
| Social | Tapestry | — |
| Oracles | Pyth | — |
| Deploy | Vercel | — |
| AI agent surface | MCP server (14 tools, x402 USDC) | Privacy-aware tools |

Dev tools: Claude Code skills (`/cloak-shield`, `/cloak-send`, `/cloak-pay`, `/cloak-swap`), Colosseum copilot.

## 7. Judging strategy

**Integration depth (40%):** 4 of 5 SDK capabilities, all load-bearing for private mode.

**Product (30%):** not a prototype — production platform with 28+ beta rounds, autonomous agents, real users; privacy added cleanly via dual-mode architecture; cost transparency before user confirms.

**Real-world use (30%):** target = treasuries, DAOs, OTC desks needing on-chain lending without exposing positions. Retail users keep standard mode at lower cost.

## 8. Risks & contingencies

| Risk | Contingency |
|---|---|
| SDK integration harder than expected | Focus on private transfers only (shield/unshield + transact). Skip private swap. |
| Proof generation too slow for demo | Pre-compute proofs before recording; clear loading states. |
| Vercel build issues | Fix three.js dependency before starting. |
| Mainnet USDC costs for demo | Small amounts ($1-5). Budget $20-50 total. |
| Private escrow too complex | Hybrid: private transfers for funding/withdrawal, public escrow for loan collateral. |
| Cloak SDK bug | Document, show workaround in demo. |
| Time runs out | Priority: private transfer > viewing key dashboard > private escrow > private swap. |

**Minimum viable submission:**
1. Private fund/withdraw for agents
2. One private loan lifecycle (lend → borrow → repay)
3. Viewing key audit trail
4. 3-min video + README

## 9. Pre-hackathon blockers

- [x] **BUG-030** (foreclosure collateral not transferred to lender) — fixed in `program/programs/agio/src/utils/liquidation.rs` via `force_liquidation` parameter. Caller `foreclose_loan_v2.rs` now passes `force=true`.
- [ ] Vercel build failure: missing `three` dep — `npm install three @types/three --legacy-peer-deps`
- [ ] 31 npm vulnerabilities — `npm audit fix --legacy-peer-deps`
- [ ] Next.js middleware deprecation — migrate to `proxy` convention

## 10. Links

| | |
|---|---|
| Cloak website | https://cloak.ag |
| Cloak docs | https://docs.cloak.ag/sdk/introduction |
| Cloak quickstart | https://docs.cloak.ag/sdk/quickstart |
| Cloak API ref | https://docs.cloak.ag/sdk/api-reference |
| Cloak GitHub | https://github.com/cloak-ag/ |
| Colosseum portal | https://arena.colosseum.org |
| Colosseum copilot | `npx skills add ColosseumOrg/colosseum-copilot` |
| Agio devnet | https://agio.network |
| Agio program ID | `AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX` |
