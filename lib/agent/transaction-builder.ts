import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js"
import { BN, Program } from "@coral-xyz/anchor"
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { PROGRAM_ID, SOLANA_CONFIG } from "@/config/solana"
import { getTokenMint, getTokenDecimals, getTokenProgram, getTokenProgramForMint, resolveTokenProgram } from "@/lib/token-mints"
import type { ParsedLoan } from "@/lib/loan-utils"

const VAULT_AUTHORITY_SEED = Buffer.from(SOLANA_CONFIG.VAULT_AUTHORITY_SEED)
const LOAN_SEED = Buffer.from(SOLANA_CONFIG.LOAN_SEED)
const PRICE_FEED_SEED = Buffer.from("price_feed")
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112")
const MIN_DURATION_SECONDS = 86400 // 1 day minimum

function deriveVaultAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([VAULT_AUTHORITY_SEED], PROGRAM_ID)
  return pda
}

function deriveLoanPda(createKey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [LOAN_SEED, createKey.toBuffer()],
    PROGRAM_ID,
  )
  return pda
}

function derivePriceFeedConfig(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [PRICE_FEED_SEED, mint.toBuffer()],
    PROGRAM_ID,
  )
  return pda
}

function isWsol(mint: PublicKey): boolean {
  return mint.equals(WSOL_MINT)
}

/** SystemProgram.transfer + SyncNative — wraps SOL into an existing wSOL ATA */
function wrapSolIxs(from: PublicKey, wsolAta: PublicKey, lamports: number): TransactionInstruction[] {
  return [
    SystemProgram.transfer({ fromPubkey: from, toPubkey: wsolAta, lamports }),
    createSyncNativeInstruction(wsolAta),
  ]
}

/** CloseAccount — unwraps wSOL back to native SOL */
function unwrapSolIx(wsolAta: PublicKey, destination: PublicKey, authority: PublicKey): TransactionInstruction {
  return createCloseAccountInstruction(wsolAta, destination, authority)
}

/**
 * Ensure an ATA exists for the given mint/owner. Returns the resolved ATA
 * address and an optional create instruction.
 *
 * For Token-2022 mints (EURC), the ATA may exist at either:
 *   - The default (TOKEN_PROGRAM_ID seed) address — used by most wallets/tools
 *   - The Token-2022 (TOKEN_2022_PROGRAM_ID seed) address — canonical
 *
 * We check both. If neither exists, create at the canonical Token-2022 address.
 */
async function ensureAtaExistsIx(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  allowOwnerOffCurve = false,
  _tokenProgramId?: PublicKey, // ignored — resolved dynamically from mint account
): Promise<{ ix: TransactionInstruction | null; ata: PublicKey; tokenProgram: PublicKey }> {
  // Always query the actual on-chain mint owner (cached after first call)
  const progId = await resolveTokenProgram(connection, mint)

  // For Token-2022 mints, check default derivation first (most wallets use this)
  if (!progId.equals(TOKEN_PROGRAM_ID)) {
    const defaultAta = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve)
    const defaultInfo = await connection.getAccountInfo(defaultAta)
    if (defaultInfo) return { ix: null, ata: defaultAta, tokenProgram: progId }
  }

  // Check canonical derivation
  const ata = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve, progId)
  const info = await connection.getAccountInfo(ata)
  if (info) return { ix: null, ata, tokenProgram: progId }

  // Neither exists — create at canonical address
  return {
    ix: createAssociatedTokenAccountIdempotentInstruction(payer, ata, owner, mint, progId),
    ata,
    tokenProgram: progId,
  }
}

/**
 * Fetch VaultAuthority fee config and build remaining_accounts for on-chain fee collection.
 * Returns empty arrays when origination_fee_bps === 0 (no fee).
 */
