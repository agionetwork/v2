import { describe, it, expect } from "vitest"
import nacl from "tweetnacl"
import { Keypair } from "@solana/web3.js"
import { verifyWalletSignature } from "@/lib/agent/auth"

function signMessage(keypair: Keypair, message: string): string {
  const messageBytes = new TextEncoder().encode(message)
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey)
  return Buffer.from(signature).toString("base64")
}

describe("verifyWalletSignature", () => {
  const keypair = Keypair.generate()
  const wallet = keypair.publicKey.toBase58()
  const message = `agio-auth:${wallet}`
  const signature = signMessage(keypair, message)

  it("returns true for a valid signature", () => {
    expect(verifyWalletSignature(wallet, signature, message)).toBe(true)
  })

  it("returns false for an invalid signature", () => {
    const badSig = Buffer.from("x".repeat(64)).toString("base64")
    expect(verifyWalletSignature(wallet, badSig, message)).toBe(false)
  })

  it("returns false when wallet does not match signer", () => {
    const otherKeypair = Keypair.generate()
    const otherWallet = otherKeypair.publicKey.toBase58()
    // Signature was made by `keypair`, but verifying against `otherWallet`
    expect(verifyWalletSignature(otherWallet, signature, message)).toBe(false)
  })

  it("returns false for malformed inputs", () => {
    expect(verifyWalletSignature("", signature, message)).toBe(false)
    expect(verifyWalletSignature(wallet, "", message)).toBe(false)
    expect(verifyWalletSignature(wallet, "not-base64!!!", message)).toBe(false)
    expect(verifyWalletSignature("not-a-pubkey", signature, message)).toBe(false)
  })
})
