import { PublicKey } from "@solana/web3.js"

export function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

/**
 * Validate that a string is a valid Solana wallet address (base58, on ed25519 curve).
 * Throws with a user-friendly message if invalid.
 */
export function validateWalletAddress(wallet: string): void {
  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    throw new Error(
      `Invalid wallet address: "${wallet}". A Solana wallet address must be a 32-44 character base58 string.`,
    )
  }
  try {
    new PublicKey(wallet)
  } catch {
    throw new Error(
      `Invalid wallet address: "${wallet}". Must be a valid Solana base58 public key.`,
    )
  }
}