async function getFeeAccounts(
  connection: Connection,
  program: Program,
  debtMint: PublicKey,
  payer: PublicKey,
): Promise<{ remainingAccounts: AccountMeta[]; preIxs: TransactionInstruction[] }> {
  const vaultAuthorityPda = deriveVaultAuthority()
  try {
    const va = await (program.account as any).vaultAuthority.fetch(vaultAuthorityPda)
    if (!va.originationFeeBps || va.originationFeeBps === 0) {
      return { remainingAccounts: [], preIxs: [] }
    }
    const treasury = va.treasury as PublicKey
    const preIxs: TransactionInstruction[] = []
    // Ensure treasury ATA exists (resolves Token-2022 dual derivation)
    const { ix: ataIx, ata: treasuryDebtAta } = await ensureAtaExistsIx(connection, debtMint, treasury, payer)
    if (ataIx) preIxs.push(ataIx)
    return {
      remainingAccounts: [
        { pubkey: treasury, isWritable: true, isSigner: false },
        { pubkey: treasuryDebtAta, isWritable: true, isSigner: false },
      ],
      preIxs,
    }
  } catch {
    // VaultAuthority not found or fee not set — proceed without fee
    return { remainingAccounts: [], preIxs: [] }
  }
}

async function buildAndSerialize(
  connection: Connection,
  feePayer: PublicKey,
  instructions: TransactionInstruction[],
  signers: Keypair[] = [],
): Promise<{ serializedTx: string; signers: Keypair[] }> {
  const tx = new Transaction()
  const { blockhash } = await connection.getLatestBlockhash("confirmed")
  tx.recentBlockhash = blockhash
  tx.feePayer = feePayer

  for (const ix of instructions) {
    tx.add(ix)
  }

  // Partial sign with any extra signers (e.g. createKey)
  if (signers.length > 0) {
    tx.partialSign(...signers)
  }

  const serialized = tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64")

  return { serializedTx: serialized, signers }
}

// Agent as LENDER: accepts a borrow request (borrower posted, needs lender)
// Mirrors acceptLendOffer from useLoanContract
// Token flow: lender sends debt tokens directly to borrower
export async function buildAcceptBorrowRequestTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  loan: ParsedLoan,
  priceAccounts: {
    collateralPriceUpdate: PublicKey
    debtPriceUpdate: PublicKey
  },
): Promise<string> {
  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const borrowerPk = new PublicKey(loan.borrower!)
  const debtIsWsol = isWsol(debtMint)

  // Derive PriceFeedConfig PDAs
  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(debtMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (checks both default and Token-2022 derivations for EURC)
  const { ix: ix1, ata: lenderDebtAta, tokenProgram: debtTokenProgram } = await ensureAtaExistsIx(connection, debtMint, agentPubkey, agentPubkey)
  if (ix1) preIxs.push(ix1)
  const { ix: ix2, ata: borrowerDebtAta } = await ensureAtaExistsIx(connection, debtMint, borrowerPk, agentPubkey)
  if (ix2) preIxs.push(ix2)

  // wSOL: wrap SOL into lender's ATA, unwrap after transfer
  if (debtIsWsol) {
    const lamports = Math.round(loan.debtAmountUi * 10 ** getTokenDecimals(loan.debtTokenSymbol))
    preIxs.push(...wrapSolIxs(agentPubkey, lenderDebtAta, lamports))
    postIxs.push(unwrapSolIx(lenderDebtAta, agentPubkey, agentPubkey))
  }

  // Fee accounts: treasury + treasury ATA for on-chain origination fee
  const { remainingAccounts, preIxs: feePreIxs } = await getFeeAccounts(connection, program, debtMint, agentPubkey)
  preIxs.push(...feePreIxs)

  const ix = await (program.methods as any)
    .acceptLendOffer()
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      lenderDebtTokenAccount: lenderDebtAta,
      borrowerDebtTokenAccount: borrowerDebtAta,
      collateralPriceFeedConfig,
      debtPriceFeedConfig,
      collateralPriceUpdate: priceAccounts.collateralPriceUpdate,
      debtPriceUpdate: priceAccounts.debtPriceUpdate,
      lender: agentPubkey,
      borrower: borrowerPk,
      tokenProgram: debtTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .remainingAccounts(remainingAccounts)
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs])
  return serializedTx
}

