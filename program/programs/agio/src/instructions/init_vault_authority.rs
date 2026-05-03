use anchor_lang::prelude::*;

use crate::{
    constants::{ADMIN_AUTHORITY, WSOL_MINT},
    errors::AgioError,
    state::VaultAuthority,
};

#[derive(Accounts)]
pub struct InitVaultAuthority<'info> {
    #[account(
        init,
        payer = admin,
        space = VaultAuthority::SPACE,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    #[account(
        mut,
        constraint = admin.key() == ADMIN_AUTHORITY @ AgioError::Unauthorized,
    )]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn init_vault_authority<'info>(
    ctx: Context<'_, '_, '_, 'info, InitVaultAuthority<'info>>,
) -> Result<()> {
    let vault_authority = &mut ctx.accounts.vault_authority;

    vault_authority.version = 1;
    vault_authority.bump = ctx.bumps.vault_authority;
    vault_authority.allowed_mints.push(WSOL_MINT);

    Ok(())
}
