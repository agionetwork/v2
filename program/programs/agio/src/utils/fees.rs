use anchor_lang::prelude::*;

use crate::constants::BPS_DIVISOR;
use crate::errors::AgioError;

/// Calculate fee amount from a base amount and fee rate in basis points.
/// Uses u128 intermediary to prevent overflow.
pub fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    if fee_bps == 0 || amount == 0 {
        return Ok(0);
    }
    let fee = u128::from(amount)
        .checked_mul(u128::from(fee_bps))
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_div(u128::from(BPS_DIVISOR))
        .ok_or(AgioError::NumericalOverflowError)?;
    u64::try_from(fee).map_err(|_| AgioError::NumericalOverflowError.into())
}

/// Calculate fee with NFT holder discount applied.
/// discount_bps: e.g., 5000 = 50% discount on the fee.
pub fn calculate_discounted_fee(amount: u64, fee_bps: u16, discount_bps: u16) -> Result<u64> {
    let base_fee = calculate_fee(amount, fee_bps)?;
    if discount_bps == 0 || base_fee == 0 {
        return Ok(base_fee);
    }
    let discount = u128::from(base_fee)
        .checked_mul(u128::from(discount_bps))
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_div(u128::from(BPS_DIVISOR))
        .ok_or(AgioError::NumericalOverflowError)?;
    let discount_u64 = u64::try_from(discount)
        .map_err(|_| AgioError::NumericalOverflowError)?;
    Ok(base_fee.saturating_sub(discount_u64))
}
