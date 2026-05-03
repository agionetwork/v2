use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::utils::fees::{calculate_discounted_fee, calculate_fee};
use crate::utils::nft_verification::verify_nft_holder;
use crate::utils::validation::validate_collateral_ratio;

#[derive(Accounts)]
pub struct AcceptLendOffer<'info> {
    #[account(
        mut,
        seeds = [Loan::PREFIX.as_bytes(), loan.create_key.as_ref()],
        bump = loan.bump,
    )]
    pub loan: Box<Account<'info, Loan>>,
    #[account(
        address = loan.debt_mint,
    )]
    pub debt_mint: InterfaceAccount<'info, Mint>,
    #[account(
        address = loan.collateral_mint, // verify_mint: whitelist validated at loan creation
    )]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    #[account(
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump = vault_authority.bump,
        constraint = vault_authority.version > 0 @ AgioError::InvalidVaultAuthority,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    #[account(
        mut,
        associated_token::mint = debt_mint,
        associated_token::authority = lender,
        associated_token::token_program = token_program,
    )]
    pub lender_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = lender,
        associated_token::mint = debt_mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    /// Pyth price feed config for the collateral mint
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), loan.collateral_mint.as_ref()],
        bump = collateral_price_feed_config.bump,
        constraint = collateral_price_feed_config.mint == loan.collateral_mint @ AgioError::PriceFeedConfigMismatch,
    )]
    pub collateral_price_feed_config: Box<Account<'info, PriceFeedConfig>>,
    /// Pyth price feed config for the debt mint
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), loan.debt_mint.as_ref()],
        bump = debt_price_feed_config.bump,
        constraint = debt_price_feed_config.mint == loan.debt_mint @ AgioError::PriceFeedConfigMismatch,
    )]
    pub debt_price_feed_config: Box<Account<'info, PriceFeedConfig>>,
    /// Pyth price update for collateral token
    pub collateral_price_update: Box<Account<'info, PriceUpdateV2>>,
    /// Pyth price update for debt token
    pub debt_price_update: Box<Account<'info, PriceUpdateV2>>,
    #[account(mut)]
    pub lender: Signer<'info>,
    #[account(
        constraint = loan.borrower.is_some() @ AgioError::MissingBorrower,
        constraint = loan.borrower.map_or(false, |b| b == borrower.key()) @ AgioError::BorrowerMismatch,
    )]
    pub borrower: SystemAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// remaining_accounts layout (when fee > 0):
///   [0] treasury (mut) — validated against vault_authority.treasury
///   [1] treasury_debt_token_account (mut) — only for SPL tokens, omit for SOL
///   [2..4] nft_mint, nft_token_account, nft_metadata — optional, for NFT discount
pub fn accept_lend_offer<'info>(
    ctx: Context<'_, '_, '_, 'info, AcceptLendOffer<'info>>,
) -> Result<()> {
    let loan = &mut ctx.accounts.loan;

    require!(loan.status == LoanStatus::Pending as u8, AgioError::InvalidLoanStatus);
    require!(
        loan.lender.is_none() || loan.private_status == PrivateStatus::PrivateLender as u8,
        AgioError::InvalidPrivateLoanStatus
    );
    require!(
        loan.lender.map_or(true, |l| l.key() == ctx.accounts.lender.key()),
        AgioError::PrivateLenderMismatches
    );

    // Re-check collateral ratio at current oracle prices before accepting
    validate_collateral_ratio(
        loan.collateral_amount,
        &ctx.accounts.collateral_price_feed_config,
        &ctx.accounts.collateral_price_update,
        loan.debt_amount,
        &ctx.accounts.debt_price_feed_config,
        &ctx.accounts.debt_price_update,
        &ctx.accounts.vault_authority,
    )?;

    loan.lender = Some(ctx.accounts.lender.key());
    loan.start = Some(Clock::get()?.unix_timestamp);
    loan.status = LoanStatus::Accepted as u8;

    let is_sol = ctx.accounts.debt_mint.key() == WSOL_MINT.key();

    // Calculate protocol fee (paid by borrower = borrower receives less)
    let fee_bps = ctx.accounts.vault_authority.origination_fee_bps;
    let remaining = ctx.remaining_accounts;
    let fee_amount = if fee_bps > 0 && !remaining.is_empty() {
        let nft_offset = if is_sol { 1 } else { 2 };
        let nft_accounts = if remaining.len() > nft_offset {
            &remaining[nft_offset..]
        } else {
            &[]
        };

        let has_discount = if let Some(ref collection) = ctx.accounts.vault_authority.nft_collection {
            verify_nft_holder(nft_accounts, &ctx.accounts.borrower.key(), collection)?
        } else {
            false
        };

        if has_discount {
            calculate_discounted_fee(loan.debt_amount, fee_bps, ctx.accounts.vault_authority.nft_discount_bps)?
        } else {
            calculate_fee(loan.debt_amount, fee_bps)?
        }
    } else {
        0
    };

    let borrower_amount = loan.debt_amount.checked_sub(fee_amount).unwrap();

    if is_sol {
        // Transfer debt to borrower (SOL, minus fee)
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.lender.to_account_info(),
                to: ctx.accounts.borrower.to_account_info(),
            },
        );
        transfer(cpi_context, borrower_amount)?;

        // Transfer fee to treasury (SOL) — remaining[0]
        if fee_amount > 0 {
            let treasury = &remaining[0];
            require!(treasury.key() == ctx.accounts.vault_authority.treasury, AgioError::TreasuryMismatch);

            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.lender.to_account_info(),
                    to: treasury.to_account_info(),
                },
            );
            transfer(cpi_context, fee_amount)?;
        }
    } else {
        let lender_debt_token_account = ctx.accounts.lender_debt_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;
        let borrower_debt_token_account = ctx.accounts.borrower_debt_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

        // Transfer debt to borrower (SPL, minus fee)
        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.debt_mint.to_account_info(),
            from: lender_debt_token_account.to_account_info(),
            to: borrower_debt_token_account.to_account_info(),
            authority: ctx.accounts.lender.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        transfer_checked(cpi_context, borrower_amount, ctx.accounts.debt_mint.decimals)?;

        // Transfer fee to treasury (SPL) — remaining[0]=treasury, remaining[1]=treasury_ta
        if fee_amount > 0 {
            let treasury = &remaining[0];
            require!(treasury.key() == ctx.accounts.vault_authority.treasury, AgioError::TreasuryMismatch);

            let treasury_debt_ta = &remaining[1];

            let cpi_accounts = TransferChecked {
                mint: ctx.accounts.debt_mint.to_account_info(),
                from: lender_debt_token_account.to_account_info(),
                to: treasury_debt_ta.to_account_info(),
                authority: ctx.accounts.lender.to_account_info(),
            };
            let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

            transfer_checked(cpi_context, fee_amount, ctx.accounts.debt_mint.decimals)?;
        }
    }

    if fee_amount > 0 {
        msg!("Protocol fee charged: {} lamports/tokens", fee_amount);
    }

    Ok(())
}
