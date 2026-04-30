use anchor_lang::prelude::*;

use crate::constants::BPS_DIVISOR;

/// Calculate fee amount from a base amount and fee rate in basis points.
/// Uses u128 intermediary to prevent overflow.
pub fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    if fee_bps == 0 || amount == 0 {
        return Ok(0);
    }
    let fee = (amount as u128)
        .checked_mul(fee_bps as u128)
        .unwrap()
        .checked_div(BPS_DIVISOR as u128)
        .unwrap();
    Ok(fee as u64)
}

/// Calculate fee with NFT holder discount applied.
/// discount_bps: e.g., 5000 = 50% discount on the fee.
pub fn calculate_discounted_fee(amount: u64, fee_bps: u16, discount_bps: u16) -> Result<u64> {
    let base_fee = calculate_fee(amount, fee_bps)?;
    if discount_bps == 0 || base_fee == 0 {
        return Ok(base_fee);
    }
    let discount = (base_fee as u128)
        .checked_mul(discount_bps as u128)
        .unwrap()
        .checked_div(BPS_DIVISOR as u128)
        .unwrap();
    Ok(base_fee.saturating_sub(discount as u64))
}