// Agent as BORROWER: accepts a lend offer (lender posted, needs borrower)
// Mirrors acceptBorrowOffer from useLoanContract
// Token flow: vault sends debt to borrower, borrower sends collateral to vault
export async function buildAcceptLendOfferTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  loan: ParsedLoan,
  priceAccounts: {
    collateralPriceUpdate: PublicKey
    debtPriceUpdate: PublicKey
  },
): Promise<string> {
  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const vaultAuthority = deriveVaultAuthority()
  const debtIsWsol = isWsol(debtMint)
  const collateralIsWsol = isWsol(collateralMint)

  // Derive PriceFeedConfig PDAs
  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(debtMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (checks both default and Token-2022 derivations for EURC)
  const { ix: ix1, ata: vaultDebtAta } = await ensureAtaExistsIx(connection, debtMint, vaultAuthority, agentPubkey, true)
  if (ix1) preIxs.push(ix1)
  const { ix: ix2, ata: borrowerDebtAta } = await ensureAtaExistsIx(connection, debtMint, agentPubkey, agentPubkey)
  if (ix2) preIxs.push(ix2)
  const { ix: ix3, ata: vaultCollateralAta, tokenProgram: collateralTokenProgram } = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, agentPubkey, true)
  if (ix3) preIxs.push(ix3)
  const { ix: ix4, ata: borrowerCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, agentPubkey, agentPubkey)
  if (ix4) preIxs.push(ix4)

  // wSOL collateral: borrower wraps SOL to send to vault
  if (collateralIsWsol) {
    const lamports = Math.round(loan.collateralAmountUi * 10 ** getTokenDecimals(loan.collateralTokenSymbol))
    preIxs.push(...wrapSolIxs(agentPubkey, borrowerCollateralAta, lamports))
    postIxs.push(unwrapSolIx(borrowerCollateralAta, agentPubkey, agentPubkey))
  }

  // wSOL debt: borrower receives wSOL from vault, unwrap to native SOL
  if (debtIsWsol) {
    postIxs.push(unwrapSolIx(borrowerDebtAta, agentPubkey, agentPubkey))
  }

  // Fee accounts: treasury + treasury ATA for on-chain origination fee
  const { remainingAccounts, preIxs: feePreIxs } = await getFeeAccounts(connection, program, debtMint, agentPubkey)
  preIxs.push(...feePreIxs)

  const ix = await (program.methods as any)
    .acceptBorrowOffer()
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      vaultAuthority,
      vaultDebtTokenAccount: vaultDebtAta,
      vaultCollateralTokenAccount: vaultCollateralAta,
      borrowerDebtTokenAccount: borrowerDebtAta,
      borrowerCollateralTokenAccount: borrowerCollateralAta,
      collateralPriceFeedConfig,
      debtPriceFeedConfig,
      collateralPriceUpdate: priceAccounts.collateralPriceUpdate,
      debtPriceUpdate: priceAccounts.debtPriceUpdate,
      borrower: agentPubkey,
      tokenProgram: collateralTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .remainingAccounts(remainingAccounts)
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs])
  return serializedTx
}

