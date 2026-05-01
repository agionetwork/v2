import { PrivyClient } from "@privy-io/node"
import { createConnection } from "@/lib/program"
import { getRedis } from "./redis"
import { validateAgentTransaction } from "./tx-validator"

/**
 * Stealth-wallet management for the privacy mode (Option A2).
 *
 * A stealth wallet is a fresh Privy server-side wallet, owned by a user but
 * not publicly linked to their primary wallet. The link between user and
 * stealth lives entirely server-side in Redis, never on-chain.
 *
 * The user funds the stealth wallet via a Cloak shield→unshield round-trip
 * (see `lib/cloak/fund-stealth.ts`). After funding the stealth signs Anchor
 * txs (createLendOffer, etc.) so on-chain `loan.lender` is the stealth pubkey.
 */

let _privy: PrivyClient | null = null
function getPrivy(): PrivyClient {
  if (!_privy) {
    _privy = new PrivyClient({
      appId: process.env.PRIVY_APP_ID!,
      appSecret: process.env.PRIVY_APP_SECRET!,
    })
  }
  return _privy
}

const STEALTH_PRIVY_KEY = (pk: string) => `stealth:${pk}:privyWalletId`
const STEALTH_OWNER_KEY = (pk: string) => `stealth:${pk}:owner`
const USER_STEALTHS_SET = (userWallet: string) => `user:${userWallet}:stealths`

export interface StealthWalletRef {
  walletId: string
  publicKey: string
}

/** Mint a fresh Privy wallet, register it as belonging to `userWallet`. */
export async function createStealthWallet(userWallet: string): Promise<StealthWalletRef> {
  const privy = getPrivy()
  const wallet = await privy.wallets().create({ chain_type: "solana" })
  const ref = { walletId: wallet.id, publicKey: wallet.address }

  const redis = getRedis()
  await Promise.all([
    redis.set(STEALTH_PRIVY_KEY(ref.publicKey), ref.walletId),
    redis.set(STEALTH_OWNER_KEY(ref.publicKey), userWallet),
    redis.sadd(USER_STEALTHS_SET(userWallet), ref.publicKey),
  ])

  return ref
}

export async function getStealthWalletsForUser(userWallet: string): Promise<string[]> {
  const members = await getRedis().smembers(USER_STEALTHS_SET(userWallet))
  return Array.isArray(members) ? members : []
}

export async function getStealthOwner(stealthPubkey: string): Promise<string | null> {
  return getRedis().get<string>(STEALTH_OWNER_KEY(stealthPubkey))
}

async function getStealthWalletId(stealthPubkey: string): Promise<string | null> {
  return getRedis().get<string>(STEALTH_PRIVY_KEY(stealthPubkey))
}

/**
 * Sign a base64 serialized transaction with the stealth wallet, then broadcast
 * via our own Helius RPC (same pattern as the agent flow — avoids blockhash
 * mismatches with Privy's internal RPC).
 *
 * The tx is validated against the agent allowlist before signing. The
 * stealth wallet should never be allowed to sign arbitrary instructions.
 */
export async function signAndSendWithStealth(
  stealthPubkey: string,
  serializedTx: string,
): Promise<string> {
  validateAgentTransaction(serializedTx)

  const walletId = await getStealthWalletId(stealthPubkey)
  if (!walletId) throw new Error(`Stealth wallet not found for ${stealthPubkey}`)

  const signResult = await getPrivy().wallets().solana().signTransaction(walletId, {
    transaction: serializedTx,
  })
  const signedTxBytes = Buffer.from(signResult.signed_transaction, "base64")
  const connection = createConnection()

  const txHash = await connection.sendRawTransaction(signedTxBytes, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  })
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")
  await connection.confirmTransaction(
    { signature: txHash, blockhash, lastValidBlockHeight },
    "confirmed",
  )
  return txHash
}
