import type { Connection, Keypair, PublicKey } from "@solana/web3.js"
import { shield, unshield } from "./client"
import type { CloakSignerContext } from "./client"

/**
 * Fund a stealth wallet via a Cloak shield→unshield round-trip.
 *
 *   funder ─shield→ Cloak UTXO ─unshield→ stealth recipient
 *
 * The funder's main wallet only appears as the depositor of the shield tx;
 * the unshield tx pays the stealth recipient out of the Cloak pool, so chain
 * analysis cannot directly link funder → stealth without correlating
 * pool-internal commitments. Privacy strength scales with pool depth and
 * timing jitter.
 *
 * Network: see `lib/cloak/client.ts` — the wrapper picks `@cloak.dev/sdk-devnet`
 * when running on devnet RPC and `@cloak.dev/sdk` (mainnet) otherwise.
 */

export interface FundStealthParams {
  connection: Connection
  /** Public key of the funder (user's main wallet). */
  funderPublicKey: PublicKey
  /** Funder's keypair — Node/server flows. Mutually exclusive with funderWallet. */
  funderKeypair?: Keypair
  /** Funder's wallet adapter — browser flows (Privy, Phantom, etc.). */
  funderWallet?: any
  /** Mint of the token being moved (e.g. USDC, NATIVE_SOL_MINT). */
  mint: PublicKey
  /** Amount in raw units (smallest token units). */
  amount: bigint
  /** Public key of the stealth wallet that will receive the unshielded balance. */
  stealthRecipient: PublicKey
  /** Optional delay (ms) between shield and unshield. Adds timing entropy. */
  delayMs?: number
  /** Override the relay URL. Rare. */
  relayUrl?: string
  /** Status updates from the Cloak SDK (relay calls, signing, etc.). */
  onProgress?: (status: string) => void
  /** ZK proof generation progress 0-100. */
  onProofProgress?: (percent: number) => void
}

export interface FundStealthResult {
  shieldSignature: string
  unshieldSignature: string
  /** Cloak UTXO created during shield (consumed by unshield). Diagnostics only. */
  utxo: any
}

export async function fundStealthWallet(params: FundStealthParams): Promise<FundStealthResult> {
  const {
    connection,
    funderPublicKey,
    funderKeypair,
    funderWallet,
    mint,
    amount,
    stealthRecipient,
    delayMs = 0,
    relayUrl,
    onProgress,
    onProofProgress,
  } = params

  if (!funderKeypair && !funderWallet) {
    throw new Error("fundStealthWallet requires either funderKeypair or funderWallet")
  }

  const signing: CloakSignerContext = {
    walletPublicKey: funderPublicKey,
    ...(funderKeypair ? { depositorKeypair: funderKeypair } : {}),
    ...(funderWallet ? { wallet: funderWallet } : {}),
  }

  // Step 1 — shield: move funds from funder's public wallet into a fresh
  // Cloak UTXO. The deposit is publicly visible (linked to funder).
  const shielded = await shield(
    { mint, amount },
    {
      connection,
      ...signing,
      relayUrl,
      onProgress: onProgress ? (s) => onProgress(`shield: ${s}`) : undefined,
      onProofProgress,
    },
  )

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  // Wait for the relay indexer to pick up our just-deposited commitment.
  // Without this we hit "Local note commitment does not match relay tree at
  // index N — note index is stale" when the unshield is fast enough that the
  // relay's tree is still pre-deposit. We poll the relay's commitments list
  // until it returns at least `commitmentIndex + 1` leaves OR until our
  // commitment hex appears.
  await waitForRelayCommitment({
    relayUrl,
    commitment: shielded.utxo?.commitment,
    minIndex: shielded.commitmentIndex,
    onProgress,
  })

  // Step 2 — unshield: spend the UTXO into the stealth wallet. From an
  // observer's perspective, this looks like a withdrawal from the Cloak
  // pool to a fresh address. The link to step 1 is broken modulo pool
  // depth and timing analysis.
  const unshielded = await unshield(
    { inputUtxos: [shielded.utxo], mint, amount, toAddress: stealthRecipient },
    {
      connection,
      ...signing,
      relayUrl,
      onProgress: onProgress ? (s) => onProgress(`unshield: ${s}`) : undefined,
      onProofProgress,
    },
  )

  return {
    shieldSignature: shielded.signature,
    unshieldSignature: unshielded.signature,
    utxo: shielded.utxo,
  }
}

/**
 * Poll the relay's commitments endpoint until the just-deposited commitment
 * is indexed (or `minIndex + 1` leaves are reachable). Bails after `timeoutMs`
 * with an error so callers can retry — silently waiting forever is worse than
 * a clear failure.
 */
async function waitForRelayCommitment(opts: {
  relayUrl?: string
  commitment?: bigint
  minIndex?: number
  onProgress?: (status: string) => void
  timeoutMs?: number
  pollMs?: number
}): Promise<void> {
  const {
    relayUrl,
    commitment,
    minIndex,
    onProgress,
    timeoutMs = 60_000,
    pollMs = 1500,
  } = opts
  const base =
    relayUrl ??
    (typeof window !== "undefined"
      ? window.location.origin + "/api/cloak-proxy/relay"
      : "https://api.devnet.cloak.ag")
  const target = minIndex !== undefined && minIndex >= 0 ? minIndex + 1 : 1
  const commitHex = commitment !== undefined ? toHex64(commitment) : null

  const deadline = Date.now() + timeoutMs
  let attempt = 0
  while (Date.now() < deadline) {
    attempt++
    try {
      const res = await fetch(`${base}/commitments?_t=${Date.now()}`)
      if (res.ok) {
        const body = await res.json().catch(() => null) as any
        const leaves: string[] | undefined =
          body?.commitments ?? body?.leaves ?? body?.data ?? body
        if (Array.isArray(leaves)) {
          const hit = commitHex
            ? leaves.includes(commitHex)
            : leaves.length >= target
          if (hit) {
            onProgress?.(
              `relay-sync: indexed (${leaves.length} leaves, attempt ${attempt})`,
            )
            return
          }
          onProgress?.(
            `relay-sync: ${leaves.length} leaves, waiting for ` +
              (commitHex ? `commitment ${commitHex.slice(0, 12)}…` : `index ${target - 1}`) +
              ` (attempt ${attempt})`,
          )
        }
      } else {
        onProgress?.(`relay-sync: HTTP ${res.status} (attempt ${attempt})`)
      }
    } catch (err: any) {
      onProgress?.(
        `relay-sync: fetch failed (${err?.message ?? err}, attempt ${attempt})`,
      )
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }
  throw new Error(
    `Relay did not index our commitment within ${timeoutMs}ms. The deposit ` +
      `succeeded on-chain but the relay's Merkle tree is lagging — retry the ` +
      `withdrawal in a moment.`,
  )
}

function toHex64(n: bigint): string {
  const h = n.toString(16)
  return h.length >= 64 ? h : "0".repeat(64 - h.length) + h
}
