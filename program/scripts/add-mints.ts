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

const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const EURC_MINT = new PublicKey("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr");

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

  const mints = [
    { name: "USDC", mint: USDC_MINT },
    { name: "EURC", mint: EURC_MINT },
  ];

  for (const { name, mint } of mints) {
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      mint,
      vaultAuthority,
      true // allowOwnerOffCurve for PDA
    );

    console.log(`\nAdding ${name} (${mint.toString()})...`);
    console.log(`  Vault ATA: ${vaultTokenAccount.toString()}`);

    try {
      const tx = await program.methods
        .initVaultTokenAccount()
        .accounts({
          vaultAuthority,
          vaultMint: mint,
          vaultTokenAccount,
          admin: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log(`  ${name} added successfully! Tx: ${tx}`);
    } catch (error: any) {
      if (
        error.message?.includes("already in use") ||
        error.message?.includes("already been processed")
      ) {
        console.log(`  ${name} vault token account already exists, skipping.`);
      } else {
        console.error(`  Error adding ${name}:`, error.message || error);
      }
    }
  }

  // Verify the vault authority state
  try {
    const vaultState = await (program.account as any).vaultAuthority.fetch(
      vaultAuthority
    );
    console.log("\nVault Authority allowed_mints:",
      vaultState.allowedMints.map((m: PublicKey) => m.toString())
    );
    console.log("Vault Authority disabled_mints:",
      vaultState.disabledMints.map((m: PublicKey) => m.toString())
    );
  } catch (e: any) {
    console.log("\nCould not fetch vault state:", e.message);
  }
}

main().catch(console.error);
