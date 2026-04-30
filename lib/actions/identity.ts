import { Keypair } from "@solana/web3.js"

let _actionIdentity: Keypair | null = null

export function getActionIdentity(): Keypair | undefined {
  if (_actionIdentity) return _actionIdentity

  const raw = process.env.ACTION_IDENTITY_KEYPAIR
  if (!raw) return undefined

  try {
    _actionIdentity = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
    return _actionIdentity
  } catch {
    console.warn("Invalid ACTION_IDENTITY_KEYPAIR env var")
    return undefined
  }
}
