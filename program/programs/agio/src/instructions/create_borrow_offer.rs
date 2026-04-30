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
use crate::utils::validation::{validate_apy, validate_collateral_ratio};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateBorrowOfferArgs {
    pub debt_amount: u64,
    pub collateral_amount: u64,
    pub duration: u64,
    pub apy: u8,
    pub is_private: bool,
    pub borrower: Option<Pubkey>,
}

#[derive(Accounts)]
#[instruction(args: CreateBorrowOfferArgs)]
pub struct CreateBorrowOffer<'info> {
    #[account(
        init,
        payer = lender,
        space = Loan::SPACE,
        seeds = [Loan::PREFIX.as_bytes(), create_key.key().as_ref()],
        bump,
    )]
    pub loan: Box<Account<'info, Loan>>,
    pub debt_mint: InterfaceAccount<'info, Mint>,
    #[account(
        constraint = debt_mint.key() != collateral_mint.key(),
    )]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
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
        associated_token::mint = debt_mint,
        associated_token::authority = lender,
        associated_token::token_program = token_program,
    )]
    pub lender_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    /// Pyth price feed config for the collateral mint
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), collateral_mint.key().as_ref()],
        bump = collateral_price_feed_config.bump,
        constraint = collateral_price_feed_config.mint == collateral_mint.key() @ AgioError::PriceFeedConfigMismatch,
    )]
    pub collateral_price_feed_config: Box<Account<'info, PriceFeedConfig>>,
    /// Pyth price feed config for the debt mint
    #[account(
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), debt_mint.key().as_ref()],
        bump = debt_price_feed_config.bump,
        constraint = debt_price_feed_config.mint == debt_mint.key() @ AgioError::PriceFeedConfigMismatch,
    )]
    pub debt_price_feed_config: Box<Account<'info, PriceFeedConfig>>,
    /// Pyth price update for collateral token
    pub collateral_price_update: Box<Account<'info, PriceUpdateV2>>,
    /// Pyth price update for debt token
    pub debt_price_update: Box<Account<'info, PriceUpdateV2>>,
    pub create_key: Signer<'info>,
    #[account(mut)]
    pub lender: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_borrow_offer<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateBorrowOffer<'info>>,
    args: CreateBorrowOfferArgs,
) -> Result<()> {
    require!(
        ctx.accounts.vault_authority.verify_mint(&ctx.accounts.debt_mint.key())
            && ctx.accounts.vault_authority.verify_mint(&ctx.accounts.collateral_mint.key()),
        AgioError::MintNotAllowed
    );

    require!(args.duration >= MIN_LOAN_DURATION, AgioError::DurationTooShort);

    // Validate APY against protocol limits
    validate_apy(&ctx.accounts.vault_authority, args.apy)?;

    // Validate collateral ratio against protocol limits using Pyth oracle prices
    validate_collateral_ratio(
        args.collateral_amount,
        &ctx.accounts.collateral_price_feed_config,
        &ctx.accounts.collateral_price_update,
        args.debt_amount,
        &ctx.accounts.debt_price_feed_config,
        &ctx.accounts.debt_price_update,
        &ctx.accounts.vault_authority,
    )?;

    let loan = &mut ctx.accounts.loan;

    loan.version = 1;
    loan.create_key = ctx.accounts.create_key.key();
    loan.bump = ctx.bumps.loan;
    loan.lender = Some(ctx.accounts.lender.key());
    loan.debt_mint = ctx.accounts.debt_mint.key();
    loan.collateral_mint = ctx.accounts.collateral_mint.key();
    loan.debt_amount = args.debt_amount;
    loan.collateral_amount = args.collateral_amount;
    loan.start = None;
    loan.duration = args.duration;
    loan.apy = args.apy;
    loan.private_status = PrivateStatus::Public as u8;
    loan.status = LoanStatus::Pending as u8;

    if args.is_private && args.borrower.is_none() {
        return Err(error!(AgioError::MissingPrivateBorrower));
    }

    if args.is_private {
        loan.borrower = args.borrower;
        loan.private_status = PrivateStatus::PrivateBorrower as u8;
    }

    if ctx.accounts.debt_mint.key() == WSOL_MINT.key() {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.lender.to_account_info(),
                to: ctx.accounts.vault_authority.to_account_info(),
            },
        );

        transfer(cpi_context, args.debt_amount)?;
    } else {
        let lender_debt_token_account = ctx
            .accounts
            .lender_debt_token_account
            .as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

        let vault_debt_token_account = ctx
            .accounts
            .vault_debt_token_account
            .as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.debt_mint.to_account_info(),
            from: lender_debt_token_account.to_account_info(),
            to: vault_debt_token_account.to_account_info(),
            authority: ctx.accounts.lender.to_account_info(),
        };

        let cpi_context =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        transfer_checked(
            cpi_context,
            args.debt_amount,
            ctx.accounts.debt_mint.decimals,
        )?;
    }

    Ok(())
}
