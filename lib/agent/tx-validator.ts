import { Transaction, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { PROGRAM_ID } from "@/config/solana"

const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey("ComputeBudget111111111111111111111111111111")

// Jupiter v6 Aggregator and related programs
const JUPITER_V6_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKB3QNJr2h36NmqXSqdNmV3UNYymFg")

/**
 * Allowlist of program IDs the agent wallet is permitted to interact with.
 * Any transaction containing instructions targeting programs outside this list
 * will be rejected before signing — preventing the agent from operating on
 * arbitrary DeFi protocols.
 */
const ALLOWED_PROGRAM_IDS: PublicKey[] = [
  PROGRAM_ID,                    // Agio lending program
  SystemProgram.programId,       // SOL transfers, account creation
  TOKEN_PROGRAM_ID,              // SPL token transfers
  TOKEN_2022_PROGRAM_ID,         // Token-2022 (EURC, Token Extensions)
  ASSOCIATED_TOKEN_PROGRAM_ID,   // ATA creation
  SYSVAR_RENT_PUBKEY,            // Rent sysvar
  SYSVAR_CLOCK_PUBKEY,           // Clock sysvar
  COMPUTE_BUDGET_PROGRAM_ID,     // Compute budget (priority fees)
  JUPITER_V6_PROGRAM_ID,        // Jupiter Aggregator v6 (token swaps)
]

const allowedSet = new Set(ALLOWED_PROGRAM_IDS.map((pk) => pk.toBase58()))

/**
 * Set of serialized transaction hashes that have been pre-approved as
 * Jupiter swap transactions. Using a Set instead of a global boolean
 * avoids race conditions in concurrent environments — each swap only
 * exempts its own specific transaction.
 */
const jupiterApprovedTxs = new Set<string>()

/**
 * Mark a specific serialized transaction as a Jupiter swap, exempting it
 * from the strict program allowlist. The marker is consumed on use.
 */
export function markAsJupiterSwap(serializedTx: string): void {
  jupiterApprovedTxs.add(serializedTx)
}

/**
 * Validates that every instruction in a serialized transaction only targets
 * programs in the allowlist. This is the core security gate ensuring the
 * agent wallet can ONLY operate on the Agio platform and Jupiter swaps.
 *
 * @throws Error if any instruction targets a disallowed program
 */
export function validateAgentTransaction(serializedTx: string): void {
  // Check if this specific transaction was pre-approved as a Jupiter swap.
  // Consume the marker so it can't be reused.
  if (jupiterApprovedTxs.has(serializedTx)) {
    jupiterApprovedTxs.delete(serializedTx)
    return
  }

  const buffer = Buffer.from(serializedTx, "base64")
  const tx = Transaction.from(buffer)

  for (const ix of tx.instructions) {
    const programId = ix.programId.toBase58()
    if (!allowedSet.has(programId)) {
      throw new Error(
        `Transaction blocked: instruction targets unauthorized program ${programId}. ` +
        `Agent wallet can only interact with the Agio platform.`,
      )
    }
  }
}
