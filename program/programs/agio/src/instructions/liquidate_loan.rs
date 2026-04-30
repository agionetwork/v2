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

#[derive(Accounts)]
pub struct LiquidateLoan<'info> {
    #[account(
        mut,
        constraint = loan.lender.is_some() @ AgioError::MissingLender,
        constraint = loan.lender.map_or(false, |l| l == lender.key()) @ AgioError::LenderMismatch,
    )]
    pub lender: Signer<'info>,
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
    #[account(
        init_if_needed,
        payer = lender,
        associated_token::mint = collateral_mint,
        associated_token::authority = lender,
        associated_token::token_program = token_program,
    )]
    pub lender_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn liquidate_loan<'info>(
    ctx: Context<'_, '_, '_, 'info, LiquidateLoan<'info>>,
) -> Result<()> {
    let loan = &ctx.accounts.loan;
    let vault_authority = &ctx.accounts.vault_authority;
    let clock = &ctx.accounts.clock;

    require!(
        loan.status == LoanStatus::Accepted as u8,
        AgioError::InvalidLoanStatus
    );

    let start = loan.start.ok_or(AgioError::MissingLoanStart)?;
    let elapsed = (clock.unix_timestamp - start) as u64;

    // Read Pyth prices
    let collateral_feed_id = ctx.accounts.collateral_price_feed_config.feed_id;
    let collateral_price_data = ctx
        .accounts
        .collateral_price_update
        .get_price_no_older_than_with_custom_verification_level(
            &Clock::get()?,
            MAX_PYTH_PRICE_AGE_SECS,
            &collateral_feed_id,
            VerificationLevel::Partial { num_signatures: 4 },
        )
        .map_err(|_| error!(AgioError::PriceFeedStale))?;

    let debt_feed_id = ctx.accounts.debt_price_feed_config.feed_id;
    let debt_price_data = ctx
        .accounts
        .debt_price_update
        .get_price_no_older_than_with_custom_verification_level(
            &Clock::get()?,
            MAX_PYTH_PRICE_AGE_SECS,
            &debt_feed_id,
            VerificationLevel::Partial { num_signatures: 4 },
        )
        .map_err(|_| error!(AgioError::PriceFeedStale))?;

    // Validate prices are positive
    require!(collateral_price_data.price > 0, AgioError::PriceFeedNegative);
    require!(debt_price_data.price > 0, AgioError::PriceFeedNegative);

    // Calculate outstanding debt with accrued interest
    let outstanding_debt = calculate_outstanding_debt(loan.debt_amount, loan.apy, elapsed)?;

    // Calculate liquidation — only liquidatable when collateral value <= threshold
    // (typically 120% of debt). force=false: liquidation requires undercollateralization.
    let result = calculate_liquidation(
        loan.collateral_amount,
        collateral_price_data.price as u64,
        collateral_price_data.exponent,
        ctx.accounts.collateral_price_feed_config.decimals,
        outstanding_debt,
        debt_price_data.price as u64,
        debt_price_data.exponent,
        ctx.accounts.debt_price_feed_config.decimals,
        vault_authority.liquidation_threshold_bps,
        false,
    )?;

    require!(result.is_liquidatable, AgioError::LoanNotLiquidatable);

    // Total to lender = debt_in_collateral + lender_excess
    let lender_amount = result
        .debt_in_collateral
        .checked_add(result.lender_excess)
        .ok_or(AgioError::NumericalOverflowError)?;

    let treasury_amount = result.treasury_excess;

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

    // Transfer to lender (debt coverage + lender's excess share)
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

    // Transfer treasury's excess share via remaining_accounts
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

    // Update loan status
    let loan = &mut ctx.accounts.loan;
    loan.status = LoanStatus::Liquidated as u8;

    msg!(
        "Loan liquidated. Debt covered: {} collateral tokens. Excess: {} (lender: {}, treasury: {})",
        result.debt_in_collateral,
        result.excess_collateral,
        result.lender_excess,
        result.treasury_excess
    );

    Ok(())
}
