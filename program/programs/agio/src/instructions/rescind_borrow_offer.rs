use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
pub struct RescindBorrowOffer<'info> {
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
        init_if_needed,
        payer = lender,
        associated_token::mint = debt_mint,
        associated_token::authority = lender,
        associated_token::token_program = token_program,
    )]
    pub lender_debt_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = loan.lender.is_some() @ AgioError::MissingLender,
        constraint = loan.lender.map_or(false, |l| l == lender.key()) @ AgioError::LenderMismatch,
    )]
    pub lender: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn rescind_borrow_offer<'info>(
    ctx: Context<'_, '_, '_, 'info, RescindBorrowOffer<'info>>,
) -> Result<()> {
    let loan = &mut ctx.accounts.loan;

    require!(loan.status == LoanStatus::Pending as u8, AgioError::InvalidLoanStatus);

    loan.status = LoanStatus::Rescinded as u8;

    let signer_seeds: &[&[&[u8]]] = &[&[
        VaultAuthority::PREFIX.as_bytes(),
        &[ctx.accounts.vault_authority.bump],
    ]];

    let vault_debt_token_account = ctx
        .accounts
        .vault_debt_token_account
        .as_ref()
        .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

    let lender_debt_token_account = ctx
        .accounts
        .lender_debt_token_account
        .as_ref()
        .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

    let cpi_accounts = TransferChecked {
        mint: ctx.accounts.debt_mint.to_account_info(),
        from: vault_debt_token_account.to_account_info(),
        to: lender_debt_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let cpi_context =
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
            .with_signer(signer_seeds);

    transfer_checked(
        cpi_context,
        loan.debt_amount,
        ctx.accounts.debt_mint.decimals,
    )?;

    Ok(())
}
