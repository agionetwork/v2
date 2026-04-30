import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agio;

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    program.programId
  );

  const wsolVaultAta = getAssociatedTokenAddressSync(
    WSOL_MINT,
    vaultAuthority,
    true // allowOwnerOffCurve for PDA
  );

  console.log("Program ID:", program.programId.toString());
  console.log("Vault Authority PDA:", vaultAuthority.toString());
  console.log("wSOL Vault ATA:", wsolVaultAta.toString());

  // Check if it already exists
  const info = await provider.connection.getAccountInfo(wsolVaultAta);
  if (info) {
    console.log("wSOL vault token account already exists, skipping.");
    return;
  }

  console.log("Creating wSOL vault token account...");
  try {
    const tx = await program.methods
      .initVaultTokenAccount()
      .accounts({
        vaultAuthority,
        vaultMint: WSOL_MINT,
        vaultTokenAccount: wsolVaultAta,
        admin: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("wSOL vault ATA created. Tx:", tx);
  } catch (error: any) {
    console.error("Error:", error.message || error);
  }

  // Verify
  const vault = await (program.account as any).vaultAuthority.fetch(vaultAuthority);
  console.log("\nAllowed mints:", vault.allowedMints.map((m: PublicKey) => m.toString()));
}

main().catch(console.error);
