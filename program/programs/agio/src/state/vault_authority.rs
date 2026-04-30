use anchor_lang::prelude::*;

#[account]
pub struct VaultAuthority {
    pub version: u8,
    pub bump: u8,
    pub allowed_mints: Vec<Pubkey>,
    pub disabled_mints: Vec<Pubkey>,
    /// Origination fee in basis points (100 = 1%). Charged to borrower when offer is accepted.
    pub origination_fee_bps: u16,
    /// Discount in basis points for NFT collection holders (5000 = 50% off fees).
    pub nft_discount_bps: u16,
    /// Verified NFT collection address. None = no discount available.
    pub nft_collection: Option<Pubkey>,
    /// Protocol treasury wallet that receives collected fees.
    pub treasury: Pubkey,
    /// Liquidation threshold in basis points (12000 = 120%). Collateral is liquidatable
    /// when its value drops to this percentage of the outstanding debt.
    pub liquidation_threshold_bps: u16,
    /// Minimum APY allowed for new loans (0 = no minimum enforced).
    pub min_apy: u8,
    /// Maximum APY allowed for new loans (0 = not configured / no maximum enforced).
    pub max_apy: u8,
    /// Minimum collateral ratio in basis points (15000 = 150%). 0 = not configured.
    pub min_collateral_ratio_bps: u16,
    /// Maximum collateral ratio in basis points (30000 = 300%). 0 = not configured.
    pub max_collateral_ratio_bps: u16,
}

impl VaultAuthority {
    pub const PREFIX: &'static str = "vault_authority";
    /// discriminator(8) version(1) bump(1) allowed_mints(4 len, 32x100) disabled_mints(4 len, 32x100)
    /// + origination_fee_bps(2) + nft_discount_bps(2) + nft_collection(1+32) + treasury(32)
    /// + liquidation_threshold_bps(2) + min_apy(1) + max_apy(1) + min_collateral_ratio_bps(2) + max_collateral_ratio_bps(2)
    pub const SPACE: usize = 6_496;

    pub fn verify_mint(&self, mint: &Pubkey) -> bool {
        self.allowed_mints.contains(mint) && !self.disabled_mints.contains(mint)
    }
}
