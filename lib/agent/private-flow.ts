import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor"
import { fundStealthWallet } from "@/lib/cloak/fund-stealth"
import { loadCloakSdk } from "@/lib/cloak/client"
import { createConnection } from "@/lib/program"
import { TOKEN_MINTS, getTokenDecimals } from "@/lib/token-mints"
import { getAgentPrivyWalletId } from "./redis"
import { createStealthWallet, signAndSendWithStealth } from "./stealth"
import { PrivyCloakAdapter } from "./privy-cloak-adapter"
import {
  buildCreateLendOfferTx,
  buildCreateBorrowRequestTx,
} from "./transaction-builder"
import IDL from "@/lib/idl/agio.json"

/**
 * SOL fee buffer that the stealth wallet needs to pay for tx fees and ATA rent
 * during createLendOffer / createBorrowRequest. Mirrors the user-side flow in
 * hooks/usePrivateLoanFlow.ts.
 */
const STEALTH_SOL_BUFFER = BigInt(0.05 * LAMPORTS_PER_SOL)

interface CommonParams {
  /** Owner wallet that controls the agent (used as namespace for stealth registry). */
  ownerWallet: string
  /** Agent's Privy wallet pubkey (the funder). */
  agentWallet: string
  debtTokenSymbol: string
  collateralTokenSymbol: string
  /** Debt amount in human units (will be scaled by mint decimals for funding). */
  debtAmount: number
  collateralAmount: number
  /** Loan duration in seconds. */
  duration: number
  apy: number
  priceUpdates: { collateralPriceUpdate: PublicKey; debtPriceUpdate: PublicKey }
}

interface PrivateOfferResult {
  txHash: string
  stealthPublicKey: string
  fundShieldSig: string
  fundUnshieldSig: string
  solShieldSig?: string
  solUnshieldSig?: string
}

/**
 * Lender path (agent posts a lend offer through a stealth):
 *   1. Mint a fresh stealth wallet, registered under the owner's wallet so the
 *      user can later see/disclose it from /socialfi/compliance.
 *   2. Cloak shield→unshield the debt amount from the agent's Privy wallet to
 *      the stealth. The agent's pubkey only appears as the depositor of the
 *      shield tx; the unshield tx pays the stealth out of the pool.
 *   3. Cloak shield→unshield a small SOL buffer the same way so the stealth
 *      can pay tx fees + ATA rent without an observable agent → stealth SOL
 *      transfer.
 *   4. Build createLendOffer with the stealth as fee payer + lender; sign via
 *      Privy stealth flow (validated against the agent allowlist).
 */
export async function createPrivateLendOfferAsAgent(
  params: CommonParams,
): Promise<PrivateOfferResult> {
  return runPrivate(params, "lend")
}

/**
 * Borrower path: same orchestration as the lend path, but the stealth posts a
 * borrow request (collateral travels through Cloak instead of debt).
 */
export async function createPrivateBorrowRequestAsAgent(
  params: CommonParams,
): Promise<PrivateOfferResult> {
  return runPrivate(params, "borrow")
}

async function runPrivate(
  p: CommonParams,
  side: "lend" | "borrow",
): Promise<PrivateOfferResult> {
  const connection = createConnection()

  // Step 1 — mint stealth bound to the OWNER (the human user) so they can
  // disclose / audit it later. Even though the agent is operationally driving
  // it, stealth ownership stays with the human.
  const stealth = await createStealthWallet(p.ownerWallet)

  // Resolve the agent's Privy wallet id so we can build the funder adapter.
  const agentWalletId = await getAgentPrivyWalletId(p.ownerWallet)
  if (!agentWalletId) {
    throw new Error("Agent Privy wallet not found for owner " + p.ownerWallet)
  }
  const funder = new PrivyCloakAdapter(agentWalletId, p.agentWallet)
  const stealthPk = new PublicKey(stealth.publicKey)

  // Step 2 — fund stealth with the principal (debt for lend side, collateral
  // for borrow side). When the principal mint is SOL we collapse step 3 into
  // this one shield/unshield since NATIVE_SOL also covers tx fees + ATA rent.
  const principalSymbol = side === "lend" ? p.debtTokenSymbol : p.collateralTokenSymbol
  const principalAmount = side === "lend" ? p.debtAmount : p.collateralAmount
  const principalMint = TOKEN_MINTS[principalSymbol]
  if (!principalMint) throw new Error(`Unknown token mint for ${principalSymbol}`)
  const principalDecimals = getTokenDecimals(principalSymbol)
  const principalRaw = BigInt(Math.round(principalAmount * Math.pow(10, principalDecimals)))

  const sdk = await loadCloakSdk()
  const NATIVE_SOL_MINT: PublicKey = sdk.NATIVE_SOL_MINT
  const principalIsSol = principalMint.equals(NATIVE_SOL_MINT)

  let fundShieldSig: string
  let fundUnshieldSig: string
  let solShieldSig: string | undefined
  let solUnshieldSig: string | undefined

  if (principalIsSol) {
    // Single shield/unshield covers principal + SOL fee buffer.
    const fundResult = await fundStealthWallet({
      connection,
      funderPublicKey: funder.publicKey,
      funderWallet: funder,
      mint: NATIVE_SOL_MINT,
      amount: principalRaw + STEALTH_SOL_BUFFER,
      stealthRecipient: stealthPk,
      onProgress: (s) => console.log(`[agent/private/${side}] sol-fund: ${s}`),
    })
    fundShieldSig = fundResult.shieldSignature
    fundUnshieldSig = fundResult.unshieldSignature
  } else {
    // Two separate shield/unshield round-trips: principal + SOL buffer.
    const principalResult = await fundStealthWallet({
      connection,
      funderPublicKey: funder.publicKey,
      funderWallet: funder,
      mint: principalMint,
      amount: principalRaw,
      stealthRecipient: stealthPk,
      onProgress: (s) => console.log(`[agent/private/${side}] principal-fund: ${s}`),
    })
    fundShieldSig = principalResult.shieldSignature
    fundUnshieldSig = principalResult.unshieldSignature

    const solResult = await fundStealthWallet({
      connection,
      funderPublicKey: funder.publicKey,
      funderWallet: funder,
      mint: NATIVE_SOL_MINT,
      amount: STEALTH_SOL_BUFFER,
      stealthRecipient: stealthPk,
      onProgress: (s) => console.log(`[agent/private/${side}] sol-fund: ${s}`),
    })
    solShieldSig = solResult.shieldSignature
    solUnshieldSig = solResult.unshieldSignature
  }

  // Step 4 — build the Anchor instruction with the stealth as signer + fee payer.
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: stealthPk,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    } as any,
    { commitment: "confirmed" },
  )
  const program = new Program(IDL as unknown as Idl, provider)

  const builderArgs = {
    debtTokenSymbol: p.debtTokenSymbol,
    collateralTokenSymbol: p.collateralTokenSymbol,
    debtAmount: p.debtAmount,
    collateralAmount: p.collateralAmount,
    duration: p.duration,
    apy: p.apy,
  }

  const serializedTx =
    side === "lend"
      ? await buildCreateLendOfferTx(connection, program, stealthPk, builderArgs, p.priceUpdates)
      : await buildCreateBorrowRequestTx(connection, program, stealthPk, builderArgs, p.priceUpdates)

  const txHash = await signAndSendWithStealth(stealth.publicKey, serializedTx)

  return {
    txHash,
    stealthPublicKey: stealth.publicKey,
    fundShieldSig,
    fundUnshieldSig,
    solShieldSig,
    solUnshieldSig,
  }
}