// Agent as LENDER: creates a lend offer (create_borrow_offer instruction)
// Token flow: lender deposits debt tokens into vault
export async function buildCreateLendOfferTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  params: {
    debtTokenSymbol: string
    collateralTokenSymbol: string
    debtAmount: number
    collateralAmount: number
    duration: number // seconds
    apy: number
  },
  priceAccounts: {
    collateralPriceUpdate: PublicKey
    debtPriceUpdate: PublicKey
  },
): Promise<string> {
  if (params.debtAmount < 1.0) {
    throw new Error(`Minimum loan amount is $1.00. Got: $${params.debtAmount.toFixed(2)}`)
  }
  if (params.duration < MIN_DURATION_SECONDS) {
    throw new Error(`Minimum loan duration is 1 day (${MIN_DURATION_SECONDS}s), got ${params.duration}s`)
  }
  const createKey = Keypair.generate()
  const loanPda = deriveLoanPda(createKey.publicKey)
  const debtMint = getTokenMint(params.debtTokenSymbol)
  const collateralMint = getTokenMint(params.collateralTokenSymbol)
  const debtDecimals = getTokenDecimals(params.debtTokenSymbol)
  const collateralDecimals = getTokenDecimals(params.collateralTokenSymbol)
  const vaultAuthority = deriveVaultAuthority()
  const debtIsWsol = isWsol(debtMint)

  // Derive PriceFeedConfig PDAs
  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(debtMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (dynamically resolves token program from on-chain mint)
  const { ix: ix1, ata: vaultDebtAta, tokenProgram: debtTokenProgram } = await ensureAtaExistsIx(connection, debtMint, vaultAuthority, agentPubkey, true)
  if (ix1) preIxs.push(ix1)
  const { ix: ix2, ata: lenderDebtAta } = await ensureAtaExistsIx(connection, debtMint, agentPubkey, agentPubkey)

  // wSOL: lender wraps SOL to deposit into vault
  if (debtIsWsol) {
    const lamports = Math.round(params.debtAmount * 10 ** debtDecimals)
    preIxs.push(...wrapSolIxs(agentPubkey, lenderDebtAta, lamports))
    postIxs.push(unwrapSolIx(lenderDebtAta, agentPubkey, agentPubkey))
  }

  const ix = await (program.methods as any)
    .createBorrowOffer({
      debtAmount: new BN(Math.round(params.debtAmount * 10 ** debtDecimals)),
      collateralAmount: new BN(Math.round(params.collateralAmount * 10 ** collateralDecimals)),
      duration: new BN(params.duration),
      apy: params.apy,
      isPrivate: false,
      borrower: null,
    })
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      vaultAuthority,
      vaultDebtTokenAccount: vaultDebtAta,
      lenderDebtTokenAccount: lenderDebtAta,
      collateralPriceFeedConfig,
      debtPriceFeedConfig,
      collateralPriceUpdate: priceAccounts.collateralPriceUpdate,
      debtPriceUpdate: priceAccounts.debtPriceUpdate,
      createKey: createKey.publicKey,
      lender: agentPubkey,
      tokenProgram: debtTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs], [createKey])
  return serializedTx
}

// Agent as BORROWER: creates a borrow request (create_lend_offer instruction)
// Token flow: borrower deposits collateral into vault
export async function buildCreateBorrowRequestTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  params: {
    debtTokenSymbol: string
    collateralTokenSymbol: string
    debtAmount: number
    collateralAmount: number
    duration: number
    apy: number
  },
  priceAccounts: {
    collateralPriceUpdate: PublicKey
    debtPriceUpdate: PublicKey
  },
): Promise<string> {
  if (params.debtAmount < 1.0) {
    throw new Error(`Minimum loan amount is $1.00. Got: $${params.debtAmount.toFixed(2)}`)
  }
  if (params.duration < MIN_DURATION_SECONDS) {
    throw new Error(`Minimum loan duration is 1 day (${MIN_DURATION_SECONDS}s), got ${params.duration}s`)
  }
  const createKey = Keypair.generate()
  const loanPda = deriveLoanPda(createKey.publicKey)
  const debtMint = getTokenMint(params.debtTokenSymbol)
  const collateralMint = getTokenMint(params.collateralTokenSymbol)
  const collateralDecimals = getTokenDecimals(params.collateralTokenSymbol)
  const debtDecimals = getTokenDecimals(params.debtTokenSymbol)
  const vaultAuthority = deriveVaultAuthority()
  const collateralIsWsol = isWsol(collateralMint)

  // Derive PriceFeedConfig PDAs
  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(debtMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (dynamically resolves token program from on-chain mint)
  const { ix: ix1, ata: vaultCollateralAta, tokenProgram: collateralTokenProgram } = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, agentPubkey, true)
  if (ix1) preIxs.push(ix1)
  const { ix: ix2, ata: borrowerCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, agentPubkey, agentPubkey)
  if (ix2) preIxs.push(ix2)

  // wSOL: borrower wraps SOL to deposit as collateral into vault
  if (collateralIsWsol) {
    const lamports = Math.round(params.collateralAmount * 10 ** collateralDecimals)
    preIxs.push(...wrapSolIxs(agentPubkey, borrowerCollateralAta, lamports))
    postIxs.push(unwrapSolIx(borrowerCollateralAta, agentPubkey, agentPubkey))
  }

  const ix = await (program.methods as any)
    .createLendOffer({
      debtAmount: new BN(Math.round(params.debtAmount * 10 ** debtDecimals)),
      collateralAmount: new BN(Math.round(params.collateralAmount * 10 ** collateralDecimals)),
      duration: new BN(params.duration),
      apy: params.apy,
      isPrivate: false,
      lender: null,
    })
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      vaultAuthority,
      vaultCollateralTokenAccount: vaultCollateralAta,
      borrowerCollateralTokenAccount: borrowerCollateralAta,
      collateralPriceFeedConfig,
      debtPriceFeedConfig,
      collateralPriceUpdate: priceAccounts.collateralPriceUpdate,
      debtPriceUpdate: priceAccounts.debtPriceUpdate,
      createKey: createKey.publicKey,
      borrower: agentPubkey,
      tokenProgram: collateralTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs], [createKey])
  return serializedTx
}

