import nacl from "tweetnacl"
import { PublicKey } from "@solana/web3.js"

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return address.length >= 32 && address.length <= 44
  } catch {
    return false
  }
}

export function verifyWalletSignature(
  wallet: string,
  signature: string, // base64
  message: string,
): boolean {
  try {
    const publicKey = new PublicKey(wallet)
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = Buffer.from(signature, "base64")
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes())
  } catch {
    return false
  }
}
