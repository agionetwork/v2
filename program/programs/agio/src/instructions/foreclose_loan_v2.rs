use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::utils::liquidation::{calculate_liquidation, calculate_outstanding_debt};

/// Permissionless foreclosure for expired loans.
///
/// Anyone can call this instruction when a loan has expired (past its duration).
/// The caller pays tx fees but does NOT need to be the lender.
///
/// Collateral is split using Pyth oracle prices:
/// - Lender receives: debt coverage (principal + interest in collateral terms) + 50% of excess
/// - Treasury receives: 50% of excess collateral
/// - If under-collateralized: lender gets all, treasury gets nothing
#[derive(Accounts)]
pub struct ForecloseLoanV2<'info> {
    #[account(
        mut,
        seeds = [Loan::PREFIX.as_bytes(), loan.create_key.as_ref()],
        bump = loan.bump,
        constraint = loan.status == LoanStatus::Accepted as u8 @ AgioError::InvalidLoanStatus,
    )]
    pub loan: Box<Account<'info, Loan>>,
    #[account(
        address = loan.collateral_mint,
    )]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump = vault_authority.bump,
        constraint = vault_authority.version > 0 @ AgioError::InvalidVaultAuthority,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), loan.collateral_mint.as_ref()],
        bump = collateral_price_feed_config.bump,
        constraint = collateral_price_feed_config.mint == loan.collateral_mint @ AgioError::PriceFeedConfigMismatch,
    )]
    pub collateral_price_feed_config: Account<'info, PriceFeedConfig>,
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), loan.debt_mint.as_ref()],
        bump = debt_price_feed_config.bump,
        constraint = debt_price_feed_config.mint == loan.debt_mint @ AgioError::PriceFeedConfigMismatch,
    )]
    pub debt_price_feed_config: Account<'info, PriceFeedConfig>,
    pub collateral_price_update: Account<'info, PriceUpdateV2>,
    pub debt_price_update: Account<'info, PriceUpdateV2>,
    /// Lender's collateral token account — receives their share.
    /// NOT a signer: this is permissionless, anyone can trigger foreclosure.
    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = collateral_mint,
        associated_token::authority = lender,
        associated_token::token_program = token_program,
    )]
    pub lender_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Lender wallet from the loan account. Validated by constraint below.
    /// NOT a signer — permissionless foreclosure.
    #[account(
        mut,
        constraint = loan.lender.is_some() @ AgioError::MissingLender,
        constraint = loan.lender.map_or(false, |l| l == lender.key()) @ AgioError::LenderMismatch,
    )]
    pub lender: UncheckedAccount<'info>,
    /// Caller = whoever triggers the foreclosure (bot/keeper). Pays tx fees + ATA init.
    #[account(mut)]
    pub caller: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn foreclose_loan_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, ForecloseLoanV2<'info>>,
) -> Result<()> {
    let loan = &ctx.accounts.loan;
    let vault_authority = &ctx.accounts.vault_authority;
    let clock = Clock::get()?;

    // 1. Verify loan is expired
    require!(
        loan.status == LoanStatus::Accepted as u8,
        AgioError::InvalidLoanStatus
    );
    let start = loan.start.ok_or(AgioError::MissingLoanStart)?;
    require!(
        start
            .checked_add(
                i64::try_from(loan.duration)
                    .map_err(|_| AgioError::NumericalOverflowError)?,
            )
            .ok_or(AgioError::NumericalOverflowError)?
            <= clock.unix_timestamp,
        AgioError::LoanNotExpired
    );

    // 2. Read Pyth prices
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

    // 3. Calculate outstanding debt (full term interest for expired loans)
    let elapsed = u64::try_from(
        clock
            .unix_timestamp
            .checked_sub(start)
            .ok_or(AgioError::NumericalOverflowError)?,
    )
    .map_err(|_| AgioError::NumericalOverflowError)?;
    let outstanding_debt = calculate_outstanding_debt(loan.debt_amount, loan.apy, elapsed)?;

    // 4. Calculate collateral split using oracle prices.
    // Force liquidation: expired loans must distribute collateral regardless of
    // the collateral/debt ratio. Without force=true, healthy expired loans hit
    // the !is_liquidatable branch and the lender receives nothing (BUG-030).
    let collateral_price_u64 = u64::try_from(collateral_price_data.price)
        .map_err(|_| AgioError::PriceFeedNegative)?;
    let debt_price_u64 = u64::try_from(debt_price_data.price)
        .map_err(|_| AgioError::PriceFeedNegative)?;
    let result = calculate_liquidation(
        loan.collateral_amount,
        collateral_price_u64,
        collateral_price_data.exponent,
        ctx.accounts.collateral_price_feed_config.decimals,
        outstanding_debt,
        debt_price_u64,
        debt_price_data.exponent,
        ctx.accounts.debt_price_feed_config.decimals,
        BPS_DIVISOR as u16,
        true, // force: expiration triggers foreclosure regardless of ratio
    )?;

    // Lender gets: debt coverage + their share of excess
    let lender_amount = result
        .debt_in_collateral
        .checked_add(result.lender_excess)
        .ok_or(AgioError::NumericalOverflowError)?;

    let treasury_amount = result.treasury_excess;

    // 5. Transfer collateral from vault
    let signer_seeds: &[&[&[u8]]] = &[&[
        VaultAuthority::PREFIX.as_bytes(),
        &[vault_authority.bump],
    ]];

    let vault_collateral_token_account = ctx
        .accounts
        .vault_collateral_token_account
        .as_ref()
        .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

    let lender_collateral_token_account = ctx
        .accounts
        .lender_collateral_token_account
        .as_ref()
        .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

    // Transfer lender's share (debt coverage + 50% excess)
    if lender_amount > 0 {
        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.collateral_mint.to_account_info(),
            from: vault_collateral_token_account.to_account_info(),
            to: lender_collateral_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_context =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
                .with_signer(signer_seeds);
        transfer_checked(
            cpi_context,
            lender_amount,
            ctx.accounts.collateral_mint.decimals,
        )?;
    }

    // Transfer treasury's share (50% excess) via remaining_accounts
    if treasury_amount > 0 {
        let treasury_collateral_ta = ctx
            .remaining_accounts
            .first()
            .ok_or(AgioError::MissingTreasuryAccount)?;

        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.collateral_mint.to_account_info(),
            from: vault_collateral_token_account.to_account_info(),
            to: treasury_collateral_ta.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_context =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
                .with_signer(signer_seeds);
        transfer_checked(
            cpi_context,
            treasury_amount,
            ctx.accounts.collateral_mint.decimals,
        )?;
    }

    // 6. Update loan status
    let loan = &mut ctx.accounts.loan;
    loan.status = LoanStatus::Foreclosed as u8;

    msg!(
        "Permissionless foreclosure complete. Lender: {} (debt: {} + excess: {}). Treasury: {}",
        lender_amount,
        result.debt_in_collateral,
        result.lender_excess,
        treasury_amount
    );

    Ok(())
}
