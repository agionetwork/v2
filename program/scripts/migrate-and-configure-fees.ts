import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agio;

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    program.programId
  );

  console.log("Program ID:", program.programId.toString());
  console.log("Vault Authority PDA:", vaultAuthority.toString());
  console.log("Admin:", provider.wallet.publicKey.toString());

  // Step 1: Migrate vault authority (realloc + init new fields)
  console.log("\n--- Step 1: Migrate Vault Authority ---");
  try {
    const tx = await program.methods
      .migrateVaultAuthority()
      .accounts({
        vaultAuthority: vaultAuthority,
        admin: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Vault authority migrated. Tx:", tx);
  } catch (error: any) {
    console.log("Migration error:", error.message);
  }

  // Step 2: Configure protocol fees (1% origination fee)
  console.log("\n--- Step 2: Configure Protocol Fees ---");
  try {
    const tx = await program.methods
      .updateProtocolFees({
        originationFeeBps: 100,       // 1% fee
        nftDiscountBps: 5000,         // 50% discount for NFT holders
        nftCollection: null,          // No NFT collection configured yet
        treasury: provider.wallet.publicKey,  // Admin wallet as treasury for now
      })
      .accounts({
        vaultAuthority: vaultAuthority,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    console.log("Protocol fees configured. Tx:", tx);
    console.log("  Origination fee: 1% (100 bps)");
    console.log("  NFT discount: 50% (5000 bps)");
    console.log("  Treasury:", provider.wallet.publicKey.toString());
  } catch (error: any) {
    console.log("Fee configuration error:", error.message);
  }

  // Step 3: Verify
  console.log("\n--- Step 3: Verify ---");
  try {
    const vault = await program.account.vaultAuthority.fetch(vaultAuthority);
    console.log("Vault Authority state:");
    console.log("  Version:", vault.version);
    console.log("  Origination fee:", vault.originationFeeBps, "bps");
    console.log("  NFT discount:", vault.nftDiscountBps, "bps");
    console.log("  NFT collection:", vault.nftCollection?.toString() || "None");
    console.log("  Treasury:", vault.treasury.toString());
    console.log("  Liquidation threshold:", vault.liquidationThresholdBps, "bps");
  } catch (error: any) {
    console.log("Verification error:", error.message);
  }
}

main().catch(console.error);
