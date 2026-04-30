use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::{constants::ADMIN_AUTHORITY, errors::AgioError, state::VaultAuthority};

#[derive(Accounts)]
pub struct UpdateVaultDisabledMints<'info> {
    #[account(
        mut,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump,
        constraint = vault_authority.version > 0 @ AgioError::InvalidVaultAuthority,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    pub vault_mint_to_be_allowed: Option<InterfaceAccount<'info, Mint>>,
    pub vault_mint_to_be_disabled: Option<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        constraint = admin.key() == ADMIN_AUTHORITY @ AgioError::Unauthorized,
    )]
    pub admin: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn update_vault_disabled_mints<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateVaultDisabledMints<'info>>,
) -> Result<()> {
    require!(
        ctx.accounts.vault_mint_to_be_allowed.is_some()
            || ctx.accounts.vault_mint_to_be_disabled.is_some(),
        AgioError::MissingMintToBeAllowedOrDisabled
    );

    let vault_authority = &mut ctx.accounts.vault_authority;

    if let Some(vault_mint_to_be_allowed) = &ctx.accounts.vault_mint_to_be_allowed {
        require!(
            vault_authority
                .disabled_mints
                .contains(&vault_mint_to_be_allowed.key()),
            AgioError::MintNotDisabled
        );

        vault_authority
            .disabled_mints
            .retain(|mint| mint != &vault_mint_to_be_allowed.key());
    }

    if let Some(vault_mint_to_be_disabled) = &ctx.accounts.vault_mint_to_be_disabled {
        require!(
            vault_authority
                .allowed_mints
                .contains(&vault_mint_to_be_disabled.key()),
            AgioError::MintNotAllowed
        );

        require!(
            !vault_authority
                .disabled_mints
                .contains(&vault_mint_to_be_disabled.key()),
            AgioError::MintAlreadyDisabled
        );

        vault_authority
            .disabled_mints
            .push(vault_mint_to_be_disabled.key());
    }

    Ok(())
}
