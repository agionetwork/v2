/**
 * x402 Client Helper — reference SDK for constructing x402 payment transactions.
 *
 * External agents or clients can use these utilities to:
 * 1. Parse the PaymentRequirement returned by paid tools
 * 2. Build a signed transfer transaction for the chosen payment token
 * 3. Serialize it to base64 for use as paymentProof
 *
 * This module is NOT used internally by the MCP server — it's provided as
 * a convenience for clients integrating with Agio's x402 payment system.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js"
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token"
import type { PaymentOption, PaymentRequirement } from "./x402-verify"

export interface ParsedPaymentOption {
  token: string
  mint: PublicKey
  recipient: PublicKey
  recipientTokenAccount: PublicKey
  amountRaw: bigint
  amountUi: number
  decimals: number
  type: "spl" | "native"
}

/**
 * Parse a PaymentRequirement into structured payment options.
 */
export function parsePaymentRequirement(
  requirement: PaymentRequirement,
): ParsedPaymentOption[] {
  return requirement.acceptedPayments.map((opt) => ({
    token: opt.token,
    mint: new PublicKey(opt.mint),
    recipient: new PublicKey(requirement.recipient),
    recipientTokenAccount: new PublicKey(opt.recipientTokenAccount),
    amountRaw: BigInt(opt.amountRaw),
    amountUi: opt.amountUi,
    decimals: opt.decimals,
    type: opt.type,
  }))
}

/**
 * Build a payment transaction for a specific token option.
 *
 * @param payer - The wallet public key that will sign and pay
 * @param option - The parsed payment option to use
 * @param blockhash - Recent blockhash for the transaction
 * @returns Unsigned Transaction ready to be signed
 */
export function buildPaymentTransaction(
  payer: PublicKey,
  option: ParsedPaymentOption,
  blockhash: string,
): Transaction {
  const tx = new Transaction()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer

  if (option.type === "native") {
    // SOL transfer
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: option.recipient,
        lamports: option.amountRaw,
      }),
    )
  } else {
    // SPL token transfer
    const sourceAta = getAssociatedTokenAddressSync(option.mint, payer)
    const destAta = option.recipientTokenAccount

    // Create destination ATA if needed (idempotent)
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        destAta,
        option.recipient,
        option.mint,
      ),
    )

    tx.add(
      createTransferInstruction(
        sourceAta,
        destAta,
        payer,
        option.amountRaw,
      ),
    )
  }

  return tx
}

/**
 * Complete helper: build a payment transaction for the cheapest available option.
 *
 * @param connection - Solana RPC connection
 * @param payer - Wallet public key
 * @param requirement - PaymentRequirement from a paid tool response
 * @param preferredToken - Optional preferred token ("USDC", "EURC", "SOL")
 * @returns Unsigned Transaction ready to be signed
 */
export async function buildX402PaymentTx(
  connection: Connection,
  payer: PublicKey,
  requirement: PaymentRequirement,
  preferredToken?: string,
): Promise<Transaction> {
  const options = parsePaymentRequirement(requirement)

  // Use preferred token if available, otherwise default to first (USDC)
  const option = preferredToken
    ? options.find((o) => o.token === preferredToken) || options[0]
    : options[0]

  const { blockhash } = await connection.getLatestBlockhash("confirmed")
  return buildPaymentTransaction(payer, option, blockhash)
}
