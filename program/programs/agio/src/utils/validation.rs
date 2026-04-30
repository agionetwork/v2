use crate::constants::{BPS_DIVISOR, MAX_PYTH_PRICE_AGE_SECS};
use crate::errors::AgioError;
use crate::state::{PriceFeedConfig, VaultAuthority};
use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

/// Validate APY against protocol limits stored in VaultAuthority.
/// Skips validation if limits are not configured (max_apy == 0).
pub fn validate_apy(vault_authority: &VaultAuthority, apy: u8) -> Result<()> {
    // If max_apy == 0, protocol limits not yet configured — skip
    if vault_authority.max_apy == 0 {
        return Ok(());
    }

    require!(apy >= vault_authority.min_apy, AgioError::ApyTooLow);
    require!(apy <= vault_authority.max_apy, AgioError::ApyTooHigh);

    Ok(())
}

/// Validate the collateral ratio against protocol limits using live Pyth oracle prices.
/// Skips validation if limits are not configured (min_collateral_ratio_bps == 0 and max == 0).
///
/// The ratio is: collateral_value / debt_value (in BPS terms).
/// For example, 150% collateral ratio = 15000 BPS.
pub fn validate_collateral_ratio(
    collateral_amount: u64,
    collateral_price_feed_config: &PriceFeedConfig,
    collateral_price_update: &Account<PriceUpdateV2>,
    debt_amount: u64,
    debt_price_feed_config: &PriceFeedConfig,
    debt_price_update: &Account<PriceUpdateV2>,
    vault_authority: &VaultAuthority,
) -> Result<()> {
    let min_bps = vault_authority.min_collateral_ratio_bps;
    let max_bps = vault_authority.max_collateral_ratio_bps;

    // If both are 0, protocol limits not yet configured — skip
    if min_bps == 0 && max_bps == 0 {
        return Ok(());
    }

    // Read Pyth prices (accept Partial verification — our poster trims VAA to 4 sigs)
    let collateral_price_data = collateral_price_update
        .get_price_no_older_than_with_custom_verification_level(
            &Clock::get()?,
            MAX_PYTH_PRICE_AGE_SECS,
            &collateral_price_feed_config.feed_id,
            VerificationLevel::Partial { num_signatures: 4 },
        )
        .map_err(|_| error!(AgioError::PriceFeedStale))?;

    let debt_price_data = debt_price_update
        .get_price_no_older_than_with_custom_verification_level(
            &Clock::get()?,
            MAX_PYTH_PRICE_AGE_SECS,
            &debt_price_feed_config.feed_id,
            VerificationLevel::Partial { num_signatures: 4 },
        )
        .map_err(|_| error!(AgioError::PriceFeedStale))?;

    require!(collateral_price_data.price > 0, AgioError::PriceFeedNegative);
    require!(debt_price_data.price > 0, AgioError::PriceFeedNegative);

    // Normalize price values using the same approach as liquidation.rs
    // USD_value = amount * price * 10^(expo - decimals)
    // To compare without fractions, shift both sides by the more negative combined exponent.
    let col_combined = collateral_price_data.exponent as i64
        - collateral_price_feed_config.decimals as i64;
    let debt_combined =
        debt_price_data.exponent as i64 - debt_price_feed_config.decimals as i64;

    let shift = col_combined.min(debt_combined);
    let col_shift = (col_combined - shift) as u32;
    let debt_shift = (debt_combined - shift) as u32;

    let col_value = (collateral_amount as u128)
        .checked_mul(collateral_price_data.price as u128)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(10u128.pow(col_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    let debt_value = (debt_amount as u128)
        .checked_mul(debt_price_data.price as u128)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(10u128.pow(debt_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    // ratio check: col_value * BPS_DIVISOR >= debt_value * min_ratio_bps
    if min_bps > 0 {
        let lhs = col_value
            .checked_mul(BPS_DIVISOR as u128)
            .ok_or(AgioError::NumericalOverflowError)?;
        let rhs = debt_value
            .checked_mul(min_bps as u128)
            .ok_or(AgioError::NumericalOverflowError)?;
        require!(lhs >= rhs, AgioError::CollateralRatioTooLow);
    }

    // ratio check: col_value * BPS_DIVISOR <= debt_value * max_ratio_bps
    if max_bps > 0 {
        let lhs = col_value
            .checked_mul(BPS_DIVISOR as u128)
            .ok_or(AgioError::NumericalOverflowError)?;
        let rhs = debt_value
            .checked_mul(max_bps as u128)
            .ok_or(AgioError::NumericalOverflowError)?;
        require!(lhs <= rhs, AgioError::CollateralRatioTooHigh);
    }

    Ok(())
}
