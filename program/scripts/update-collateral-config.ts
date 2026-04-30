import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

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

  // Read current state first
  console.log("\n--- Current State ---");
  const vault = await program.account.vaultAuthority.fetch(vaultAuthority);
  console.log("  min_apy:", vault.minApy);
  console.log("  max_apy:", vault.maxApy);
  console.log("  min_collateral_ratio_bps:", vault.minCollateralRatioBps);
  console.log("  max_collateral_ratio_bps:", vault.maxCollateralRatioBps);

  // Update: set min_collateral_ratio_bps to 13000 (130%)
  // Keep existing values for other fields
  console.log("\n--- Updating Protocol Config ---");
  const tx = await program.methods
    .updateProtocolConfig({
      minApy: vault.minApy,
      maxApy: vault.maxApy,
      minCollateralRatioBps: 13000,    // 130% — accept threshold
      maxCollateralRatioBps: vault.maxCollateralRatioBps,
    })
    .accounts({
      vaultAuthority: vaultAuthority,
      admin: provider.wallet.publicKey,
    })
    .rpc();

  console.log("Config updated. Tx:", tx);

  // Verify
  console.log("\n--- New State ---");
  const updated = await program.account.vaultAuthority.fetch(vaultAuthority);
  console.log("  min_apy:", updated.minApy);
  console.log("  max_apy:", updated.maxApy);
  console.log("  min_collateral_ratio_bps:", updated.minCollateralRatioBps);
  console.log("  max_collateral_ratio_bps:", updated.maxCollateralRatioBps);
}

main().catch(console.error);
