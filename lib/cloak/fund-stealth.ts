import type { Connection, Keypair, PublicKey } from "@solana/web3.js"
import { shield, unshield } from "./client"

/**
 * Fund a stealth wallet via a Cloak shield→unshield round-trip.
 *
 *   funder ─shield→ Cloak UTXO ─unshield→ stealth recipient
 *
 * The funder's main wallet only appears as the depositor of the shield tx;
 * the unshield tx pays the stealth recipient out of the Cloak pool, so chain
 * analysis cannot directly link funder → stealth without correlating
 * pool-internal commitments. Privacy strength scales with pool depth and
 * timing jitter — both weak on devnet, strong on mainnet.
 */

export interface FundStealthParams {
  connection: Connection
  /** Funder's keypair (the user's main wallet). Pays the shield deposit + fees. */
  funderKeypair: Keypair
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
  const { connection, funderKeypair, mint, amount, stealthRecipient, delayMs = 0, relayUrl } = params

  // Step 1 — shield: move funds from funder's public wallet into a fresh
  // Cloak UTXO. This tx is signed by the funder; the deposit is publicly
  // visible (linked to funder's main wallet).
  const shielded = await shield(
    { mint, amount },
    {
      connection,
      walletPublicKey: funderKeypair.publicKey,
      depositorKeypair: funderKeypair,
      relayUrl,
    },
  )

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  // Step 2 — unshield: spend the UTXO and send funds to the stealth wallet.
  // From an observer's perspective, this looks like a withdrawal from the
  // Cloak pool to a fresh address, with no on-chain link to step 1.
  const unshielded = await unshield(
    {
      inputUtxos: [shielded.utxo],
      mint,
      amount,
      toAddress: stealthRecipient,
      // We use `fullWithdraw` semantics: take the entire UTXO, no change.
      // partialAmount left undefined.
    },
    {
      connection,
      walletPublicKey: funderKeypair.publicKey,
      depositorKeypair: funderKeypair,
      relayUrl,
    },
  )

  return {
    shieldSignature: shielded.signature,
    unshieldSignature: unshielded.signature,
    utxo: shielded.utxo,
  }
}
