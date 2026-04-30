use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
pub struct ForecloseLoan<'info> {
    #[account(
        mut,
        seeds = [Loan::PREFIX.as_bytes(), loan.create_key.as_ref()],
        bump = loan.bump,
        constraint = loan.status == LoanStatus::Accepted as u8 @ AgioError::InvalidLoanStatus,
    )]
    pub loan: Box<Account<'info, Loan>>,
    #[account(
        address = loan.collateral_mint, // verify_mint: whitelist validated at loan creation
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
        associated_token::mint = collateral_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = lender,
        associated_token::mint = collateral_mint,
        associated_token::authority = lender,
        associated_token::token_program = token_program,
    )]
    pub lender_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = loan.lender.is_some() @ AgioError::MissingLender,
        constraint = loan.lender.map_or(false, |l| l == lender.key()) @ AgioError::LenderMismatch,
    )]
    pub lender: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn foreclose_loan<'info>(ctx: Context<'_, '_, '_, 'info, ForecloseLoan<'info>>) -> Result<()> {
    let loan = &mut ctx.accounts.loan;

    require!(loan.status == LoanStatus::Accepted as u8, AgioError::InvalidLoanStatus);
    let start = loan.start.ok_or(AgioError::MissingLoanStart)?;
    require!(
        start
            .checked_add(loan.duration as i64)
            .ok_or(AgioError::NumericalOverflowError)?
            <= ctx.accounts.clock.unix_timestamp,
        AgioError::LoanNotExpired
    );

    loan.status = LoanStatus::Foreclosed as u8;

    let signer_seeds: &[&[&[u8]]] = &[&[
        VaultAuthority::PREFIX.as_bytes(),
        &[ctx.accounts.vault_authority.bump],
    ]];

    let vault_collateral_token_account =
        ctx.accounts
            .vault_collateral_token_account
            .as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

    let lender_collateral_token_account = ctx
        .accounts
        .lender_collateral_token_account
        .as_ref()
        .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

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
        loan.collateral_amount,
        ctx.accounts.collateral_mint.decimals,
    )?;

    Ok(())
}
