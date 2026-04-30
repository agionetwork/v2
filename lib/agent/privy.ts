import { PrivyClient } from "@privy-io/node"
import { createConnection } from "@/lib/program"
import { setAgentWallet, getAgentPrivyWalletId } from "./redis"
import { validateAgentTransaction } from "./tx-validator"

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

export async function createAgentWallet(
  userWallet: string,
): Promise<{ walletId: string; publicKey: string }> {
  const privy = getPrivy()
  const wallet = await privy.wallets().create({ chain_type: "solana" })
  const walletId = wallet.id
  const publicKey = wallet.address

  await setAgentWallet(userWallet, walletId, publicKey)

  return { walletId, publicKey }
}

export async function signAndSendTransaction(
  userWallet: string,
  serializedTx: string, // base64 encoded
): Promise<string> {
  // Security gate: validate all instructions target allowed programs only
  validateAgentTransaction(serializedTx)

  const privy = getPrivy()
  const walletId = await getAgentPrivyWalletId(userWallet)
  if (!walletId) throw new Error("Agent wallet not found")

  // Sign via Privy (without broadcasting) — then we broadcast ourselves
  // through the same RPC that issued the blockhash (Helius) to avoid
  // "Blockhash not found" errors from Privy's internal RPC node
  const signResult = await privy.wallets().solana().signTransaction(walletId, {
    transaction: serializedTx,
  })

  // Broadcast via our own RPC (Helius) to avoid blockhash mismatch
  // between Privy's RPC node and the node that issued the blockhash
  const signedTxBytes = Buffer.from(signResult.signed_transaction, "base64")
  const connection = createConnection()

  const txHash = await connection.sendRawTransaction(signedTxBytes, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  })

  // Confirm the transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed")
  await connection.confirmTransaction(
    { signature: txHash, blockhash, lastValidBlockHeight },
    "confirmed",
  )

  return txHash
}
