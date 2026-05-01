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
    { connection, ...signing, relayUrl },
  )

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  // Step 2 — unshield: spend the UTXO into the stealth wallet. From an
  // observer's perspective, this looks like a withdrawal from the Cloak
  // pool to a fresh address. The link to step 1 is broken modulo pool
  // depth and timing analysis.
  const unshielded = await unshield(
    { inputUtxos: [shielded.utxo], mint, amount, toAddress: stealthRecipient },
    { connection, ...signing, relayUrl },
  )

  return {
    shieldSignature: shielded.signature,
    unshieldSignature: unshielded.signature,
    utxo: shielded.utxo,
  }
}
