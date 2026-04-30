use anchor_lang::prelude::*;

use crate::{
    constants::ADMIN_AUTHORITY,
    errors::AgioError,
    state::PriceFeedConfig,
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitPriceFeedConfigArgs {
    pub feed_id: [u8; 32],
    pub decimals: u8,
}

#[derive(Accounts)]
pub struct InitPriceFeedConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = PriceFeedConfig::SPACE,
        seeds = [PriceFeedConfig::PREFIX.as_bytes(), mint.key().as_ref()],
        bump,
    )]
    pub price_feed_config: Account<'info, PriceFeedConfig>,
    /// The token mint this price feed maps to
    /// CHECK: Any mint pubkey is valid; we just store the mapping
    pub mint: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = admin.key() == ADMIN_AUTHORITY @ AgioError::Unauthorized,
    )]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn init_price_feed_config<'info>(
    ctx: Context<'_, '_, '_, 'info, InitPriceFeedConfig<'info>>,
    args: InitPriceFeedConfigArgs,
) -> Result<()> {
    let config = &mut ctx.accounts.price_feed_config;
    config.mint = ctx.accounts.mint.key();
    config.feed_id = args.feed_id;
    config.decimals = args.decimals;
    config.bump = ctx.bumps.price_feed_config;

    msg!(
        "PriceFeedConfig initialized for mint: {}",
        ctx.accounts.mint.key()
    );

    Ok(())
}