// Agent as LENDER: forecloses an expired loan
// Token flow: vault sends collateral to lender
export async function buildForecloseLoanTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  loan: ParsedLoan,
): Promise<string> {
  const loanPda = new PublicKey(loan.publicKey)
  const collateralMint = new PublicKey(loan.collateralMint)
  const vaultAuthority = deriveVaultAuthority()
  const collateralIsWsol = isWsol(collateralMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (dynamically resolves token program from on-chain mint)
  const { ix: ix1, ata: lenderCollateralAta, tokenProgram: colTokenProgram } = await ensureAtaExistsIx(connection, collateralMint, agentPubkey, agentPubkey)
  if (ix1) preIxs.push(ix1)
  const { ata: vaultCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, agentPubkey, true)

  // wSOL: lender receives collateral as wSOL, unwrap to native SOL
  if (collateralIsWsol) {
    postIxs.push(unwrapSolIx(lenderCollateralAta, agentPubkey, agentPubkey))
  }

  const ix = await (program.methods as any)
    .forecloseLoan()
    .accounts({
      loan: loanPda,
      collateralMint,
      vaultAuthority,
      vaultCollateralTokenAccount: vaultCollateralAta,
      lenderCollateralTokenAccount: lenderCollateralAta,
      lender: agentPubkey,
      tokenProgram: colTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs])
  return serializedTx
}

// Agent as LENDER: rescinds a borrow offer (gets debt tokens back from vault)
export async function buildRescindBorrowOfferTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  loan: ParsedLoan,
): Promise<string> {
  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const vaultAuthority = deriveVaultAuthority()
  const debtIsWsol = isWsol(debtMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (dynamically resolves token program from on-chain mint)
  const { ix: ix1, ata: lenderDebtAta, tokenProgram: debtTokProg } = await ensureAtaExistsIx(connection, debtMint, agentPubkey, agentPubkey)
  if (ix1) preIxs.push(ix1)
  const { ata: vaultDebtAta } = await ensureAtaExistsIx(connection, debtMint, vaultAuthority, agentPubkey, true)

  // wSOL: lender receives debt back as wSOL, unwrap to native SOL
  if (debtIsWsol) {
    postIxs.push(unwrapSolIx(lenderDebtAta, agentPubkey, agentPubkey))
  }

  const ix = await (program.methods as any)
    .rescindBorrowOffer()
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      vaultAuthority,
      vaultDebtTokenAccount: vaultDebtAta,
      lenderDebtTokenAccount: lenderDebtAta,
      lender: agentPubkey,
      tokenProgram: debtTokProg,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs])
  return serializedTx
}

// Agent as BORROWER: rescinds a lend offer (gets collateral back from vault)
export async function buildRescindLendOfferTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  loan: ParsedLoan,
): Promise<string> {
  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const vaultAuthority = deriveVaultAuthority()
  const collateralIsWsol = isWsol(collateralMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (dynamically resolves token program from on-chain mint)
  const { ix: ix1, ata: borrowerCollateralAta, tokenProgram: colTokProg } = await ensureAtaExistsIx(connection, collateralMint, agentPubkey, agentPubkey)
  if (ix1) preIxs.push(ix1)
  const { ata: vaultCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, agentPubkey, true)

  // wSOL: borrower receives collateral back as wSOL, unwrap to native SOL
  if (collateralIsWsol) {
    postIxs.push(unwrapSolIx(borrowerCollateralAta, agentPubkey, agentPubkey))
  }

  const ix = await (program.methods as any)
    .rescindLendOffer()
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      vaultAuthority,
      vaultCollateralTokenAccount: vaultCollateralAta,
      borrowerCollateralTokenAccount: borrowerCollateralAta,
      borrower: agentPubkey,
      tokenProgram: colTokProg,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs])
  return serializedTx
}

