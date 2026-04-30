use anchor_lang::prelude::*;

use crate::{
    constants::{
        ADMIN_AUTHORITY, DEFAULT_LIQUIDATION_THRESHOLD_BPS, DEFAULT_MAX_APY, DEFAULT_MAX_COLLATERAL_RATIO_BPS,
        DEFAULT_MIN_APY, DEFAULT_MIN_COLLATERAL_RATIO_BPS,
    },
    errors::AgioError,
    state::VaultAuthority,
};

#[derive(Accounts)]
pub struct MigrateVaultAuthority<'info> {
    #[account(
        mut,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump = vault_authority.bump,
        realloc = VaultAuthority::SPACE,
        realloc::payer = admin,
        realloc::zero = false,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    #[account(
        mut,
        constraint = admin.key() == ADMIN_AUTHORITY @ AgioError::Unauthorized,
    )]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn migrate_vault_authority<'info>(
    ctx: Context<'_, '_, '_, 'info, MigrateVaultAuthority<'info>>,
) -> Result<()> {
    let vault_authority = &mut ctx.accounts.vault_authority;

    // Only migrate fee fields if not yet migrated
    if vault_authority.treasury == Pubkey::default() {
        vault_authority.origination_fee_bps = 0;
        vault_authority.nft_discount_bps = 0;
        vault_authority.nft_collection = None;
        vault_authority.treasury = ctx.accounts.admin.key();
        msg!("VaultAuthority migrated: fee fields initialized, treasury set to admin");
    }

    // Migrate liquidation fields if not yet set
    if vault_authority.liquidation_threshold_bps == 0 {
        vault_authority.liquidation_threshold_bps = DEFAULT_LIQUIDATION_THRESHOLD_BPS;
        msg!("VaultAuthority migrated: liquidation threshold set to {}bps", DEFAULT_LIQUIDATION_THRESHOLD_BPS);
    } else {
        msg!("VaultAuthority liquidation fields already migrated");
    }

    // Migrate protocol config fields if not yet set (max_apy == 0 means unconfigured)
    if vault_authority.max_apy == 0 {
        vault_authority.min_apy = DEFAULT_MIN_APY;
        vault_authority.max_apy = DEFAULT_MAX_APY;
        vault_authority.min_collateral_ratio_bps = DEFAULT_MIN_COLLATERAL_RATIO_BPS;
        vault_authority.max_collateral_ratio_bps = DEFAULT_MAX_COLLATERAL_RATIO_BPS;
        msg!(
            "VaultAuthority migrated: protocol config set — apy={}-{}%, collateral_ratio={}-{}bps",
            DEFAULT_MIN_APY,
            DEFAULT_MAX_APY,
            DEFAULT_MIN_COLLATERAL_RATIO_BPS,
            DEFAULT_MAX_COLLATERAL_RATIO_BPS,
        );
    } else {
        msg!("VaultAuthority protocol config fields already migrated");
    }

    Ok(())
}
