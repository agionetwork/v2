#!/usr/bin/env npx tsx
/**
 * One-time admin script to configure on-chain protocol fees.
 *
 * Sets the origination fee (1%), NFT discount, and treasury address
 * on the VaultAuthority account via the update_protocol_fees instruction.
 *
 * Usage:
 *   ADMIN_KEYPAIR=/path/to/keypair.json npx tsx scripts/set-protocol-fees.ts
 *
 * Environment variables:
 *   ADMIN_KEYPAIR            — Path to the deployer/admin keypair JSON file
 *   NEXT_PUBLIC_SOLANA_RPC_URL — Helius devnet RPC
 *   NEXT_PUBLIC_PROGRAM_ID   — Program ID (optional, uses default)
 *   X402_TREASURY_WALLET     — Treasury wallet that receives fees
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js"
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor"
import * as fs from "fs"

// Load IDL
import IDL from "../lib/idl/agio.json" assert { type: "json" }

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || "AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX")
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority")

// Fee configuration
const ORIGINATION_FEE_BPS = 100    // 1%
const NFT_DISCOUNT_BPS = 0         // No NFT discount yet
const NFT_COLLECTION: PublicKey | null = null // No NFT collection yet

async function main() {
  // Load admin keypair
  const keypairPath = process.env.ADMIN_KEYPAIR
  if (!keypairPath) {
    console.error("Error: ADMIN_KEYPAIR env var required (path to deployer keypair JSON)")
    process.exit(1)
  }

  const treasuryAddr = process.env.X402_TREASURY_WALLET
  if (!treasuryAddr) {
    console.error("Error: X402_TREASURY_WALLET env var required")
    process.exit(1)
  }
  const treasury = new PublicKey(treasuryAddr)

  const keypairJson = JSON.parse(fs.readFileSync(keypairPath, "utf-8"))
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairJson))

  console.log("Admin:    ", adminKeypair.publicKey.toBase58())
  console.log("Program:  ", PROGRAM_ID.toBase58())
  console.log("Treasury: ", treasury.toBase58())
  console.log("Fee:      ", ORIGINATION_FEE_BPS, "bps (", ORIGINATION_FEE_BPS / 100, "%)")
  console.log("NFT disc: ", NFT_DISCOUNT_BPS, "bps")
  console.log("")

  // Set up connection and program
  const connection = new Connection(RPC_URL, "confirmed")
  const wallet = {
    publicKey: adminKeypair.publicKey,
    signTransaction: async (tx: any) => { tx.partialSign(adminKeypair); return tx },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(adminKeypair)); return txs },
  }
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" })
  const program = new Program(IDL as unknown as Idl, provider)

  // Derive VaultAuthority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync([VAULT_AUTHORITY_SEED], PROGRAM_ID)
  console.log("VaultAuth:", vaultAuthority.toBase58())

  // Read current state
  try {
    const state = await (program.account as any).vaultAuthority.fetch(vaultAuthority)
    console.log("\nCurrent VaultAuthority state:")
    console.log("  origination_fee_bps:", state.originationFeeBps)
    console.log("  nft_discount_bps:   ", state.nftDiscountBps)
    console.log("  nft_collection:     ", state.nftCollection?.toBase58() || "none")
    console.log("  treasury:           ", state.treasury?.toBase58() || "not set")
  } catch (e: any) {
    console.log("\nCould not read current state:", e.message)
  }

  // Call update_protocol_fees
  console.log("\nSending update_protocol_fees transaction...")
  const tx = await (program.methods as any)
    .updateProtocolFees({
      originationFeeBps: ORIGINATION_FEE_BPS,
      nftDiscountBps: NFT_DISCOUNT_BPS,
      nftCollection: NFT_COLLECTION,
      treasury,
    })
    .accounts({
      vaultAuthority,
      admin: adminKeypair.publicKey,
    })
    .signers([adminKeypair])
    .rpc()

  console.log("Transaction:", tx)

  // Verify
  const updated = await (program.account as any).vaultAuthority.fetch(vaultAuthority)
  console.log("\nUpdated VaultAuthority state:")
  console.log("  origination_fee_bps:", updated.originationFeeBps)
  console.log("  nft_discount_bps:   ", updated.nftDiscountBps)
  console.log("  nft_collection:     ", updated.nftCollection?.toBase58() || "none")
  console.log("  treasury:           ", updated.treasury?.toBase58() || "not set")
  console.log("\nDone!")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
