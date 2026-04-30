import { NextRequest } from "next/server"
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  type TransactionInstruction,
} from "@solana/web3.js"
import { BN } from "@coral-xyz/anchor"
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { createPostResponse } from "@solana/actions"
import type { ActionGetResponse } from "@solana/actions-spec"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { postPricesForTokens, validateLoanTerms } from "@/lib/mcp/tools/lending"
import { parseLoanAccount, LoanStatus, formatDuration } from "@/lib/loan-utils"
import { getTokenDecimals, resolveTokenProgram } from "@/lib/token-mints"
import { PROGRAM_ID, SOLANA_CONFIG } from "@/config/solana"
import { OPTIONS_RESPONSE, actionJsonResponse, actionErrorResponse } from "@/lib/actions/cors"

const VAULT_AUTHORITY_SEED = Buffer.from(SOLANA_CONFIG.VAULT_AUTHORITY_SEED)
const LOAN_SEED = Buffer.from(SOLANA_CONFIG.LOAN_SEED)
const PRICE_FEED_SEED = Buffer.from("price_feed")
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112")

function deriveVaultAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([VAULT_AUTHORITY_SEED], PROGRAM_ID)
  return pda
}

function derivePriceFeedConfig(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [PRICE_FEED_SEED, mint.toBuffer()],
    PROGRAM_ID,
  )
  return pda
}

async function fetchLoanByPubkey(loanPublicKey: string) {
  const connection = createConnection()
  const program = createReadonlyProgram(connection)
  try {
    const pk = new PublicKey(loanPublicKey)
    const account = await (program.account as any).loan.fetch(pk)
    return parseLoanAccount(pk, account)
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loanPublicKey: string }> },
) {
  const { loanPublicKey } = await params
  const baseUrl = new URL(request.url).origin

  const loan = await fetchLoanByPubkey(loanPublicKey)
  if (!loan) {
    return actionErrorResponse("Loan not found", 404)
  }

  if (loan.status !== LoanStatus.Pending) {
    const response: ActionGetResponse = {
      icon: `${baseUrl}/agio-logo-3d.png`,
      title: "Agio \u2014 Offer No Longer Available",
      description: `This ${loan.offerType} offer is no longer pending (status: ${LoanStatus[loan.status]}).`,
      label: "Unavailable",
      disabled: true,
    }
    return actionJsonResponse(response)
  }

  const durationLabel = formatDuration(loan.duration)
  const isLendOffer = loan.offerType === "lend"

  const response: ActionGetResponse = {
    icon: `${baseUrl}/agio-logo-3d.png`,
    title: `Agio \u2014 ${loan.debtAmountUi} ${loan.debtTokenSymbol} @ ${loan.apy}% APY for ${durationLabel}`,
    description: isLendOffer
      ? `Accept this lend offer as borrower. You deposit ${loan.collateralAmountUi} ${loan.collateralTokenSymbol} collateral and receive ${loan.debtAmountUi} ${loan.debtTokenSymbol}. 1% origination fee deducted on-chain.`
      : `Fund this borrow request as lender. You send ${loan.debtAmountUi} ${loan.debtTokenSymbol} and earn ${loan.apy}% APY interest over ${formatDuration(loan.duration)}.`,
    label: isLendOffer ? "Accept Offer" : "Fund Loan",
    links: {
      actions: [
        {
          type: "transaction",
          label: isLendOffer ? "Accept Offer" : "Fund Loan",
          href: `${baseUrl}/api/actions/accept/${loanPublicKey}`,
        },
      ],
    },
  }

  return actionJsonResponse(response)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loanPublicKey: string }> },
) {
  try {
    const { loanPublicKey } = await params
    const body = await request.json()
    const { account } = body
    if (!account) return actionErrorResponse("Missing account in request body")

    let userPubkey: PublicKey
    try {
      userPubkey = new PublicKey(account)
    } catch {
      return actionErrorResponse("Invalid account public key")
    }

    const loan = await fetchLoanByPubkey(loanPublicKey)
    if (!loan) return actionErrorResponse("Loan not found", 404)
    if (loan.status !== LoanStatus.Pending) {
      return actionErrorResponse("This offer is no longer pending")
    }

    // Self-accept check
    const userAddr = userPubkey.toBase58()
    if (loan.lender === userAddr || loan.borrower === userAddr) {
      return actionErrorResponse("You cannot accept your own offer")
    }

    // Re-validate collateral ratio at current prices (accept allows down to 130%)
    const ratioError = await validateLoanTerms({
      debtToken: loan.debtTokenSymbol,
      collateralToken: loan.collateralTokenSymbol,
      debtAmount: loan.debtAmountUi,
      collateralAmount: loan.collateralAmountUi,
      apy: loan.apy,
      mode: 'accept',
    })
    if (ratioError) return actionErrorResponse(`Cannot accept: ${ratioError}`)

    const connection = createConnection()
    const program = createReadonlyProgram(connection)

    console.log("[Blink POST] Building tx for loan", loanPublicKey, "type:", loan.offerType, "user:", userAddr)

    const { collateralPriceUpdate, debtPriceUpdate, cleanup } =
      await postPricesForTokens(connection, loan.debtTokenSymbol, loan.collateralTokenSymbol)

    console.log("[Blink POST] Price accounts posted:", {
      collateral: collateralPriceUpdate.toBase58(),
      debt: debtPriceUpdate.toBase58(),
    })

    const isLendOffer = loan.offerType === "lend"

    let tx: VersionedTransaction
    try {
      if (isLendOffer) {
        tx = await buildAcceptLendOfferAction(connection, program, userPubkey, loan, {
          collateralPriceUpdate,
          debtPriceUpdate,
        })
      } else {
        tx = await buildAcceptBorrowRequestAction(connection, program, userPubkey, loan, {
          collateralPriceUpdate,
          debtPriceUpdate,
        })
      }
    } catch (err: any) {
      console.error("[Blink POST] Build tx error:", err)
      await cleanup().catch(() => {})
      return actionErrorResponse(err.message || "Failed to build transaction", 500)
    }

    // Schedule price account cleanup after 2 minutes
    setTimeout(() => cleanup().catch(() => {}), 120_000)

    console.log("[Blink POST] Tx built with", tx.message.compiledInstructions.length, "instructions, serializing...")

    const postResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction: tx,
        message: isLendOffer
          ? `Accepted lend offer: borrowing ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY`
          : `Funded borrow request: lending ${loan.debtAmountUi} ${loan.debtTokenSymbol} at ${loan.apy}% APY`,
      },
    })

    console.log("[Blink POST] Success, returning transaction")
    return actionJsonResponse(postResponse)
  } catch (err: any) {
    console.error("[Blink POST] Unhandled error:", err)
    return actionErrorResponse(err.message || "Internal server error", 500)
  }
}

