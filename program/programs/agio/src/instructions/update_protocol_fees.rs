use anchor_lang::prelude::*;

use crate::{
    constants::{ADMIN_AUTHORITY, MAX_DISCOUNT_BPS, MAX_FEE_BPS},
    errors::AgioError,
    state::VaultAuthority,
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateProtocolFeesArgs {
    pub origination_fee_bps: u16,
    pub nft_discount_bps: u16,
    pub nft_collection: Option<Pubkey>,
    pub treasury: Pubkey,
}

#[derive(Accounts)]
pub struct UpdateProtocolFees<'info> {
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

pub fn update_protocol_fees<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateProtocolFees<'info>>,
    args: UpdateProtocolFeesArgs,
) -> Result<()> {
    require!(args.origination_fee_bps <= MAX_FEE_BPS, AgioError::FeeBpsTooHigh);
    require!(args.nft_discount_bps <= MAX_DISCOUNT_BPS, AgioError::DiscountBpsTooHigh);
    require!(args.treasury != Pubkey::default(), AgioError::InvalidTreasury);

    let vault = &mut ctx.accounts.vault_authority;
    vault.origination_fee_bps = args.origination_fee_bps;
    vault.nft_discount_bps = args.nft_discount_bps;
    vault.nft_collection = args.nft_collection;
    vault.treasury = args.treasury;

    msg!(
        "Protocol fees updated: origination={}bps, nft_discount={}bps, treasury={}",
        args.origination_fee_bps,
        args.nft_discount_bps,
        args.treasury,
    );

    Ok(())
}
