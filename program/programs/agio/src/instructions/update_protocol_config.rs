use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN_AUTHORITY,
    errors::AgioError,
    state::VaultAuthority,
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateProtocolConfigArgs {
    pub min_apy: u8,
    pub max_apy: u8,
    pub min_collateral_ratio_bps: u16,
    pub max_collateral_ratio_bps: u16,
}

#[derive(Accounts)]
pub struct UpdateProtocolConfig<'info> {
    #[account(
        mut,
        seeds = [VaultAuthority::PREFIX.as_bytes()],
        bump = vault_authority.bump,
    )]
    pub vault_authority: Box<Account<'info, VaultAuthority>>,
    #[account(
        mut,
        constraint = admin.key() == ADMIN_AUTHORITY @ AgioError::Unauthorized,
    )]
    pub admin: Signer<'info>,
}

pub fn update_protocol_config<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateProtocolConfig<'info>>,
    args: UpdateProtocolConfigArgs,
) -> Result<()> {
    // Validate: max_apy must be >= min_apy (unless max_apy is 0 = disabled)
    if args.max_apy > 0 {
        require!(args.max_apy >= args.min_apy, AgioError::ApyTooHigh);
    }

    // Validate: max_collateral_ratio_bps must be >= min (unless max is 0 = disabled)
    if args.max_collateral_ratio_bps > 0 && args.min_collateral_ratio_bps > 0 {
        require!(
            args.max_collateral_ratio_bps >= args.min_collateral_ratio_bps,
            AgioError::CollateralRatioTooHigh
        );
    }

    let vault = &mut ctx.accounts.vault_authority;
    vault.min_apy = args.min_apy;
    vault.max_apy = args.max_apy;
    vault.min_collateral_ratio_bps = args.min_collateral_ratio_bps;
    vault.max_collateral_ratio_bps = args.max_collateral_ratio_bps;

    msg!(
        "Protocol config updated: apy={}-{}%, collateral_ratio={}-{}bps",
        args.min_apy,
        args.max_apy,
        args.min_collateral_ratio_bps,
        args.max_collateral_ratio_bps,
    );

    Ok(())
}
