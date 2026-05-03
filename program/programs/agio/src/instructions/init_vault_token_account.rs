use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{constants::ADMIN_AUTHORITY, errors::AgioError, state::VaultAuthority};

#[derive(Accounts)]
pub struct InitVaultTokenAccount<'info> {
    #[account(
        mut,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump,
        constraint = vault_authority.version > 0 @ AgioError::InvalidVaultAuthority,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    pub vault_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = admin,
        associated_token::mint = vault_mint,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = admin.key() == ADMIN_AUTHORITY @ AgioError::Unauthorized,
    )]
    pub admin: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn init_vault_token_account<'info>(
    ctx: Context<'_, '_, '_, 'info, InitVaultTokenAccount<'info>>,
) -> Result<()> {
    let vault_authority = &mut ctx.accounts.vault_authority;

    vault_authority
        .allowed_mints
        .push(ctx.accounts.vault_mint.key());

    Ok(())
}
