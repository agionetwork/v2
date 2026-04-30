import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

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

  try {
    const tx = await program.methods
      .initVaultAuthority()
      .accounts({
        vaultAuthority: vaultAuthority,
        admin: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("Vault authority initialized. Tx:", tx);
  } catch (error: any) {
    if (error.message?.includes("already in use")) {
      console.log("Vault authority already initialized, skipping.");
    } else {
      throw error;
    }
  }
}

main().catch(console.error);
