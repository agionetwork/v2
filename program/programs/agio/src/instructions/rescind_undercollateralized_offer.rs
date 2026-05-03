use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

/// Permissionless rescission of under-collateralized pending offers.
///
/// Anyone can call this instruction when a pending loan offer's collateral ratio
/// has dropped below `vault_authority.min_collateral_ratio_bps` (130%).
/// The caller pays tx fees but does NOT need to be the offer creator.
///
/// Determines the offer type from the loan fields:
/// - `lender.is_some() && borrower.is_none()` → borrow offer (lender locked debt) → return debt to lender
/// - `borrower.is_some() && lender.is_none()` → lend offer (borrower locked collateral) → return collateral to borrower
#[derive(Accounts)]
pub struct RescindUndercollateralizedOffer<'info> {
    #[account(
        mut,
        seeds = [Loan::PREFIX.as_bytes(), loan.create_key.as_ref()],
        bump = loan.bump,
        constraint = loan.status == LoanStatus::Pending as u8 @ AgioError::InvalidLoanStatus,
    )]
    pub loan: Box<Account<'info, Loan>>,
    #[account(
        address = loan.collateral_mint,
    )]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        address = loan.debt_mint,
    )]
    pub debt_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump = vault_authority.bump,
        constraint = vault_authority.version > 0 @ AgioError::InvalidVaultAuthority,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,

    // --- Pyth oracle accounts ---
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), loan.collateral_mint.as_ref()],
        bump = collateral_price_feed_config.bump,
        constraint = collateral_price_feed_config.mint == loan.collateral_mint @ AgioError::PriceFeedConfigMismatch,
    )]
    pub collateral_price_feed_config: Box<Account<'info, PriceFeedConfig>>,
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), loan.debt_mint.as_ref()],
        bump = debt_price_feed_config.bump,
        constraint = debt_price_feed_config.mint == loan.debt_mint @ AgioError::PriceFeedConfigMismatch,
    )]
    pub debt_price_feed_config: Box<Account<'info, PriceFeedConfig>>,
    pub collateral_price_update: Box<Account<'info, PriceUpdateV2>>,
    pub debt_price_update: Box<Account<'info, PriceUpdateV2>>,

    // --- Vault token accounts (one of these holds the locked funds) ---
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = debt_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,

    // --- Creator return accounts (one of these receives returned funds) ---
    /// CHECK: Borrower wallet from the loan account. Validated by constraint.
    /// Only used for lend offers (borrower locked collateral).
    #[account(mut)]
    pub borrower: Option<UncheckedAccount<'info>>,
    /// Borrower's collateral ATA — receives returned collateral for lend offers.
    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = collateral_mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Lender wallet from the loan account. Validated by constraint.
    /// Only used for borrow offers (lender locked debt).
    #[account(mut)]
    pub lender: Option<UncheckedAccount<'info>>,
    /// Lender's debt ATA — receives returned debt tokens for borrow offers.
    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = debt_mint,
        associated_token::authority = lender,
        associated_token::token_program = token_program,
    )]
    pub lender_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,

    /// Caller = whoever triggers the rescission (bot/keeper). Pays tx fees + ATA init.
    #[account(mut)]
    pub caller: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn rescind_undercollateralized_offer<'info>(
    ctx: Context<'_, '_, '_, 'info, RescindUndercollateralizedOffer<'info>>,
) -> Result<()> {
    let loan = &ctx.accounts.loan;
    let vault_authority = &ctx.accounts.vault_authority;

    // 1. Read Pyth prices
    let clock = Clock::get()?;
    let collateral_feed_id = ctx.accounts.collateral_price_feed_config.feed_id;
    let collateral_price_data = ctx
        .accounts
        .collateral_price_update
        .get_price_no_older_than_with_custom_verification_level(
            &clock,
            MAX_PYTH_PRICE_AGE_SECS,
            &collateral_feed_id,
            VerificationLevel::Partial { num_signatures: 1 },
        )
        .map_err(|_| error!(AgioError::PriceFeedStale))?;

    let debt_feed_id = ctx.accounts.debt_price_feed_config.feed_id;
    let debt_price_data = ctx
        .accounts
        .debt_price_update
        .get_price_no_older_than_with_custom_verification_level(
            &clock,
            MAX_PYTH_PRICE_AGE_SECS,
            &debt_feed_id,
            VerificationLevel::Partial { num_signatures: 1 },
        )
        .map_err(|_| error!(AgioError::PriceFeedStale))?;

    require!(collateral_price_data.price > 0, AgioError::PriceFeedNegative);
    require!(debt_price_data.price > 0, AgioError::PriceFeedNegative);

    // 2. Calculate collateral ratio and verify it's below min_collateral_ratio_bps
    let min_bps = vault_authority.min_collateral_ratio_bps;
    require!(min_bps > 0, AgioError::LoanNotUndercollateralized);

    let col_combined = i64::from(collateral_price_data.exponent)
        .checked_sub(i64::from(ctx.accounts.collateral_price_feed_config.decimals))
        .ok_or(AgioError::NumericalOverflowError)?;
    let debt_combined = i64::from(debt_price_data.exponent)
        .checked_sub(i64::from(ctx.accounts.debt_price_feed_config.decimals))
        .ok_or(AgioError::NumericalOverflowError)?;

    let shift = col_combined.min(debt_combined);
    let col_shift = u32::try_from(
        col_combined
            .checked_sub(shift)
            .ok_or(AgioError::NumericalOverflowError)?,
    )
    .map_err(|_| AgioError::NumericalOverflowError)?;
    let debt_shift = u32::try_from(
        debt_combined
            .checked_sub(shift)
            .ok_or(AgioError::NumericalOverflowError)?,
    )
    .map_err(|_| AgioError::NumericalOverflowError)?;

    let collateral_price_u128 = u128::try_from(collateral_price_data.price)
        .map_err(|_| AgioError::PriceFeedNegative)?;
    let debt_price_u128 = u128::try_from(debt_price_data.price)
        .map_err(|_| AgioError::PriceFeedNegative)?;

    let col_value = u128::from(loan.collateral_amount)
        .checked_mul(collateral_price_u128)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(10u128.pow(col_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    let debt_value = u128::from(loan.debt_amount)
        .checked_mul(debt_price_u128)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(10u128.pow(debt_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    // ratio < min_bps means: col_value * BPS_DIVISOR < debt_value * min_bps
    let lhs = col_value
        .checked_mul(u128::from(BPS_DIVISOR))
        .ok_or(AgioError::NumericalOverflowError)?;
    let rhs = debt_value
        .checked_mul(u128::from(min_bps))
        .ok_or(AgioError::NumericalOverflowError)?;

    require!(lhs < rhs, AgioError::LoanNotUndercollateralized);

    // 3. Determine offer type and return locked funds
    let signer_seeds: &[&[&[u8]]] = &[&[
        VaultAuthority::PREFIX.as_bytes(),
        &[vault_authority.bump],
    ]];

    let is_borrow_offer = loan.lender.is_some() && loan.borrower.is_none();
    let is_lend_offer = loan.borrower.is_some() && loan.lender.is_none();

    if is_borrow_offer {
        // Borrow offer: lender locked debt tokens → return debt to lender
        let lender = ctx.accounts.lender.as_ref()
            .ok_or(AgioError::MissingLender)?;
        require!(
            loan.lender.map_or(false, |l| l == lender.key()),
            AgioError::LenderMismatch
        );

        let vault_debt_ta = ctx.accounts.vault_debt_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;
        let lender_debt_ta = ctx.accounts.lender_debt_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.debt_mint.to_account_info(),
            from: vault_debt_ta.to_account_info(),
            to: lender_debt_ta.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_context =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
                .with_signer(signer_seeds);

        transfer_checked(cpi_context, loan.debt_amount, ctx.accounts.debt_mint.decimals)?;

        msg!(
            "Under-collateralized borrow offer rescinded. Returned {} debt tokens to lender {}",
            loan.debt_amount,
            lender.key()
        );
    } else if is_lend_offer {
        // Lend offer: borrower locked collateral → return collateral to borrower
        let borrower = ctx.accounts.borrower.as_ref()
            .ok_or(AgioError::MissingBorrower)?;
        require!(
            loan.borrower.map_or(false, |b| b == borrower.key()),
            AgioError::BorrowerMismatch
        );

        let vault_collateral_ta = ctx.accounts.vault_collateral_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;
        let borrower_collateral_ta = ctx.accounts.borrower_collateral_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.collateral_mint.to_account_info(),
            from: vault_collateral_ta.to_account_info(),
            to: borrower_collateral_ta.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_context =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
                .with_signer(signer_seeds);

        transfer_checked(
            cpi_context,
            loan.collateral_amount,
            ctx.accounts.collateral_mint.decimals,
        )?;

        msg!(
            "Under-collateralized lend offer rescinded. Returned {} collateral to borrower {}",
            loan.collateral_amount,
            borrower.key()
        );
    } else {
        return Err(error!(AgioError::InvalidLoanStatus));
    }

    // 4. Update loan status
    let loan = &mut ctx.accounts.loan;
    loan.status = LoanStatus::Rescinded as u8;

    Ok(())
}
