use anchor_lang::prelude::*;

pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

pub const ADMIN_AUTHORITY: Pubkey = pubkey!("4kLqTNgohT3JQ7J41s2S9NhtxfBhgn2ixTBX3ErRL2Pc");

/// Percent(100) x Days(365) x Hours(24) x Seconds(3600) equals 3_153_600_000
pub const APY_DIVISOR: u64 = 3_153_600_000;

/// Maximum fee in basis points (10% = 1000 bps)
pub const MAX_FEE_BPS: u16 = 1_000;

/// Maximum discount in basis points (100% = 10000 bps)
pub const MAX_DISCOUNT_BPS: u16 = 10_000;

/// Basis points divisor (10000 = 100%)
pub const BPS_DIVISOR: u64 = 10_000;

/// Metaplex Token Metadata program ID
pub const TOKEN_METADATA_PROGRAM_ID: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

/// Default liquidation threshold in basis points (12000 = 120%)
pub const DEFAULT_LIQUIDATION_THRESHOLD_BPS: u16 = 12_000;

/// Split of excess collateral after liquidation (5000 = 50% to each side)
pub const EXCESS_SPLIT_BPS: u16 = 5_000;

/// Maximum age for Pyth price updates in seconds
pub const MAX_PYTH_PRICE_AGE_SECS: u64 = 60;

/// Minimum loan duration in seconds (1 day = 86400s)
pub const MIN_LOAN_DURATION: u64 = 86_400;

/// Default minimum APY for new loans (0%)
pub const DEFAULT_MIN_APY: u8 = 0;

/// Default maximum APY for new loans (200%)
pub const DEFAULT_MAX_APY: u8 = 200;

/// Default minimum collateral ratio in basis points (15000 = 150%)
pub const DEFAULT_MIN_COLLATERAL_RATIO_BPS: u16 = 15_000;

/// Default maximum collateral ratio in basis points (30000 = 300%)
pub const DEFAULT_MAX_COLLATERAL_RATIO_BPS: u16 = 30_000;