// Agent as BORROWER: repays a loan
// Token flow: borrower sends debt to lender, vault returns collateral to borrower
export async function buildRepayLoanTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  loan: ParsedLoan,
  repayAmount: number,
): Promise<string> {
  // On-chain repay_amount must be <= remaining debt_amount (principal only).
  // The program calculates and transfers interest internally on full repay.
  // Cap to prevent rejection when callers include interest or buffer in repayAmount.
  const cappedRepayAmount = Math.min(repayAmount, loan.debtAmountUi)

  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const lenderPk = new PublicKey(loan.lender!)
  const vaultAuthority = deriveVaultAuthority()
  const debtDecimals = getTokenDecimals(loan.debtTokenSymbol)
  const debtIsWsol = isWsol(debtMint)
  const collateralIsWsol = isWsol(collateralMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (dynamically resolves token program from on-chain mint)
  const { ix: ix1, ata: borrowerDebtAta, tokenProgram: debtTokProg } = await ensureAtaExistsIx(connection, debtMint, agentPubkey, agentPubkey)
  if (ix1) preIxs.push(ix1)
  const { ix: ix2, ata: lenderDebtAta } = await ensureAtaExistsIx(connection, debtMint, lenderPk, agentPubkey)
  if (ix2) preIxs.push(ix2)
  const { ix: ix3, ata: borrowerCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, agentPubkey, agentPubkey)
  if (ix3) preIxs.push(ix3)
  const { ata: vaultCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, agentPubkey, true)

  // wSOL debt: borrower wraps SOL to repay, unwrap leftover
  if (debtIsWsol) {
    const lamports = Math.round(cappedRepayAmount * 10 ** debtDecimals)
    preIxs.push(...wrapSolIxs(agentPubkey, borrowerDebtAta, lamports))
    postIxs.push(unwrapSolIx(borrowerDebtAta, agentPubkey, agentPubkey))
  }

  // wSOL collateral: borrower receives collateral back as wSOL, unwrap
  if (collateralIsWsol) {
    postIxs.push(unwrapSolIx(borrowerCollateralAta, agentPubkey, agentPubkey))
  }

  const ix = await (program.methods as any)
    .repayLoan({
      repayAmount: new BN(Math.round(cappedRepayAmount * 10 ** debtDecimals)),
    })
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      vaultAuthority,
      vaultCollateralTokenAccount: vaultCollateralAta,
      borrowerCollateralTokenAccount: borrowerCollateralAta,
      borrowerDebtTokenAccount: borrowerDebtAta,
      lenderDebtTokenAccount: lenderDebtAta,
      lender: lenderPk,
      borrower: agentPubkey,
      tokenProgram: debtTokProg,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs])
  return serializedTx
}

