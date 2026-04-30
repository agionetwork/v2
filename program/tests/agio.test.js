const anchor = require("@coral-xyz/anchor");
const { Program } = require("@coral-xyz/anchor");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createMint,
  mintTo,
  createAssociatedTokenAccount,
} = require("@solana/spl-token");
const {
  SystemProgram,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");

describe("agio", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agio;

  // Test accounts
  let admin;
  let lender;
  let borrower;
  let createKey;
  let debtMint;
  let collateralMint;
  let vaultAuthority;
  let vaultAuthorityBump;
  let debtMintKeypair;
  let collateralMintKeypair;

  // Constants
  const WSOL_MINT = new PublicKey(
    "So11111111111111111111111111111111111111112"
  );
  const ADMIN_AUTHORITY = new PublicKey(
    "HiC7BjgFn3bYHddVZY9W5nMRzn6SajawUkXQYEBbjRUR"
  );

  beforeAll(async () => {
    // Airdrop SOL to admin if needed
    try {
      const balance = await provider.connection.getBalance(ADMIN_AUTHORITY);
      if (balance < 10 * LAMPORTS_PER_SOL) {
        await provider.connection.requestAirdrop(
          ADMIN_AUTHORITY,
          10 * LAMPORTS_PER_SOL
        );
      }
    } catch (e) {
      // Admin might not exist, create a new one for testing
    }

    // Create test keypairs
    // Load admin keypair from environment or generate for testing
    if (process.env.ADMIN_SECRET_KEY) {
      admin = Keypair.fromSecretKey(
        anchor.utils.bytes.bs58.decode(process.env.ADMIN_SECRET_KEY)
      );
    } else {
      admin = Keypair.generate();
      console.warn("WARNING: Using generated admin keypair. Set ADMIN_SECRET_KEY env var for the real admin.");
    }
    lender = Keypair.generate();
    borrower = Keypair.generate();
    createKey = Keypair.generate();
    debtMintKeypair = Keypair.generate();
    collateralMintKeypair = Keypair.generate();

    // Airdrop SOL to test accounts
    const airdropAmount = 10 * LAMPORTS_PER_SOL;
    await provider.connection.requestAirdrop(admin.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(lender.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(borrower.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(
      createKey.publicKey,
      airdropAmount
    );

    // Wait for confirmations
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Derive vault authority PDA
    [vaultAuthority, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority")],
      program.programId
    );

    // Create test mints
    debtMint = await createTestMint(provider, admin);
    collateralMint = await createTestMint(provider, admin);

    // Mint debt tokens to lender
    const lenderDebtTokenAccount = getAssociatedTokenAddressSync(
      debtMint,
      lender.publicKey,
      true
    );
    await createAssociatedTokenAccount(
      provider.connection,
      admin,
      debtMint,
      lender.publicKey
    );
    await mintTo(
      provider.connection,
      admin,
      debtMint,
      lenderDebtTokenAccount,
      admin,
      1000000000
    );

    // Mint collateral tokens to borrower
    const borrowerCollateralTokenAccount = getAssociatedTokenAddressSync(
      collateralMint,
      borrower.publicKey,
      true
    );
    await createAssociatedTokenAccount(
      provider.connection,
      admin,
      collateralMint,
      borrower.publicKey
    );
    await mintTo(
      provider.connection,
      admin,
      collateralMint,
      borrowerCollateralTokenAccount,
      admin,
      2000000000
    );
  });

  // Helper function to create a test mint
  async function createTestMint(provider, payer) {
    const mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey, // mint authority
      null, // freeze authority
      9 // decimals
    );
    return mint;
  }

  describe("init_vault_authority", () => {
    it("should fail if not called by admin", async () => {
      try {
        await program.methods
          .initVaultAuthority()
          .accounts({
            vaultAuthority: vaultAuthority,
            admin: lender.publicKey, // Wrong admin
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([lender])
          .rpc();

        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain("An address constraint was violated");
      }
    });

    it("should initialize vault authority", async () => {
      try {
        const tx = await program.methods
          .initVaultAuthority()
          .accounts({
            vaultAuthority: vaultAuthority,
            admin: ADMIN_AUTHORITY,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([admin])
          .rpc();

        expect(tx).toBeDefined();

        // Verify vault authority was created
        const vaultAuthorityAccount =
          await program.account.vaultAuthority.fetch(vaultAuthority);
        expect(vaultAuthorityAccount.version).toBe(1);
        expect(vaultAuthorityAccount.bump).toBe(vaultAuthorityBump);
        expect(vaultAuthorityAccount.allowedMints.length).toBeGreaterThan(0);
      } catch (error) {
        // If already initialized, that's okay
        if (!error.message.includes("already in use")) {
          throw error;
        }
      }
    });
  });

  describe("init_vault_token_account", () => {
    it("should fail if not called by admin", async () => {
      const testMint = await createTestMint(provider, admin);
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        testMint,
        vaultAuthority,
        true
      );

      try {
        await program.methods
          .initVaultTokenAccount()
          .accounts({
            vaultAuthority: vaultAuthority,
            vaultMint: testMint,
            vaultTokenAccount: vaultTokenAccount,
            admin: lender.publicKey, // Wrong admin
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([lender])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("An address constraint was violated");
      }
    });

    it("should initialize vault token account and add mint to allowed list", async () => {
      const testMint = await createTestMint(provider, admin);
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        testMint,
        vaultAuthority,
        true
      );

      try {
        const tx = await program.methods
          .initVaultTokenAccount()
          .accounts({
            vaultAuthority: vaultAuthority,
            vaultMint: testMint,
            vaultTokenAccount: vaultTokenAccount,
            admin: ADMIN_AUTHORITY,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([admin])
          .rpc();

        expect(tx).toBeDefined();

        // Verify mint was added to allowed list
        const vaultAuthorityAccount =
          await program.account.vaultAuthority.fetch(vaultAuthority);
        expect(vaultAuthorityAccount.allowedMints).toContainEqual(testMint);
      } catch (error) {
        // Token account might already exist
        if (!error.message.includes("already in use")) {
          throw error;
        }
      }
    });

    // // init debt token account and collateral token account
    // it("should init debt token account and collateral token account", async () => {
    //   const debtTokenAccount = getAssociatedTokenAddressSync(
    //     debtMint,
    //     vaultAuthority,
    //     true
    //   );

    //   const tx1 = await program.methods
    //     .initVaultTokenAccount()
    //     .accounts({
    //       vaultAuthority: vaultAuthority,
    //       vaultMint: debtMint,
    //       vaultTokenAccount: debtTokenAccount,
    //       admin: ADMIN_AUTHORITY,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    //       systemProgram: SystemProgram.programId,
    //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //     })
    //     .signers([admin])
    //     .rpc();

    //   expect(tx1).toBeDefined();

    //   const collateralTokenAccount = getAssociatedTokenAddressSync(
    //     collateralMint,
    //     vaultAuthority,
    //     true
    //   );

    //   const tx2 = await program.methods
    //     .initVaultTokenAccount()
    //     .accounts({
    //       vaultAuthority: vaultAuthority,
    //       vaultMint: collateralMint,
    //       vaultTokenAccount: collateralTokenAccount,
    //       admin: ADMIN_AUTHORITY,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    //       systemProgram: SystemProgram.programId,
    //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //     })
    //     .signers([admin])
    //     .rpc();

    //   expect(tx2).toBeDefined();
    // });
  });

  describe("update_vault_disabled_mints", () => {
    it("should disable an allowed mint", async () => {
      const testMint = await createTestMint(provider, admin);

      // First ensure mint is allowed (via init_vault_token_account)
      try {
        const vaultTokenAccount = getAssociatedTokenAddressSync(
          testMint,
          vaultAuthority,
          true
        );
        await program.methods
          .initVaultTokenAccount()
          .accounts({
            vaultAuthority: vaultAuthority,
            vaultMint: testMint,
            vaultTokenAccount: vaultTokenAccount,
            admin: ADMIN_AUTHORITY,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([admin])
          .rpc();
      } catch (e) {
        // Might already exist
      }

      // Now disable it
      const tx = await program.methods
        .updateVaultDisabledMints()
        .accounts({
          vaultAuthority: vaultAuthority,
          vaultMintToBeAllowed: null,
          vaultMintToBeDisabled: testMint,
          admin: ADMIN_AUTHORITY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      expect(tx).toBeDefined();

      const vaultAuthorityAccount = await program.account.vaultAuthority.fetch(
        vaultAuthority
      );
      expect(vaultAuthorityAccount.disabledMints).toContainEqual(testMint);
    });

    it("should fail if neither mint is provided", async () => {
      try {
        await program.methods
          .updateVaultDisabledMints()
          .accounts({
            vaultAuthority: vaultAuthority,
            vaultMintToBeAllowed: null,
            vaultMintToBeDisabled: null,
            admin: ADMIN_AUTHORITY,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("MissingMintToBeAllowedOrDisabled");
      }
    });
  });

  describe("create_borrow_offer", () => {
    let loanPDA;
    let loanBump;

    beforeEach(() => {
      [loanPDA, loanBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKey.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should create a public borrow offer", async () => {
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400); // 1 day
      const apy = 10;

      // Ensure mints are allowed
      try {
        const vaultDebtTokenAccount = getAssociatedTokenAddressSync(
          debtMint,
          vaultAuthority,
          true
        );
        await program.methods
          .initVaultTokenAccount()
          .accounts({
            vaultAuthority: vaultAuthority,
            vaultMint: debtMint,
            vaultTokenAccount: vaultDebtTokenAccount,
            admin: ADMIN_AUTHORITY,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([admin])
          .rpc();
      } catch (e) {}

      try {
        const vaultCollateralTokenAccount = getAssociatedTokenAddressSync(
          collateralMint,
          vaultAuthority,
          true
        );
        await program.methods
          .initVaultTokenAccount()
          .accounts({
            vaultAuthority: vaultAuthority,
            vaultMint: collateralMint,
            vaultTokenAccount: vaultCollateralTokenAccount,
            admin: ADMIN_AUTHORITY,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([admin])
          .rpc();
      } catch (e) {}

      const lenderDebtTokenAccount = getAssociatedTokenAddressSync(
        debtMint,
        lender.publicKey,
        false
      );

      const tx = await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: lenderDebtTokenAccount,
          createKey: createKey.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKey, lender])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.lender.toString()).toBe(lender.publicKey.toString());
      expect(loanAccount.debtAmount.toString()).toBe(debtAmount.toString());
      expect(loanAccount.collateralAmount.toString()).toBe(
        collateralAmount.toString()
      );
      expect(loanAccount.status).toBe(0); // Not accepted
    });

    it("should create a private borrow offer", async () => {
      const newCreateKey = Keypair.generate();
      const [newLoanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), newCreateKey.publicKey.toBuffer()],
        program.programId
      );

      await provider.connection.requestAirdrop(
        newCreateKey.publicKey,
        LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      const lenderDebtTokenAccount = getAssociatedTokenAddressSync(
        debtMint,
        lender.publicKey,
        false
      );

      const tx = await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: true,
          borrower: borrower.publicKey,
        })
        .accounts({
          loan: newLoanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: lenderDebtTokenAccount,
          createKey: newCreateKey.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([newCreateKey, lender])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(newLoanPDA);
      expect(loanAccount.privateStatus).toBe(1); // Private borrower
      expect(loanAccount.borrower.toString()).toBe(
        borrower.publicKey.toString()
      );
    });

    it("should fail if private offer missing borrower", async () => {
      const newCreateKey = Keypair.generate();
      const [newLoanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), newCreateKey.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .createBorrowOffer({
            debtAmount: new anchor.BN(1000000),
            collateralAmount: new anchor.BN(2000000),
            duration: new anchor.BN(86400),
            apy: 10,
            isPrivate: true,
            borrower: null, // Missing borrower
          })
          .accounts({
            loan: newLoanPDA,
            debtMint: debtMint,
            collateralMint: collateralMint,
            vaultAuthority: vaultAuthority,
            vaultDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              vaultAuthority,
              true
            ),
            lenderDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              lender.publicKey,
              false
            ),
            createKey: newCreateKey.publicKey,
            lender: lender.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([newCreateKey, lender])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("MissingPrivateBorrower");
      }
    });
  });

  describe("create_lend_offer", () => {
    it("should create a public lend offer", async () => {
      const newCreateKey = Keypair.generate();
      const [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), newCreateKey.publicKey.toBuffer()],
        program.programId
      );

      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      const borrowerCollateralTokenAccount = getAssociatedTokenAddressSync(
        collateralMint,
        borrower.publicKey,
        false
      );

      const tx = await program.methods
        .createLendOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          lender: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerCollateralTokenAccount: borrowerCollateralTokenAccount,
          createKey: newCreateKey.publicKey,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([newCreateKey, borrower])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.borrower.toString()).toBe(
        borrower.publicKey.toString()
      );
      expect(loanAccount.status).toBe(0);
    });

    it("should create a private lend offer", async () => {
      const newCreateKey = Keypair.generate();
      const [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), newCreateKey.publicKey.toBuffer()],
        program.programId
      );

      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      const borrowerCollateralTokenAccount = getAssociatedTokenAddressSync(
        collateralMint,
        borrower.publicKey,
        false
      );

      const tx = await program.methods
        .createLendOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: true,
          lender: lender.publicKey,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerCollateralTokenAccount: borrowerCollateralTokenAccount,
          createKey: newCreateKey.publicKey,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([newCreateKey, borrower])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.privateStatus).toBe(2); // Private lender
      expect(loanAccount.lender.toString()).toBe(lender.publicKey.toString());
    });
  });

  describe("accept_borrow_offer", () => {
    let loanPDA;
    let createKeyForAccept;

    beforeAll(async () => {
      createKeyForAccept = Keypair.generate();
      [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKeyForAccept.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should accept a public borrow offer", async () => {
      // First create the borrow offer
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForAccept.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForAccept, lender])
        .rpc();

      // Now accept it
      const tx = await program.methods
        .acceptBorrowOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            borrower.publicKey,
            false
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.status).toBe(1); // Accepted
      expect(loanAccount.borrower.toString()).toBe(
        borrower.publicKey.toString()
      );
      expect(loanAccount.start).not.toBeNull();
    });

    it("should fail if loan is not in pending status", async () => {
      // Try to accept an already accepted loan
      try {
        await program.methods
          .acceptBorrowOffer()
          .accounts({
            loan: loanPDA,
            debtMint: debtMint,
            collateralMint: collateralMint,
            vaultAuthority: vaultAuthority,
            vaultDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              vaultAuthority,
              true
            ),
            vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              vaultAuthority,
              true
            ),
            borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              borrower.publicKey,
              false
            ),
            borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              borrower.publicKey,
              false
            ),
            borrower: borrower.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([borrower])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("InvalidLoanStatus");
      }
    });
  });

  describe("accept_lend_offer", () => {
    let loanPDA;
    let createKeyForAccept;

    beforeAll(async () => {
      createKeyForAccept = Keypair.generate();
      [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKeyForAccept.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should accept a public lend offer", async () => {
      // First create the lend offer
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createLendOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          lender: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          createKey: createKeyForAccept.publicKey,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForAccept, borrower])
        .rpc();

      // Now accept it
      const tx = await program.methods
        .acceptLendOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            borrower.publicKey,
            false
          ),
          lender: lender.publicKey,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([lender])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.status).toBe(1); // Accepted
      expect(loanAccount.lender.toString()).toBe(lender.publicKey.toString());
      expect(loanAccount.start).not.toBeNull();
    });
  });

  describe("rescind_borrow_offer", () => {
    let loanPDA;
    let createKeyForRescind;

    beforeAll(async () => {
      createKeyForRescind = Keypair.generate();
      [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKeyForRescind.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should rescind a borrow offer", async () => {
      // First create the borrow offer
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForRescind.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForRescind, lender])
        .rpc();

      // Now rescind it
      const tx = await program.methods
        .rescindBorrowOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([lender])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.status).toBe(2); // Rescinded
    });

    it("should fail if loan is not in pending status", async () => {
      // Try to rescind an already accepted loan
      try {
        await program.methods
          .rescindBorrowOffer()
          .accounts({
            loan: loanPDA,
            debtMint: debtMint,
            collateralMint: collateralMint,
            vaultAuthority: vaultAuthority,
            vaultDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              vaultAuthority,
              true
            ),
            lenderDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              lender.publicKey,
              false
            ),
            lender: lender.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([lender])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("InvalidLoanStatus");
      }
    });
  });

  describe("rescind_lend_offer", () => {
    let loanPDA;
    let createKeyForRescind;

    beforeAll(async () => {
      createKeyForRescind = Keypair.generate();
      [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKeyForRescind.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should rescind a lend offer", async () => {
      // First create the lend offer
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createLendOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          lender: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          createKey: createKeyForRescind.publicKey,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForRescind, borrower])
        .rpc();

      // Now rescind it
      const tx = await program.methods
        .rescindLendOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.status).toBe(2); // Rescinded
    });
  });

  describe("add_collateral", () => {
    let loanPDA;
    let createKeyForAddCollateral;

    beforeEach(async () => {
      createKeyForAddCollateral = Keypair.generate();
      [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKeyForAddCollateral.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should add collateral to an active loan", async () => {
      // First create and accept a borrow offer
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForAddCollateral.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForAddCollateral, lender])
        .rpc();

      await program.methods
        .acceptBorrowOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            borrower.publicKey,
            false
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      // Now add collateral
      const addAmount = new anchor.BN(500000);
      const tx = await program.methods
        .addCollateral({ addAmount: addAmount })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      const expectedCollateral = collateralAmount.add(addAmount);
      expect(loanAccount.collateralAmount.toString()).toBe(
        expectedCollateral.toString()
      );
    });

    it("should fail if loan is not active", async () => {
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForAddCollateral.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForAddCollateral, lender])
        .rpc();

      const addAmount = new anchor.BN(500000);

      try {
        await program.methods
          .addCollateral({ addAmount: addAmount })
          .accounts({
            loan: loanPDA,
            debtMint: debtMint,
            collateralMint: collateralMint,
            vaultAuthority: vaultAuthority,
            vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              vaultAuthority,
              true
            ),
            borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              borrower.publicKey,
              false
            ),
            borrower: borrower.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([borrower])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("InvalidLoanStatus");
      }
    });
  });

  describe("repay_loan", () => {
    let loanPDA;
    let createKeyForRepay;

    beforeEach(async () => {
      createKeyForRepay = Keypair.generate();
      [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKeyForRepay.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should repay a loan partially", async () => {
      // First create and accept a borrow offer
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForRepay.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForRepay, lender])
        .rpc();

      await program.methods
        .acceptBorrowOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            borrower.publicKey,
            false
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      // Now repay partially
      const repayAmount = new anchor.BN(500000);
      const tx = await program.methods
        .repayLoan({ repayAmount: repayAmount })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            borrower.publicKey,
            false
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          lender: lender.publicKey,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.debtAmount.toNumber()).toBeLessThan(
        debtAmount.toNumber()
      );
    });

    it("should fully repay a loan", async () => {
      const fullRepayCreateKey = Keypair.generate();
      const [fullRepayLoanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), fullRepayCreateKey.publicKey.toBuffer()],
        program.programId
      );

      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400); // 1 day
      const apy = 10;

      // Create borrow offer
      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: fullRepayLoanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(debtMint, vaultAuthority, true),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(debtMint, lender.publicKey, false),
          createKey: fullRepayCreateKey.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([fullRepayCreateKey, lender])
        .rpc();

      // Accept borrow offer
      await program.methods
        .acceptBorrowOffer()
        .accounts({
          loan: fullRepayLoanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(debtMint, vaultAuthority, true),
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(debtMint, borrower.publicKey, false),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(collateralMint, borrower.publicKey, false),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      // Calculate total owed: debtAmount + interest
      // interest = debtAmount * apy * duration / (100 * 365 * 24 * 3600)
      const SECONDS_PER_YEAR = 100 * 365 * 24 * 3600;
      const interest = debtAmount.toNumber() * apy * duration.toNumber() / SECONDS_PER_YEAR;
      const totalOwed = new anchor.BN(Math.ceil(debtAmount.toNumber() + interest));

      // Fully repay
      const tx = await program.methods
        .repayLoan({ repayAmount: totalOwed })
        .accounts({
          loan: fullRepayLoanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(collateralMint, vaultAuthority, true),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(collateralMint, borrower.publicKey, false),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(debtMint, borrower.publicKey, false),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(debtMint, lender.publicKey, false),
          lender: lender.publicKey,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(fullRepayLoanPDA);
      expect(loanAccount.status).toBe(3); // Repaid
    });

    it("should fail if loan is not active", async () => {
      const repayAmount = new anchor.BN(500000);

      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(86400);
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForRepay.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForRepay, lender])
        .rpc();

      try {
        await program.methods
          .repayLoan({ repayAmount: repayAmount })
          .accounts({
            loan: loanPDA,
            debtMint: debtMint,
            collateralMint: collateralMint,
            vaultAuthority: vaultAuthority,
            vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              vaultAuthority,
              true
            ),
            borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              borrower.publicKey,
              false
            ),
            borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              borrower.publicKey,
              false
            ),
            lenderDebtTokenAccount: getAssociatedTokenAddressSync(
              debtMint,
              lender.publicKey,
              false
            ),
            lender: lender.publicKey,
            borrower: borrower.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([borrower])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain("InvalidLoanStatus");
      }
    });
  });

  describe("foreclose_loan", () => {
    let loanPDA;
    let createKeyForForeclose;

    beforeEach(async () => {
      createKeyForForeclose = Keypair.generate();
      [loanPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), createKeyForForeclose.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should foreclose an expired loan", async () => {
      // First create and accept a borrow offer with short duration
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(1); // Very short duration for testing
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForForeclose.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForForeclose, lender])
        .rpc();

      await program.methods
        .acceptBorrowOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            borrower.publicKey,
            false
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      // Wait for loan to expire
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Now foreclose
      const tx = await program.methods
        .forecloseLoan()
        .accounts({
          loan: loanPDA,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          lenderCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            lender.publicKey,
            false
          ),
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([lender])
        .rpc();

      expect(tx).toBeDefined();

      const loanAccount = await program.account.loan.fetch(loanPDA);
      expect(loanAccount.status).toBe(4); // Foreclosed
    });

    it("should fail if loan is not expired", async () => {
      // First create and accept a borrow offer with short duration
      const debtAmount = new anchor.BN(1000000);
      const collateralAmount = new anchor.BN(2000000);
      const duration = new anchor.BN(2); // Very short duration for testing
      const apy = 10;

      await program.methods
        .createBorrowOffer({
          debtAmount: debtAmount,
          collateralAmount: collateralAmount,
          duration: duration,
          apy: apy,
          isPrivate: false,
          borrower: null,
        })
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          lenderDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            lender.publicKey,
            false
          ),
          createKey: createKeyForForeclose.publicKey,
          lender: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([createKeyForForeclose, lender])
        .rpc();

      await program.methods
        .acceptBorrowOffer()
        .accounts({
          loan: loanPDA,
          debtMint: debtMint,
          collateralMint: collateralMint,
          vaultAuthority: vaultAuthority,
          vaultDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            vaultAuthority,
            true
          ),
          vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            vaultAuthority,
            true
          ),
          borrowerDebtTokenAccount: getAssociatedTokenAddressSync(
            debtMint,
            borrower.publicKey,
            false
          ),
          borrowerCollateralTokenAccount: getAssociatedTokenAddressSync(
            collateralMint,
            borrower.publicKey,
            false
          ),
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([borrower])
        .rpc();

      // Wait for loan to expire
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to foreclose a non-expired loan
      try {
        await program.methods
          .forecloseLoan()
          .accounts({
            loan: loanPDA,
            collateralMint: collateralMint,
            vaultAuthority: vaultAuthority,
            vaultCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              vaultAuthority,
              true
            ),
            lenderCollateralTokenAccount: getAssociatedTokenAddressSync(
              collateralMint,
              lender.publicKey,
              false
            ),
            lender: lender.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([lender])
          .rpc();

        expect(true).toBe(false);
      } catch (error) {
        expect(
          error.message.includes("LoanNotExpired") ||
            error.message.includes("InvalidLoanStatus")
        ).toBe(true);
      }
    });
  });
});
