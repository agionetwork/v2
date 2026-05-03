use anchor_lang::prelude::*;

#[derive(InitSpace)]
#[account]
pub struct PriceFeedConfig {
    pub mint: Pubkey,
    pub feed_id: [u8; 32],
    pub decimals: u8,
    pub bump: u8,
}

impl PriceFeedConfig {
    pub const PREFIX: &'static str = "price_feed";
    /// discriminator(8) + mint(32) + feed_id(32) + decimals(1) + bump(1) = 74
    pub const SPACE: usize = 74;
}