// Borrower adds more collateral to an active loan
// Token flow: borrower sends additional collateral to vault
export async function buildAddCollateralTx(
  connection: Connection,
  program: Program,
  agentPubkey: PublicKey,
  loan: ParsedLoan,
  addAmount: number,
): Promise<string> {
  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const vaultAuthority = deriveVaultAuthority()
  const collateralDecimals = getTokenDecimals(loan.collateralTokenSymbol)
  const collateralIsWsol = isWsol(collateralMint)
  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve ATAs (dynamically resolves token program from on-chain mint)
  const { ix: ix1, ata: borrowerCollateralAta, tokenProgram: colTokProg } = await ensureAtaExistsIx(connection, collateralMint, agentPubkey, agentPubkey)
  if (ix1) preIxs.push(ix1)
  const { ix: ix2, ata: vaultCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, agentPubkey, true)
  if (ix2) preIxs.push(ix2)

  // wSOL: borrower wraps SOL to add as collateral
  if (collateralIsWsol) {
    const lamports = Math.round(addAmount * 10 ** collateralDecimals)
    preIxs.push(...wrapSolIxs(agentPubkey, borrowerCollateralAta, lamports))
    postIxs.push(unwrapSolIx(borrowerCollateralAta, agentPubkey, agentPubkey))
  }

  const ix = await (program.methods as any)
    .addCollateral({
      addAmount: new BN(Math.round(addAmount * 10 ** collateralDecimals)),
    })
    .accounts({
      loan: loanPda,
      debtMint,
      collateralMint,
      vaultAuthority,
      vaultCollateralTokenAccount: vaultCollateralAta,
      borrowerCollateralTokenAccount: borrowerCollateralAta,
      borrower: agentPubkey,
      tokenProgram: colTokProg,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()

  const { serializedTx } = await buildAndSerialize(connection, agentPubkey, [...preIxs, ix, ...postIxs])
  return serializedTx
}

// ---------------------------------------------------------------------------
// Permissionless foreclosure (foreclose_loan_v2)
// ---------------------------------------------------------------------------

/**
 * Fetch VaultAuthority treasury address and build remaining_accounts for
 * collateral split in foreclose_loan_v2.
 */
async function getTreasuryCollateralAccounts(
  connection: Connection,
  program: Program,
  collateralMint: PublicKey,
  payer: PublicKey,
): Promise<{ remainingAccounts: AccountMeta[]; preIxs: TransactionInstruction[] }> {
  const vaultAuthorityPda = deriveVaultAuthority()
  try {
    const va = await (program.account as any).vaultAuthority.fetch(vaultAuthorityPda)
    const treasury = va.treasury as PublicKey
    const preIxs: TransactionInstruction[] = []
    // Resolve Token-2022 dual derivation (dynamically from on-chain mint)
    const { ix: ataIx, ata: treasuryCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, treasury, payer)
    if (ataIx) preIxs.push(ataIx)
    return {
      remainingAccounts: [
        { pubkey: treasuryCollateralAta, isWritable: true, isSigner: false },
      ],
      preIxs,
    }
  } catch {
    return { remainingAccounts: [], preIxs: [] }
  }
}

/**
 * Build the foreclose_loan_v2 instruction for permissionless foreclosure of expired loans.
 *
 * Unlike other builders, this returns raw instructions (not a serialized tx)
 * because the caller (cron bot) needs to compose them with Pyth price posting
 * instructions via the PythSolanaReceiver SDK.
 *
 * @param collateralPriceUpdate - On-chain PriceUpdateV2 account for collateral (from Pyth)
 * @param debtPriceUpdate - On-chain PriceUpdateV2 account for debt (from Pyth)
 */
export async function buildForecloseLoanV2Ix(
  connection: Connection,
  program: Program,
  callerPubkey: PublicKey,
  loan: ParsedLoan,
  collateralPriceUpdate: PublicKey,
  debtPriceUpdate: PublicKey,
): Promise<{
  instruction: TransactionInstruction
  preIxs: TransactionInstruction[]
}> {
  const loanPda = new PublicKey(loan.publicKey)
  const collateralMint = new PublicKey(loan.collateralMint)
  const vaultAuthority = deriveVaultAuthority()

  // Derive PriceFeedConfig PDAs
  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(new PublicKey(loan.debtMint))

  // ATAs — resolve Token-2022 dual derivation (dynamically from on-chain mint)
  const { ata: vaultCollateralAta, tokenProgram: colTokProg } = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, callerPubkey, true)
  const lenderPk = new PublicKey(loan.lender!)
  const { ix: lenderAtaIx, ata: lenderCollateralAta } = await ensureAtaExistsIx(connection, collateralMint, lenderPk, callerPubkey)

  const preIxs: TransactionInstruction[] = []
  if (lenderAtaIx) preIxs.push(lenderAtaIx)

  // Treasury remaining accounts for 50/50 collateral split
  const { remainingAccounts, preIxs: treasuryPreIxs } = await getTreasuryCollateralAccounts(
    connection,
    program,
    collateralMint,
    callerPubkey,
  )
  preIxs.push(...treasuryPreIxs)

  // Build the foreclose_loan_v2 instruction
  // Note: requires updated IDL with foreclose_loan_v2 instruction after program deploy
  const ix = await (program.methods as any)
    .forecloseLoanV2()
    .accounts({
      loan: loanPda,
      collateralMint,
      vaultAuthority,
      vaultCollateralTokenAccount: vaultCollateralAta,
      collateralPriceFeedConfig,
      debtPriceFeedConfig,
      collateralPriceUpdate,
      debtPriceUpdate,
      lenderCollateralTokenAccount: lenderCollateralAta,
      lender: lenderPk,
      caller: callerPubkey,
      tokenProgram: colTokProg,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .remainingAccounts(remainingAccounts)
    .instruction()

  return { instruction: ix, preIxs }
}

/**
 * Build the `rescind_undercollateralized_offer` instruction for a pending
 * loan whose collateral ratio has fallen below the protocol minimum (130%).
 *
 * Permissionless — any caller (bot keypair) can invoke this.
 * Requires Pyth price update accounts (same pattern as foreclose_loan_v2).
 */
export async function buildRescindUndercollateralizedOfferIx(
  connection: Connection,
  program: Program,
  callerPubkey: PublicKey,
  loan: ParsedLoan,
  collateralPriceUpdate: PublicKey,
  debtPriceUpdate: PublicKey,
): Promise<{
  instruction: TransactionInstruction
  preIxs: TransactionInstruction[]
}> {
  const loanPda = new PublicKey(loan.publicKey)
  const collateralMint = new PublicKey(loan.collateralMint)
  const debtMint = new PublicKey(loan.debtMint)
  const vaultAuthority = deriveVaultAuthority()

  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(debtMint)

  const preIxs: TransactionInstruction[] = []

  const isBorrowOffer = !!loan.lender && !loan.borrower
  const isLendOffer = !!loan.borrower && !loan.lender

  // Resolve vault token accounts and creator return ATAs
  let vaultCollateralAta: PublicKey | null = null
  let vaultDebtAta: PublicKey | null = null
  let borrowerPk: PublicKey | null = null
  let borrowerCollateralAta: PublicKey | null = null
  let lenderPk: PublicKey | null = null
  let lenderDebtAta: PublicKey | null = null

  if (isLendOffer) {
    // Borrower locked collateral → return to borrower
    borrowerPk = new PublicKey(loan.borrower!)
    const colResult = await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, callerPubkey, true)
    vaultCollateralAta = colResult.ata
    const borrowerResult = await ensureAtaExistsIx(connection, collateralMint, borrowerPk, callerPubkey)
    borrowerCollateralAta = borrowerResult.ata
    if (borrowerResult.ix) preIxs.push(borrowerResult.ix)
  } else if (isBorrowOffer) {
    // Lender locked debt → return to lender
    lenderPk = new PublicKey(loan.lender!)
    const debtResult = await ensureAtaExistsIx(connection, debtMint, vaultAuthority, callerPubkey, true)
    vaultDebtAta = debtResult.ata
    const lenderResult = await ensureAtaExistsIx(connection, debtMint, lenderPk, callerPubkey)
    lenderDebtAta = lenderResult.ata
    if (lenderResult.ix) preIxs.push(lenderResult.ix)
  } else {
    throw new Error("Loan is not a valid pending offer (no single-party creator)")
  }

  // Get the token program for the collateral mint (used as tokenProgram in the instruction)
  const colTokenProgram = (await ensureAtaExistsIx(connection, collateralMint, vaultAuthority, callerPubkey, true)).tokenProgram

  const ix = await (program.methods as any)
    .rescindUndercollateralizedOffer()
    .accounts({
      loan: loanPda,
      collateralMint,
      debtMint,
      vaultAuthority,
      collateralPriceFeedConfig,
      debtPriceFeedConfig,
      collateralPriceUpdate,
      debtPriceUpdate,
      vaultCollateralTokenAccount: vaultCollateralAta,
      vaultDebtTokenAccount: vaultDebtAta,
      borrower: borrowerPk,
      borrowerCollateralTokenAccount: borrowerCollateralAta,
      lender: lenderPk,
      lenderDebtTokenAccount: lenderDebtAta,
      caller: callerPubkey,
      tokenProgram: colTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction()

  return { instruction: ix, preIxs }
}