export async function OPTIONS() {
  return OPTIONS_RESPONSE()
}

// ─── Build transaction directly (no serialize/deserialize round-trip) ───

async function buildAcceptBorrowRequestAction(
  connection: ReturnType<typeof createConnection>,
  program: ReturnType<typeof createReadonlyProgram>,
  userPubkey: PublicKey,
  loan: ReturnType<typeof parseLoanAccount> & {},
  priceAccounts: { collateralPriceUpdate: PublicKey; debtPriceUpdate: PublicKey },
): Promise<VersionedTransaction> {
  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const borrowerPk = new PublicKey(loan.borrower!)
  const debtIsWsol = debtMint.equals(WSOL_MINT)

  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(debtMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve token program from on-chain mint
  const debtTokenProgram = await resolveTokenProgram(connection, debtMint)

  // ATAs
  const lenderDebtAta = getAssociatedTokenAddressSync(debtMint, userPubkey, false, debtTokenProgram)
  const borrowerDebtAta = getAssociatedTokenAddressSync(debtMint, borrowerPk, false, debtTokenProgram)

  // Ensure ATAs exist
  const lenderAtaInfo = await connection.getAccountInfo(lenderDebtAta)
  if (!lenderAtaInfo) {
    preIxs.push(createAssociatedTokenAccountIdempotentInstruction(userPubkey, lenderDebtAta, userPubkey, debtMint, debtTokenProgram))
  }
  const borrowerAtaInfo = await connection.getAccountInfo(borrowerDebtAta)
  if (!borrowerAtaInfo) {
    preIxs.push(createAssociatedTokenAccountIdempotentInstruction(userPubkey, borrowerDebtAta, borrowerPk, debtMint, debtTokenProgram))
  }

  // wSOL: wrap SOL into lender's ATA
  if (debtIsWsol) {
    const lamports = Math.round(loan.debtAmountUi * 10 ** getTokenDecimals(loan.debtTokenSymbol))
    preIxs.push(
      SystemProgram.transfer({ fromPubkey: userPubkey, toPubkey: lenderDebtAta, lamports }),
      createSyncNativeInstruction(lenderDebtAta),
    )
    postIxs.push(createCloseAccountInstruction(lenderDebtAta, userPubkey, userPubkey))
  }

  // Fee accounts
  const { remainingAccounts, preIxs: feePreIxs } = await getFeeAccountsForAction(
    connection, program, debtMint, userPubkey, debtTokenProgram,
  )
  preIxs.push(...feePreIxs)

  // Main instruction
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
      lender: userPubkey,
      borrower: borrowerPk,
      tokenProgram: debtTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .remainingAccounts(remainingAccounts)
    .instruction()

  // Build v0 VersionedTransaction for dial.to compatibility
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ...preIxs,
    ix,
    ...postIxs,
  ]

  const { blockhash } = await connection.getLatestBlockhash("confirmed")
  const messageV0 = new TransactionMessage({
    payerKey: userPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message()

  return new VersionedTransaction(messageV0)
}

async function buildAcceptLendOfferAction(
  connection: ReturnType<typeof createConnection>,
  program: ReturnType<typeof createReadonlyProgram>,
  userPubkey: PublicKey,
  loan: ReturnType<typeof parseLoanAccount> & {},
  priceAccounts: { collateralPriceUpdate: PublicKey; debtPriceUpdate: PublicKey },
): Promise<VersionedTransaction> {
  const loanPda = new PublicKey(loan.publicKey)
  const debtMint = new PublicKey(loan.debtMint)
  const collateralMint = new PublicKey(loan.collateralMint)
  const vaultAuthority = deriveVaultAuthority()
  const debtIsWsol = debtMint.equals(WSOL_MINT)
  const collateralIsWsol = collateralMint.equals(WSOL_MINT)

  const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint)
  const debtPriceFeedConfig = derivePriceFeedConfig(debtMint)

  const preIxs: TransactionInstruction[] = []
  const postIxs: TransactionInstruction[] = []

  // Resolve token programs
  const collateralTokenProgram = await resolveTokenProgram(connection, collateralMint)
  const debtTokenProgram = await resolveTokenProgram(connection, debtMint)

  // ATAs
  const vaultDebtAta = getAssociatedTokenAddressSync(debtMint, vaultAuthority, true, debtTokenProgram)
  const borrowerDebtAta = getAssociatedTokenAddressSync(debtMint, userPubkey, false, debtTokenProgram)
  const vaultCollateralAta = getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true, collateralTokenProgram)
  const borrowerCollateralAta = getAssociatedTokenAddressSync(collateralMint, userPubkey, false, collateralTokenProgram)

  // Ensure ATAs exist
  for (const [mint, owner, ata, allowOffCurve, tokProg] of [
    [debtMint, vaultAuthority, vaultDebtAta, true, debtTokenProgram],
    [debtMint, userPubkey, borrowerDebtAta, false, debtTokenProgram],
    [collateralMint, vaultAuthority, vaultCollateralAta, true, collateralTokenProgram],
    [collateralMint, userPubkey, borrowerCollateralAta, false, collateralTokenProgram],
  ] as [PublicKey, PublicKey, PublicKey, boolean, PublicKey][]) {
    const info = await connection.getAccountInfo(ata)
    if (!info) {
      preIxs.push(createAssociatedTokenAccountIdempotentInstruction(userPubkey, ata, owner, mint, tokProg))
    }
  }

  // wSOL collateral: borrower wraps SOL to send to vault
  if (collateralIsWsol && loan.collateralAmountUi) {
    const lamports = Math.round(loan.collateralAmountUi * 10 ** getTokenDecimals(loan.collateralTokenSymbol))
    preIxs.push(
      SystemProgram.transfer({ fromPubkey: userPubkey, toPubkey: borrowerCollateralAta, lamports }),
      createSyncNativeInstruction(borrowerCollateralAta),
    )
    postIxs.push(createCloseAccountInstruction(borrowerCollateralAta, userPubkey, userPubkey))
  }

  // wSOL debt: borrower receives wSOL from vault, unwrap to native SOL
  if (debtIsWsol) {
    postIxs.push(createCloseAccountInstruction(borrowerDebtAta, userPubkey, userPubkey))
  }

  // Fee accounts
  const { remainingAccounts, preIxs: feePreIxs } = await getFeeAccountsForAction(
    connection, program, debtMint, userPubkey, debtTokenProgram,
  )
  preIxs.push(...feePreIxs)

  // Main instruction
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
      borrower: userPubkey,
      tokenProgram: collateralTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
    })
    .remainingAccounts(remainingAccounts)
    .instruction()

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    ...preIxs,
    ix,
    ...postIxs,
  ]

  const { blockhash } = await connection.getLatestBlockhash("confirmed")
  const messageV0 = new TransactionMessage({
    payerKey: userPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message()

  return new VersionedTransaction(messageV0)
}

/** Fetch VaultAuthority fee config for on-chain origination fee. */
async function getFeeAccountsForAction(
  connection: ReturnType<typeof createConnection>,
  program: ReturnType<typeof createReadonlyProgram>,
  debtMint: PublicKey,
  payer: PublicKey,
  debtTokenProgram: PublicKey,
): Promise<{ remainingAccounts: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[]; preIxs: TransactionInstruction[] }> {
  const vaultAuthorityPda = deriveVaultAuthority()
  try {
    const va = await (program.account as any).vaultAuthority.fetch(vaultAuthorityPda)
    if (!va.originationFeeBps || va.originationFeeBps === 0) {
      return { remainingAccounts: [], preIxs: [] }
    }
    const treasury = va.treasury as PublicKey
    const treasuryDebtAta = getAssociatedTokenAddressSync(debtMint, treasury, false, debtTokenProgram)
    const preIxs: TransactionInstruction[] = []
    const info = await connection.getAccountInfo(treasuryDebtAta)
    if (!info) {
      preIxs.push(createAssociatedTokenAccountIdempotentInstruction(payer, treasuryDebtAta, treasury, debtMint, debtTokenProgram))
    }
    return {
      remainingAccounts: [
        { pubkey: treasury, isWritable: true, isSigner: false },
        { pubkey: treasuryDebtAta, isWritable: true, isSigner: false },
      ],
      preIxs,
    }
  } catch {
    return { remainingAccounts: [], preIxs: [] }
  }
}
