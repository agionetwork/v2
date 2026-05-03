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
pub struct AcceptBorrowOffer<'info> {
    #[account(
        mut,
        seeds = [Loan::PREFIX.as_bytes(), loan.create_key.as_ref()],
        bump = loan.bump,
    )]
    pub loan: Box<Account<'info, Loan>>,
    #[account(
        address = loan.debt_mint,
    )]
    pub debt_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        address = loan.collateral_mint, // verify_mint: whitelist validated at loan creation
    )]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump,
        constraint = vault_authority.version > 0 @ AgioError::InvalidVaultAuthority,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    #[account(
        mut,
        associated_token::mint = debt_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = borrower,
        associated_token::mint = debt_mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
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
    pub borrower: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// remaining_accounts layout (when fee > 0):
///   [0] treasury (mut) — validated against vault_authority.treasury
///   [1] treasury_debt_token_account (mut) — only for SPL tokens, omit for SOL
///   [2..4] nft_mint, nft_token_account, nft_metadata — optional, for NFT discount
pub fn accept_borrow_offer<'info>(
    ctx: Context<'_, '_, '_, 'info, AcceptBorrowOffer<'info>>,
) -> Result<()> {
    let loan = &mut ctx.accounts.loan;

    require!(loan.status == LoanStatus::Pending as u8, AgioError::InvalidLoanStatus);
    require!(
        loan.borrower.is_none() || loan.private_status == PrivateStatus::PrivateBorrower as u8,
        AgioError::InvalidPrivateLoanStatus
    );
    require!(
        loan.borrower.map_or(true, |b| b.key() == ctx.accounts.borrower.key()),
        AgioError::PrivateBorrowerMismatches
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

    loan.borrower = Some(ctx.accounts.borrower.key());
    loan.start = Some(Clock::get()?.unix_timestamp);
    loan.status = LoanStatus::Accepted as u8;

    let signer_seeds: &[&[&[u8]]] = &[&[
        VaultAuthority::PREFIX.as_bytes(),
        &[ctx.accounts.vault_authority.bump],
    ]];

    let is_sol = ctx.accounts.debt_mint.key() == WSOL_MINT.key();

    // Calculate protocol fee using remaining_accounts for treasury + NFT
    let fee_bps = ctx.accounts.vault_authority.origination_fee_bps;
    let remaining = ctx.remaining_accounts;
    let fee_amount = if fee_bps > 0 && !remaining.is_empty() {
        // Treasury accounts come first in remaining_accounts
        let nft_offset = if is_sol { 1 } else { 2 }; // skip treasury (+ treasury_ta for SPL)
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

    // Transfer debt to borrower (debt_amount - fee)
    if is_sol {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_authority.to_account_info(),
                to: ctx.accounts.borrower.to_account_info(),
            },
        )
        .with_signer(signer_seeds);

        transfer(cpi_context, borrower_amount)?;

        // Transfer fee to treasury (SOL) — remaining_accounts[0]
        if fee_amount > 0 {
            let treasury = &remaining[0];
            require!(treasury.key() == ctx.accounts.vault_authority.treasury, AgioError::TreasuryMismatch);

            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_authority.to_account_info(),
                    to: treasury.to_account_info(),
                },
            )
            .with_signer(signer_seeds);

            transfer(cpi_context, fee_amount)?;
        }
    } else {
        let vault_debt_token_account = ctx.accounts.vault_debt_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;
        let borrower_debt_token_account = ctx.accounts.borrower_debt_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.debt_mint.to_account_info(),
            from: vault_debt_token_account.to_account_info(),
            to: borrower_debt_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
            .with_signer(signer_seeds);

        transfer_checked(cpi_context, borrower_amount, ctx.accounts.debt_mint.decimals)?;

        // Transfer fee to treasury (SPL) — remaining[0]=treasury, remaining[1]=treasury_ta
        if fee_amount > 0 {
            let treasury = &remaining[0];
            require!(treasury.key() == ctx.accounts.vault_authority.treasury, AgioError::TreasuryMismatch);

            let treasury_debt_ta = &remaining[1];

            let cpi_accounts = TransferChecked {
                mint: ctx.accounts.debt_mint.to_account_info(),
                from: vault_debt_token_account.to_account_info(),
                to: treasury_debt_ta.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            };
            let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
                .with_signer(signer_seeds);

            transfer_checked(cpi_context, fee_amount, ctx.accounts.debt_mint.decimals)?;
        }
    }

    // Transfer collateral from borrower to vault
    if ctx.accounts.collateral_mint.key() == WSOL_MINT.key() {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower.to_account_info(),
                to: ctx.accounts.vault_authority.to_account_info(),
            },
        );
        transfer(cpi_context, loan.collateral_amount)?;
    } else {
        let borrower_collateral_token_account = ctx.accounts.borrower_collateral_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;
        let vault_collateral_token_account = ctx.accounts.vault_collateral_token_account.as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.collateral_mint.to_account_info(),
            from: borrower_collateral_token_account.to_account_info(),
            to: vault_collateral_token_account.to_account_info(),
            authority: ctx.accounts.borrower.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        transfer_checked(cpi_context, loan.collateral_amount, ctx.accounts.collateral_mint.decimals)?;
    }

    if fee_amount > 0 {
        msg!("Protocol fee charged: {} lamports/tokens", fee_amount);
    }

    Ok(())
}
