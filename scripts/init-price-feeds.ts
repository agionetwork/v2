#!/usr/bin/env npx tsx
/**
 * Admin script to initialize PriceFeedConfig PDAs for each supported token.
 *
 * Creates on-chain PriceFeedConfig accounts that map token mints to their
 * Pyth price feed IDs. Required before foreclose_loan_v2 or liquidate_loan
 * can be called.
 *
 * Usage:
 *   ADMIN_KEYPAIR=/path/to/keypair.json npx tsx scripts/init-price-feeds.ts
 *
 * Environment variables:
 *   ADMIN_KEYPAIR            — Path to the deployer/admin keypair JSON file
 *   NEXT_PUBLIC_SOLANA_RPC_URL — Helius devnet RPC
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js"
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor"
import * as fs from "fs"

import IDL from "../lib/idl/agio.json" assert { type: "json" }

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || "AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX")
const PRICE_FEED_SEED = Buffer.from("price_feed")

// Pyth devnet price feed IDs (32-byte hex strings)
// See: https://pyth.network/developers/price-feed-ids
const PRICE_FEEDS = [
  {
    name: "SOL/USD",
    mint: new PublicKey("So11111111111111111111111111111111111111112"), // wSOL
    feedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", // Pyth SOL/USD devnet
    decimals: 9,
  },
  {
    name: "USDC/USD",
    mint: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // devnet USDC
    feedId: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", // Pyth USDC/USD
    decimals: 6,
  },
  {
    name: "EURC/USD",
    mint: new PublicKey("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr"), // devnet EURC
    feedId: "0x76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c", // Pyth EURC/USD
    decimals: 6,
  },
]

function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes: number[] = []
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16))
  }
  return bytes
}

async function main() {
  const keypairPath = process.env.ADMIN_KEYPAIR
  if (!keypairPath) {
    console.error("Error: ADMIN_KEYPAIR env var required (path to deployer keypair JSON)")
    process.exit(1)
  }

  const keypairJson = JSON.parse(fs.readFileSync(keypairPath, "utf-8"))
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairJson))

  console.log("Admin:   ", adminKeypair.publicKey.toBase58())
  console.log("Program: ", PROGRAM_ID.toBase58())
  console.log("RPC:     ", RPC_URL)
  console.log("")

  const connection = new Connection(RPC_URL, "confirmed")
  const wallet = {
    publicKey: adminKeypair.publicKey,
    signTransaction: async (tx: any) => { tx.partialSign(adminKeypair); return tx },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(adminKeypair)); return txs },
  }
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" })
  const program = new Program(IDL as unknown as Idl, provider)

  for (const feed of PRICE_FEEDS) {
    console.log(`--- ${feed.name} ---`)
    console.log(`  Mint:     ${feed.mint.toBase58()}`)
    console.log(`  Feed ID:  ${feed.feedId}`)
    console.log(`  Decimals: ${feed.decimals}`)

    // Derive PriceFeedConfig PDA
    const [priceFeedPda] = PublicKey.findProgramAddressSync(
      [PRICE_FEED_SEED, feed.mint.toBuffer()],
      PROGRAM_ID,
    )
    console.log(`  PDA:      ${priceFeedPda.toBase58()}`)

    // Check if already initialized
    const info = await connection.getAccountInfo(priceFeedPda)
    if (info) {
      console.log(`  Status:   Already initialized (skipping)`)
      console.log("")
      continue
    }

    // Initialize
    try {
      const feedIdBytes = hexToBytes(feed.feedId)
      const tx = await (program.methods as any)
        .initPriceFeedConfig({
          feedId: feedIdBytes,
          decimals: feed.decimals,
        })
        .accounts({
          priceFeedConfig: priceFeedPda,
          mint: feed.mint,
          admin: adminKeypair.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([adminKeypair])
        .rpc()

      console.log(`  Tx:       ${tx}`)
      console.log(`  Status:   Initialized`)
    } catch (err: any) {
      console.error(`  Error:    ${err.message}`)
    }
    console.log("")
  }

  console.log("Done!")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
