use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddCollateralArgs {
    pub add_amount: u64,
}

#[derive(Accounts)]
pub struct AddCollateral<'info> {
    #[account(
        mut,
        seeds = [Loan::PREFIX.as_bytes(), loan.create_key.as_ref()],
        bump = loan.bump,
        constraint = loan.status == LoanStatus::Accepted as u8 @ AgioError::InvalidLoanStatus,
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
        associated_token::mint = collateral_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_collateral_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = loan.borrower.is_some() @ AgioError::MissingBorrower,
        constraint = loan.borrower.map_or(false, |b| b == borrower.key()) @ AgioError::BorrowerMismatch,
    )]
    pub borrower: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn add_collateral<'info>(
    ctx: Context<'_, '_, '_, 'info, AddCollateral<'info>>,
    args: AddCollateralArgs,
) -> Result<()> {
    let loan = &mut ctx.accounts.loan;

    require!(loan.status == LoanStatus::Accepted as u8, AgioError::InvalidLoanStatus);

    let amount = args.add_amount;

    loan.collateral_amount = loan
        .collateral_amount
        .checked_add(amount)
        .ok_or(AgioError::NumericalOverflowError)?;

    let borrower_collateral_token_account = ctx
        .accounts
        .borrower_collateral_token_account
        .as_ref()
        .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

    let vault_collateral_token_account =
        ctx.accounts
            .vault_collateral_token_account
            .as_ref()
            .ok_or_else(|| error!(AgioError::MissingTokenAccount))?;

    let cpi_accounts = TransferChecked {
        mint: ctx.accounts.collateral_mint.to_account_info(),
        from: borrower_collateral_token_account.to_account_info(),
        to: vault_collateral_token_account.to_account_info(),
        authority: ctx.accounts.borrower.to_account_info(),
    };

    let cpi_context =
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

    transfer_checked(cpi_context, amount, ctx.accounts.collateral_mint.decimals)?;

    Ok(())
}
