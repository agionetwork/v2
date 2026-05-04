import { Transaction, VersionedTransaction, PublicKey } from "@solana/web3.js"
import { PrivyClient } from "@privy-io/node"

let privyClient: PrivyClient | null = null

function getPrivy(): PrivyClient {
  if (privyClient) return privyClient
  const appId = process.env.PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET are required")
  }
  privyClient = new PrivyClient({ appId, appSecret })
  return privyClient
}

/**
 * Wallet-adapter shim that lets the Cloak SDK sign with a Privy-managed
 * server-side wallet (the agent's wallet, not the user's connected wallet).
 *
 * Trust boundary: this adapter signs whatever transaction Cloak hands it. We
 * do NOT run it through tx-validator because the Cloak SDK constructs shield/
 * unshield instructions that target the Cloak program (not in the agent
 * allowlist). Trusting the SDK is the same trust assumption the user-side
 * browser flow already makes when it signs Cloak txs from a connected wallet.
 *
 * Use ONLY for Cloak shield/unshield calls. For Agio program calls (createLendOffer,
 * etc.) the executor still goes through signAndSendTransaction or
 * signAndSendWithStealth, both of which DO validate.
 */
export class PrivyCloakAdapter {
  readonly publicKey: PublicKey
  readonly walletId: string

  constructor(walletId: string, publicKey: string | PublicKey) {
    this.walletId = walletId
    this.publicKey = typeof publicKey === "string" ? new PublicKey(publicKey) : publicKey
  }

  /**
   * Signs a single transaction. Accepts both legacy and versioned transactions.
   * Returns the same transaction class with Privy's signature attached.
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    const isVersioned = tx instanceof VersionedTransaction
    const serialized = Buffer.from(
      isVersioned
        ? (tx as VersionedTransaction).serialize()
        : (tx as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false }),
    ).toString("base64")

    const signResult = await getPrivy()
      .wallets()
      .solana()
      .signTransaction(this.walletId, { transaction: serialized })

    const signedBytes = Buffer.from(signResult.signed_transaction, "base64")
    if (isVersioned) {
      return VersionedTransaction.deserialize(signedBytes) as T
    }
    return Transaction.from(signedBytes) as T
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    const out: T[] = []
    for (const tx of txs) out.push(await this.signTransaction(tx))
    return out
  }
}
