import { useMemo, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  type AccountMeta,
} from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PROGRAM_ID, SOLANA_CONFIG } from '@/config/solana';
import { createProvider, createProgram } from '@/lib/program';
import { getTokenMint, getTokenDecimals, getTokenProgramForMint, resolveTokenProgram } from '@/lib/token-mints';
import { buildClientPriceUpdateIxs } from '@/lib/pyth-client';

// Loan status values matching the on-chain program
const LOAN_STATUS = {
  Pending: 0,
  Accepted: 1,
  Rescinded: 2,
  Repaid: 3,
  Foreclosed: 4,
} as const;

const VAULT_AUTHORITY_SEED = Buffer.from(SOLANA_CONFIG.VAULT_AUTHORITY_SEED);
const LOAN_SEED = Buffer.from(SOLANA_CONFIG.LOAN_SEED);
const PRICE_FEED_SEED = Buffer.from('price_feed');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

function deriveVaultAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([VAULT_AUTHORITY_SEED], PROGRAM_ID);
  return pda;
}

function deriveLoanPda(createKey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [LOAN_SEED, createKey.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

function derivePriceFeedConfig(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [PRICE_FEED_SEED, mint.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

function isWsol(mint: PublicKey): boolean {
  return mint.equals(WSOL_MINT);
}

/**
 * Fetch Hermes price data and build client-side Pyth price update transactions.
 *
 * Each post_update_atomic instruction (~960 bytes) needs its own transaction
 * due to Solana's 1232-byte tx limit, but we use `signAllTransactions` so
 * the user only sees **one wallet popup** for all txs (price updates + loan).
 *
 * Returns the price update account addresses, the pre-signed price txs,
 * and reclaim_rent instructions (added to the loan tx as postIxs).
 */
async function fetchPriceData(
  debtToken: string,
  collateralToken: string,
): Promise<{ data: string[]; feedIds: { collateral: string; debt: string } }> {
  const res = await fetch(
    `/api/prices/data?debtToken=${encodeURIComponent(debtToken)}&collateralToken=${encodeURIComponent(collateralToken)}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to fetch oracle price data');
  }
  return res.json();
}

/** SystemProgram.transfer + SyncNative — wraps SOL into an existing wSOL ATA */
function wrapSolIxs(from: PublicKey, wsolAta: PublicKey, lamports: number): TransactionInstruction[] {
  return [
    SystemProgram.transfer({ fromPubkey: from, toPubkey: wsolAta, lamports }),
    createSyncNativeInstruction(wsolAta),
  ];
}

/** CloseAccount — unwraps wSOL back to native SOL */
function unwrapSolIx(wsolAta: PublicKey, destination: PublicKey, authority: PublicKey): TransactionInstruction {
  return createCloseAccountInstruction(wsolAta, destination, authority);
}

export interface CreateOfferParams {
  debtAmount: number;
  collateralAmount: number;
  duration: number; // in seconds
  apy: number; // 0-100
  debtTokenSymbol: string;
  collateralTokenSymbol: string;
  isPrivate: boolean;
  counterparty?: string; // base58 pubkey of private counterparty
}

export interface AcceptOfferParams {
  loanPublicKey: string;
  createKey: string;
  debtMint: string;
  collateralMint: string;
  debtTokenSymbol: string;
  collateralTokenSymbol: string;
  debtAmountUi?: number;
  collateralAmountUi?: number;
  borrower?: string;
  lender?: string;
}

export interface RescindOfferParams {
  loanPublicKey: string;
  debtMint: string;
  collateralMint: string;
  debtTokenSymbol: string;
  collateralTokenSymbol: string;
}

export interface RepayParams {
  loanPda: PublicKey;
  repayAmount: number;
  debtTokenSymbol: string;
  collateralTokenSymbol: string;
  lender: PublicKey;
}

export interface ForecloseParams {
  loanPda: PublicKey;
  collateralTokenSymbol: string;
}

export interface AddCollateralParams {
  loanPda: PublicKey;
  amount: number;
  collateralTokenSymbol: string;
  debtMint: string;
}

export function useLoanContract() {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();

  const vaultAuthority = useMemo(() => deriveVaultAuthority(), []);

  const program = useMemo((): Program | null => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    const provider = createProvider(connection, {
      publicKey,
      signTransaction,
      signAllTransactions,
    });
    return createProgram(provider);
  }, [publicKey, signTransaction, signAllTransactions, connection]);

  // Helper: build a pre-instruction to create an ATA if it doesn't exist.
  async function ensureAtaExists(
    mint: PublicKey,
    owner: PublicKey,
    payer: PublicKey,
    allowOwnerOffCurve = false,
  ): Promise<TransactionInstruction | null> {
    const ata = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
    const info = await connection.getAccountInfo(ata);
    if (info) return null;

    return createAssociatedTokenAccountIdempotentInstruction(
      payer,
      ata,
      owner,
      mint,
    );
  }

  // Helper: fetch VaultAuthority fee config and build remaining_accounts for on-chain fee collection.
  async function getFeeAccounts(
    debtMint: PublicKey,
    payer: PublicKey,
  ): Promise<{ remainingAccounts: AccountMeta[]; preIxs: TransactionInstruction[] }> {
    if (!program) return { remainingAccounts: [], preIxs: [] };
    try {
      const va = await (program.account as any).vaultAuthority.fetch(vaultAuthority);
      if (!va.originationFeeBps || va.originationFeeBps === 0) {
        return { remainingAccounts: [], preIxs: [] };
      }
      const treasury = va.treasury as PublicKey;
      const treasuryDebtAta = getAssociatedTokenAddressSync(debtMint, treasury);
      const preIxs: TransactionInstruction[] = [];
      const ataIx = await ensureAtaExists(debtMint, treasury, payer);
      if (ataIx) preIxs.push(ataIx);
      return {
        remainingAccounts: [
          { pubkey: treasury, isWritable: true, isSigner: false },
          { pubkey: treasuryDebtAta, isWritable: true, isSigner: false },
        ],
        preIxs,
      };
    } catch {
      return { remainingAccounts: [], preIxs: [] };
    }
  }

  // Helper: build, sign, and send a transaction without waiting for on-chain confirmation.
  // Returns the transaction signature immediately after sending.
  // This avoids the hang caused by Anchor's .rpc() waiting for 'confirmed' commitment
  // which can stall indefinitely on devnet due to WebSocket/network issues.
  async function buildSignAndSend(
    methodBuilder: any,
    preIxs: TransactionInstruction[],
    extraSigners: Keypair[] = [],
    postIxs: TransactionInstruction[] = [],
  ): Promise<string> {
    if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

    const tx = await methodBuilder.preInstructions(preIxs).transaction();

    // Add post-instructions (e.g. wSOL unwrap)
    for (const pix of postIxs) {
      tx.add(pix);
    }

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey;

    for (const signer of extraSigners) {
      tx.partialSign(signer);
    }

    // Pre-simulate the transaction to catch errors before the wallet prompt.
    // This gives us detailed logs instead of a generic wallet error message.
    try {
      const simResult = await connection.simulateTransaction(tx);
      if (simResult.value.err) {
        const errStr = JSON.stringify(simResult.value.err);
        const logs = simResult.value.logs || [];
        const programLog = logs.find(l => l.includes('Error') || l.includes('error') || l.includes('insufficient'));

        // SPL Token Program Custom:1 = InsufficientFunds (token balance too low)
        // This is NOT about SOL — it means the debt-token ATA lacks tokens.
        if (errStr.includes('"Custom":1') && !errStr.includes('InsufficientFunds')) {
          throw new Error(
            'Insufficient token balance for this transaction. '
            + 'Check that your wallet has enough of the required token.'
            + (programLog ? ` Detail: ${programLog}` : ''),
          );
        }

        // Solana system-level: fee payer can't afford tx fees or rent
        if (errStr.includes('InsufficientFunds')) {
          throw new Error(
            'Insufficient SOL balance for transaction fees and account rent (~0.005 SOL).'
            + (programLog ? ` Detail: ${programLog}` : ''),
          );
        }

        if (logs.some(l => l.includes('insufficient lamports'))) {
          throw new Error(
            'Insufficient SOL balance. A transfer in this transaction requires more SOL than available.',
          );
        }
        // Generic simulation failure — include the first relevant log line
        throw new Error(
          `Transaction simulation failed: ${programLog || errStr}`,
        );
      }
    } catch (simError: any) {
      // Re-throw our translated errors and simulation failures
      const simMsg = simError.message || '';
      if (
        simMsg.startsWith('Insufficient') ||
        simMsg.startsWith('Transaction simulation') ||
        simMsg.includes('custom program error') ||
        simMsg.includes('InsufficientFunds') ||
        simMsg.includes('insufficient lamports')
      ) {
        throw simError;
      }
      // True network errors during simulation — proceed and let the wallet handle it
      console.warn('Pre-simulation skipped (network error):', simMsg);
    }

    const signed = await signTransaction(tx);

    return connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 5,
    });
  }

  /**
   * Build price-update transactions + loan transaction, sign ALL at once
   * via `signAllTransactions` (single wallet popup), then send sequentially.
   *
   * Flow:
   *  1. Fetch Hermes binary data → build Pyth post_update_atomic txs
   *  2. Build the loan tx (from methodBuilder + preIxs/postIxs)
   *  3. signAllTransactions([...priceTxs, loanTx]) — ONE user approval
   *  4. Send price txs first (confirm each), then send loan tx
   *  5. Fire-and-forget reclaim_rent to recover ephemeral account rent
   */
  async function buildSignAndSendWithPrices(
    debtToken: string,
    collateralToken: string,
    buildMethodWithPrices: (prices: {
      collateralPriceUpdate: PublicKey;
      debtPriceUpdate: PublicKey;
    }) => any,
    preIxs: TransactionInstruction[],
    extraSigners: Keypair[] = [],
    postIxs: TransactionInstruction[] = [],
  ): Promise<string> {
    if (!publicKey || !signAllTransactions) throw new Error('Wallet not connected');

    // 1. Fetch Hermes data and build Pyth instructions
    const { data: priceData, feedIds } = await fetchPriceData(debtToken, collateralToken);
    const pythResult = buildClientPriceUpdateIxs(publicKey, priceData);

    const collateralPriceUpdate = pythResult.priceUpdateAccounts[feedIds.collateral];
    const debtPriceUpdate = pythResult.priceUpdateAccounts[feedIds.debt];
    if (!collateralPriceUpdate || !debtPriceUpdate) {
      throw new Error('Price update accounts not created for required feeds');
    }

    // 2. Build price-posting transactions (one per feed, ~960 bytes each)
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const priceTxs: Transaction[] = [];

    for (let i = 0; i < pythResult.postIxs.length; i++) {
      const ptx = new Transaction();
      ptx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        pythResult.postIxs[i],
      );
      ptx.recentBlockhash = blockhash;
      ptx.feePayer = publicKey;
      ptx.partialSign(pythResult.ephemeralSigners[i]);
      priceTxs.push(ptx);
    }

    // 3. Build loan transaction with resolved price accounts
    const methodBuilder = buildMethodWithPrices({ collateralPriceUpdate, debtPriceUpdate });
    const loanTx = await methodBuilder.preInstructions(preIxs).transaction();
    for (const pix of postIxs) loanTx.add(pix);
    // Add reclaim_rent instructions to recover ephemeral account rent
    for (const rix of pythResult.reclaimIxs) loanTx.add(rix);
    loanTx.recentBlockhash = blockhash;
    loanTx.feePayer = publicKey;
    for (const signer of extraSigners) loanTx.partialSign(signer);

    // 4. Sign ALL transactions at once — user sees ONE wallet popup
    // NOTE: Pre-simulation is skipped because the loan tx references ephemeral
    // price update accounts that don't exist on-chain until the price txs land.
    const allTxs = [...priceTxs, loanTx];
    const signedAll = await signAllTransactions(allTxs);

    // 5. Send price txs first (must confirm before loan tx executes)
    for (let i = 0; i < priceTxs.length; i++) {
      const sig = await connection.sendRawTransaction(signedAll[i].serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });
      await connection.confirmTransaction(sig, 'confirmed');
    }

    // 6. Send loan tx
    const loanSig = await connection.sendRawTransaction(
      signedAll[signedAll.length - 1].serialize(),
      { skipPreflight: true, maxRetries: 5 },
    );

    return loanSig;
  }

  // User is BORROWER: deposits collateral, waits for a lender to accept.
  // Calls the program's create_lend_offer instruction.
  const createBorrowRequest = useCallback(
    async (params: CreateOfferParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');
      if (params.duration < 86400) throw new Error('Minimum loan duration is 1 day');

      const createKey = Keypair.generate();
      const loanPda = deriveLoanPda(createKey.publicKey);
      const debtMint = getTokenMint(params.debtTokenSymbol);
      const collateralMint = getTokenMint(params.collateralTokenSymbol);
      const debtDecimals = getTokenDecimals(params.debtTokenSymbol);
      const collateralDecimals = getTokenDecimals(params.collateralTokenSymbol);
      const collateralIsWsol = isWsol(collateralMint);

      const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint);
      const debtPriceFeedConfig = derivePriceFeedConfig(debtMint);

      const vaultCollateralAta = getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true);
      const borrowerCollateralAta = getAssociatedTokenAddressSync(collateralMint, publicKey);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      const vaultIx = await ensureAtaExists(collateralMint, vaultAuthority, publicKey, true);
      if (vaultIx) preIxs.push(vaultIx);
      const borrowerIx = await ensureAtaExists(collateralMint, publicKey, publicKey);
      if (borrowerIx) preIxs.push(borrowerIx);

      if (collateralIsWsol) {
        const lamports = Math.round(params.collateralAmount * 10 ** collateralDecimals);
        preIxs.push(...wrapSolIxs(publicKey, borrowerCollateralAta, lamports));
        postIxs.push(unwrapSolIx(borrowerCollateralAta, publicKey, publicKey));
      }

      const collateralTokenProgram = await resolveTokenProgram(connection, collateralMint);

      const tx = await buildSignAndSendWithPrices(
        params.debtTokenSymbol,
        params.collateralTokenSymbol,
        (prices) =>
          (program.methods as any)
            .createLendOffer({
              debtAmount: new BN(Math.round(params.debtAmount * 10 ** debtDecimals)),
              collateralAmount: new BN(
                Math.round(params.collateralAmount * 10 ** collateralDecimals),
              ),
              duration: new BN(params.duration),
              apy: params.apy,
              isPrivate: params.isPrivate,
              lender:
                params.isPrivate && params.counterparty
                  ? new PublicKey(params.counterparty)
                  : null,
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
              collateralPriceUpdate: prices.collateralPriceUpdate,
              debtPriceUpdate: prices.debtPriceUpdate,
              createKey: createKey.publicKey,
              borrower: publicKey,
              tokenProgram: collateralTokenProgram,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            }),
        preIxs,
        [createKey],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection, signAllTransactions],
  );

  // User is LENDER: deposits debt tokens, waits for a borrower to accept.
  // Calls the program's create_borrow_offer instruction.
  const createLendOffer = useCallback(
    async (params: CreateOfferParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');
      if (params.duration < 86400) throw new Error('Minimum loan duration is 1 day');

      const createKey = Keypair.generate();
      const loanPda = deriveLoanPda(createKey.publicKey);
      const debtMint = getTokenMint(params.debtTokenSymbol);
      const collateralMint = getTokenMint(params.collateralTokenSymbol);
      const debtDecimals = getTokenDecimals(params.debtTokenSymbol);
      const collateralDecimals = getTokenDecimals(params.collateralTokenSymbol);
      const debtIsWsol = isWsol(debtMint);

      const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint);
      const debtPriceFeedConfig = derivePriceFeedConfig(debtMint);

      const vaultDebtAta = getAssociatedTokenAddressSync(debtMint, vaultAuthority, true);
      const lenderDebtAta = getAssociatedTokenAddressSync(debtMint, publicKey);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      const vaultIx = await ensureAtaExists(debtMint, vaultAuthority, publicKey, true);
      if (vaultIx) preIxs.push(vaultIx);
      const lenderIx = await ensureAtaExists(debtMint, publicKey, publicKey);
      if (lenderIx) preIxs.push(lenderIx);

      if (debtIsWsol) {
        const lamports = Math.round(params.debtAmount * 10 ** debtDecimals);
        preIxs.push(...wrapSolIxs(publicKey, lenderDebtAta, lamports));
        postIxs.push(unwrapSolIx(lenderDebtAta, publicKey, publicKey));
      }

      const debtTokenProgram = await resolveTokenProgram(connection, debtMint);

      const tx = await buildSignAndSendWithPrices(
        params.debtTokenSymbol,
        params.collateralTokenSymbol,
        (prices) =>
          (program.methods as any)
            .createBorrowOffer({
              debtAmount: new BN(Math.round(params.debtAmount * 10 ** debtDecimals)),
              collateralAmount: new BN(
                Math.round(params.collateralAmount * 10 ** collateralDecimals),
              ),
              duration: new BN(params.duration),
              apy: params.apy,
              isPrivate: params.isPrivate,
              borrower:
                params.isPrivate && params.counterparty
                  ? new PublicKey(params.counterparty)
                  : null,
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
              collateralPriceUpdate: prices.collateralPriceUpdate,
              debtPriceUpdate: prices.debtPriceUpdate,
              createKey: createKey.publicKey,
              lender: publicKey,
              tokenProgram: debtTokenProgram,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            }),
        preIxs,
        [createKey],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection, signAllTransactions],
  );

  // Pre-flight: fetch loan account and verify its on-chain status before submitting a tx.
  // Prevents wasted gas fees when the loan has already been accepted, rescinded, etc.
  async function preflight(
    loanPda: PublicKey,
    expectedStatus: number,
    label: string,
  ) {
    if (!program) throw new Error('Program not initialized');
    let loanAccount: { status: number };
    try {
      loanAccount = await (program.account as any).loan.fetch(loanPda);
    } catch {
      throw new Error(`Loan account not found on-chain. It may have been closed.`);
    }
    if (loanAccount.status !== expectedStatus) {
      const statusNames = ['Pending', 'Active', 'Rescinded', 'Repaid', 'Foreclosed'];
      const current = statusNames[loanAccount.status] ?? `unknown (${loanAccount.status})`;
      throw new Error(
        `Cannot ${label}: loan is currently "${current}". Expected "` +
        `${statusNames[expectedStatus]}".`
      );
    }
  }

  // User is BORROWER: accepts a lend offer created by a lender.
  // Calls the program's accept_borrow_offer instruction.
  // Token flow: vault sends debt to borrower, borrower sends collateral to vault.
  const acceptBorrowOffer = useCallback(
    async (params: AcceptOfferParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');

      const loanPda = new PublicKey(params.loanPublicKey);
      await preflight(loanPda, LOAN_STATUS.Pending, 'accept offer');

      const debtMint = new PublicKey(params.debtMint);
      const collateralMint = new PublicKey(params.collateralMint);
      const debtIsWsol = isWsol(debtMint);
      const collateralIsWsol = isWsol(collateralMint);

      const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint);
      const debtPriceFeedConfig = derivePriceFeedConfig(debtMint);

      const vaultDebtAta = getAssociatedTokenAddressSync(debtMint, vaultAuthority, true);
      const vaultCollateralAta = getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true);
      const borrowerDebtAta = getAssociatedTokenAddressSync(debtMint, publicKey);
      const borrowerCollateralAta = getAssociatedTokenAddressSync(collateralMint, publicKey);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      const ix1 = await ensureAtaExists(debtMint, vaultAuthority, publicKey, true);
      if (ix1) preIxs.push(ix1);
      const ix2 = await ensureAtaExists(debtMint, publicKey, publicKey);
      if (ix2) preIxs.push(ix2);
      const ix3 = await ensureAtaExists(collateralMint, vaultAuthority, publicKey, true);
      if (ix3) preIxs.push(ix3);
      const ix4 = await ensureAtaExists(collateralMint, publicKey, publicKey);
      if (ix4) preIxs.push(ix4);

      if (collateralIsWsol && params.collateralAmountUi) {
        const collateralDecimals = getTokenDecimals(params.collateralTokenSymbol);
        const lamports = Math.round(params.collateralAmountUi * 10 ** collateralDecimals);
        preIxs.push(...wrapSolIxs(publicKey, borrowerCollateralAta, lamports));
        postIxs.push(unwrapSolIx(borrowerCollateralAta, publicKey, publicKey));
      }

      if (debtIsWsol) {
        postIxs.push(unwrapSolIx(borrowerDebtAta, publicKey, publicKey));
      }

      const { remainingAccounts, preIxs: feePreIxs } = await getFeeAccounts(debtMint, publicKey);
      preIxs.push(...feePreIxs);

      const collateralTokenProgram = await resolveTokenProgram(connection, collateralMint);

      const tx = await buildSignAndSendWithPrices(
        params.debtTokenSymbol,
        params.collateralTokenSymbol,
        (prices) =>
          (program.methods as any)
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
              collateralPriceUpdate: prices.collateralPriceUpdate,
              debtPriceUpdate: prices.debtPriceUpdate,
              borrower: publicKey,
              tokenProgram: collateralTokenProgram,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
              clock: SYSVAR_CLOCK_PUBKEY,
            })
            .remainingAccounts(remainingAccounts),
        preIxs,
        [],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection, signAllTransactions],
  );

  // User is LENDER: accepts a borrow request created by a borrower.
  // Calls the program's accept_lend_offer instruction.
  // Token flow: lender sends debt tokens directly to borrower.
  const acceptLendOffer = useCallback(
    async (params: AcceptOfferParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');
      if (!params.borrower) throw new Error('Borrower address required');

      const loanPda = new PublicKey(params.loanPublicKey);
      await preflight(loanPda, LOAN_STATUS.Pending, 'accept offer');

      const debtMint = new PublicKey(params.debtMint);
      const collateralMint = new PublicKey(params.collateralMint);
      const borrowerPk = new PublicKey(params.borrower);
      const debtIsWsol = isWsol(debtMint);

      const collateralPriceFeedConfig = derivePriceFeedConfig(collateralMint);
      const debtPriceFeedConfig = derivePriceFeedConfig(debtMint);

      const lenderDebtAta = getAssociatedTokenAddressSync(debtMint, publicKey);
      const borrowerDebtAta = getAssociatedTokenAddressSync(debtMint, borrowerPk);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      const ix1 = await ensureAtaExists(debtMint, publicKey, publicKey);
      if (ix1) preIxs.push(ix1);
      const ix2 = await ensureAtaExists(debtMint, borrowerPk, publicKey);
      if (ix2) preIxs.push(ix2);

      if (debtIsWsol && params.debtAmountUi) {
        const debtDecimals = getTokenDecimals(params.debtTokenSymbol);
        const lamports = Math.round(params.debtAmountUi * 10 ** debtDecimals);
        preIxs.push(...wrapSolIxs(publicKey, lenderDebtAta, lamports));
        postIxs.push(unwrapSolIx(lenderDebtAta, publicKey, publicKey));
      }

      const { remainingAccounts, preIxs: feePreIxs } = await getFeeAccounts(debtMint, publicKey);
      preIxs.push(...feePreIxs);

      const debtTokenProgram = await resolveTokenProgram(connection, debtMint);

      const tx = await buildSignAndSendWithPrices(
        params.debtTokenSymbol,
        params.collateralTokenSymbol,
        (prices) =>
          (program.methods as any)
            .acceptLendOffer()
            .accounts({
              loan: loanPda,
              debtMint,
              collateralMint,
              collateralPriceFeedConfig,
              debtPriceFeedConfig,
              collateralPriceUpdate: prices.collateralPriceUpdate,
              debtPriceUpdate: prices.debtPriceUpdate,
              lenderDebtTokenAccount: lenderDebtAta,
              borrowerDebtTokenAccount: borrowerDebtAta,
              lender: publicKey,
              borrower: borrowerPk,
              tokenProgram: debtTokenProgram,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
              clock: SYSVAR_CLOCK_PUBKEY,
            })
            .remainingAccounts(remainingAccounts),
        preIxs,
        [],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection, signAllTransactions],
  );

  // Repay an active loan (partial or full)
  const repayLoan = useCallback(
    async (params: RepayParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');

      // Pre-flight: ensure the loan is Active before repaying
      await preflight(params.loanPda, LOAN_STATUS.Accepted, 'repay loan');

      const debtMint = getTokenMint(params.debtTokenSymbol);
      const collateralMint = getTokenMint(params.collateralTokenSymbol);
      const debtDecimals = getTokenDecimals(params.debtTokenSymbol);
      const debtIsWsol = isWsol(debtMint);
      const collateralIsWsol = isWsol(collateralMint);

      // Always compute real ATAs
      const vaultCollateralAta = getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true);
      const borrowerCollateralAta = getAssociatedTokenAddressSync(collateralMint, publicKey);
      const borrowerDebtAta = getAssociatedTokenAddressSync(debtMint, publicKey);
      const lenderDebtAta = getAssociatedTokenAddressSync(debtMint, params.lender);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      // Ensure ATAs exist
      const ix1 = await ensureAtaExists(debtMint, publicKey, publicKey);
      if (ix1) preIxs.push(ix1);
      const ix2 = await ensureAtaExists(debtMint, params.lender, publicKey);
      if (ix2) preIxs.push(ix2);
      const ix3 = await ensureAtaExists(collateralMint, publicKey, publicKey);
      if (ix3) preIxs.push(ix3);

      // wSOL debt: borrower wraps SOL before repaying
      if (debtIsWsol) {
        const lamports = Math.round(params.repayAmount * 10 ** debtDecimals);
        preIxs.push(...wrapSolIxs(publicKey, borrowerDebtAta, lamports));
        postIxs.push(unwrapSolIx(borrowerDebtAta, publicKey, publicKey));
      }

      // wSOL collateral: borrower unwraps received collateral SOL
      if (collateralIsWsol) {
        postIxs.push(unwrapSolIx(borrowerCollateralAta, publicKey, publicKey));
      }

      const tx = await buildSignAndSend(
        (program.methods as any)
          .repayLoan({
            repayAmount: new BN(Math.round(params.repayAmount * 10 ** debtDecimals)),
          })
          .accounts({
            loan: params.loanPda,
            debtMint,
            collateralMint,
            vaultAuthority,
            vaultCollateralTokenAccount: vaultCollateralAta,
            borrowerCollateralTokenAccount: borrowerCollateralAta,
            borrowerDebtTokenAccount: borrowerDebtAta,
            lenderDebtTokenAccount: lenderDebtAta,
            lender: params.lender,
            borrower: publicKey,
            tokenProgram: await resolveTokenProgram(connection, debtMint),
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          }),
        preIxs,
        [],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection],
  );

  // User is LENDER: rescinds their own borrow offer (created via create_borrow_offer).
  // Returns debt tokens from vault back to lender.
  const rescindBorrowOffer = useCallback(
    async (params: RescindOfferParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');

      const loanPda = new PublicKey(params.loanPublicKey);

      // Pre-flight: ensure the loan is still Pending before rescinding
      await preflight(loanPda, LOAN_STATUS.Pending, 'rescind offer');

      const debtMint = new PublicKey(params.debtMint);
      const collateralMint = new PublicKey(params.collateralMint);
      const debtIsWsol = isWsol(debtMint);

      // Always compute real ATAs
      const vaultDebtAta = getAssociatedTokenAddressSync(debtMint, vaultAuthority, true);
      const lenderDebtAta = getAssociatedTokenAddressSync(debtMint, publicKey);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      // Ensure ATAs exist
      const ix1 = await ensureAtaExists(debtMint, publicKey, publicKey);
      if (ix1) preIxs.push(ix1);

      // wSOL debt: lender unwraps received debt SOL from vault
      if (debtIsWsol) {
        postIxs.push(unwrapSolIx(lenderDebtAta, publicKey, publicKey));
      }

      const tx = await buildSignAndSend(
        (program.methods as any)
          .rescindBorrowOffer()
          .accounts({
            loan: loanPda,
            debtMint,
            collateralMint,
            vaultAuthority,
            vaultDebtTokenAccount: vaultDebtAta,
            lenderDebtTokenAccount: lenderDebtAta,
            lender: publicKey,
            tokenProgram: await resolveTokenProgram(connection, debtMint),
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          }),
        preIxs,
        [],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection],
  );

  // User is BORROWER: rescinds their own lend offer (created via create_lend_offer).
  // Returns collateral from vault back to borrower.
  const rescindLendOffer = useCallback(
    async (params: RescindOfferParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');

      const loanPda = new PublicKey(params.loanPublicKey);

      // Pre-flight: ensure the loan is still Pending before rescinding
      await preflight(loanPda, LOAN_STATUS.Pending, 'rescind offer');

      const debtMint = new PublicKey(params.debtMint);
      const collateralMint = new PublicKey(params.collateralMint);
      const collateralIsWsol = isWsol(collateralMint);

      // Always compute real ATAs
      const vaultCollateralAta = getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true);
      const borrowerCollateralAta = getAssociatedTokenAddressSync(collateralMint, publicKey);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      // Ensure ATAs exist
      const ix1 = await ensureAtaExists(collateralMint, publicKey, publicKey);
      if (ix1) preIxs.push(ix1);

      // wSOL collateral: borrower unwraps received collateral SOL from vault
      if (collateralIsWsol) {
        postIxs.push(unwrapSolIx(borrowerCollateralAta, publicKey, publicKey));
      }

      const tx = await buildSignAndSend(
        (program.methods as any)
          .rescindLendOffer()
          .accounts({
            loan: loanPda,
            debtMint,
            collateralMint,
            vaultAuthority,
            vaultCollateralTokenAccount: vaultCollateralAta,
            borrowerCollateralTokenAccount: borrowerCollateralAta,
            borrower: publicKey,
            tokenProgram: await resolveTokenProgram(connection, collateralMint),
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          }),
        preIxs,
        [],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection],
  );

  // Lender forecloses an expired loan — collateral is sent to lender
  const forecloseLoan = useCallback(
    async (params: ForecloseParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');

      // Pre-flight: ensure the loan is Active before foreclosing
      await preflight(params.loanPda, LOAN_STATUS.Accepted, 'foreclose loan');

      const collateralMint = getTokenMint(params.collateralTokenSymbol);
      const collateralIsWsol = isWsol(collateralMint);

      // Always compute real ATAs
      const vaultCollateralAta = getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true);
      const lenderCollateralAta = getAssociatedTokenAddressSync(collateralMint, publicKey);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      // Ensure ATAs exist
      const ix1 = await ensureAtaExists(collateralMint, publicKey, publicKey);
      if (ix1) preIxs.push(ix1);

      // wSOL collateral: lender unwraps received collateral SOL
      if (collateralIsWsol) {
        postIxs.push(unwrapSolIx(lenderCollateralAta, publicKey, publicKey));
      }

      const tx = await buildSignAndSend(
        (program.methods as any)
          .forecloseLoan()
          .accounts({
            loan: params.loanPda,
            collateralMint,
            vaultAuthority,
            vaultCollateralTokenAccount: vaultCollateralAta,
            lenderCollateralTokenAccount: lenderCollateralAta,
            lender: publicKey,
            tokenProgram: await resolveTokenProgram(connection, collateralMint),
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            clock: SYSVAR_CLOCK_PUBKEY,
          }),
        preIxs,
        [],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection],
  );

  // Borrower adds more collateral to an active loan
  const addCollateral = useCallback(
    async (params: AddCollateralParams): Promise<string> => {
      if (!program || !publicKey) throw new Error('Wallet not connected');

      // Pre-flight: ensure the loan is Active
      await preflight(params.loanPda, LOAN_STATUS.Accepted, 'add collateral');

      const collateralMint = getTokenMint(params.collateralTokenSymbol);
      const collateralDecimals = getTokenDecimals(params.collateralTokenSymbol);
      const debtMint = new PublicKey(params.debtMint);
      const collateralIsWsol = isWsol(collateralMint);

      // Always compute real ATAs
      const vaultCollateralAta = getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true);
      const borrowerCollateralAta = getAssociatedTokenAddressSync(collateralMint, publicKey);

      const preIxs: TransactionInstruction[] = [];
      const postIxs: TransactionInstruction[] = [];

      // Ensure ATAs exist
      const vaultIx = await ensureAtaExists(collateralMint, vaultAuthority, publicKey, true);
      if (vaultIx) preIxs.push(vaultIx);
      const borrowerIx = await ensureAtaExists(collateralMint, publicKey, publicKey);
      if (borrowerIx) preIxs.push(borrowerIx);

      // wSOL collateral: borrower wraps SOL before sending to vault
      if (collateralIsWsol) {
        const lamports = Math.round(params.amount * 10 ** collateralDecimals);
        preIxs.push(...wrapSolIxs(publicKey, borrowerCollateralAta, lamports));
        // Close borrower's wSOL ATA after transfer
        postIxs.push(unwrapSolIx(borrowerCollateralAta, publicKey, publicKey));
      }

      const tx = await buildSignAndSend(
        (program.methods as any)
          .addCollateral({
            addAmount: new BN(Math.round(params.amount * 10 ** collateralDecimals)),
          })
          .accounts({
            loan: params.loanPda,
            debtMint,
            collateralMint,
            vaultAuthority,
            vaultCollateralTokenAccount: vaultCollateralAta,
            borrowerCollateralTokenAccount: borrowerCollateralAta,
            borrower: publicKey,
            tokenProgram: await resolveTokenProgram(connection, collateralMint),
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          }),
        preIxs,
        [],
        postIxs,
      );

      return tx;
    },
    [program, publicKey, vaultAuthority, connection],
  );

  // Fetch a single loan account
  const fetchLoan = useCallback(
    async (loanPda: PublicKey) => {
      if (!program) throw new Error('Program not initialized');
      return (program.account as any).loan.fetch(loanPda);
    },
    [program],
  );

  // Fetch all loan accounts
  const fetchAllLoans = useCallback(async () => {
    if (!program) throw new Error('Program not initialized');
    return (program.account as any).loan.all();
  }, [program]);

  const isValidSolanaAddress = (addr: string): boolean => {
    try {
      new PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  return {
    createBorrowRequest,
    createLendOffer,
    acceptBorrowOffer,
    acceptLendOffer,
    rescindBorrowOffer,
    rescindLendOffer,
    repayLoan,
    forecloseLoan,
    addCollateral,
    fetchLoan,
    fetchAllLoans,
    isConnected: connected,
    publicKey,
    connection,
    isValidSolanaAddress,
  };
}
