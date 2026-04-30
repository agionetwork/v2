import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

// Pyth price feed IDs (from Pyth network)
const PRICE_FEEDS = [
  {
    name: "SOL/USD",
    mint: new PublicKey("So11111111111111111111111111111111111111112"), // wSOL
    feedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    decimals: 9,
  },
  {
    name: "USDC/USD",
    mint: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // devnet USDC
    feedId: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    decimals: 6,
  },
  {
    name: "EURC/USD",
    mint: new PublicKey("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr"), // devnet EURC
    feedId: "76fa85158bf14ede77087fe3ae472f66c0a1e354e2b9b3d7e0e8bde5e2bc5432",
    decimals: 6,
  },
];

function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agio;

  console.log("Program ID:", program.programId.toString());
  console.log("Admin:", provider.wallet.publicKey.toString());

  for (const feed of PRICE_FEEDS) {
    const [priceFeedConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed"), feed.mint.toBuffer()],
      program.programId
    );

    console.log(`\n--- Init PriceFeedConfig: ${feed.name} ---`);
    console.log("  Mint:", feed.mint.toString());
    console.log("  PDA:", priceFeedConfig.toString());
    console.log("  Feed ID:", feed.feedId);
    console.log("  Decimals:", feed.decimals);

    try {
      const feedIdBytes = hexToBytes(feed.feedId);

      const tx = await program.methods
        .initPriceFeedConfig({
          feedId: feedIdBytes,
          decimals: feed.decimals,
        })
        .accounts({
          priceFeedConfig: priceFeedConfig,
          mint: feed.mint,
          admin: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("  PriceFeedConfig initialized. Tx:", tx);
    } catch (error: any) {
      if (error.message?.includes("already in use")) {
        console.log("  PriceFeedConfig already exists, skipping.");
      } else {
        console.log("  Error:", error.message);
      }
    }
  }

  // Verify all configs
  console.log("\n--- Verification ---");
  for (const feed of PRICE_FEEDS) {
    const [priceFeedConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("price_feed"), feed.mint.toBuffer()],
      program.programId
    );

    try {
      const config = await program.account.priceFeedConfig.fetch(priceFeedConfig);
      console.log(`${feed.name}:`);
      console.log("  Mint:", config.mint.toString());
      console.log("  Feed ID:", Buffer.from(config.feedId).toString("hex"));
      console.log("  Decimals:", config.decimals);
    } catch (error: any) {
      console.log(`${feed.name}: Not found -`, error.message);
    }
  }
}

main().catch(console.error);
