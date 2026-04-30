use crate::constants::{APY_DIVISOR, BPS_DIVISOR, EXCESS_SPLIT_BPS};
use crate::errors::AgioError;
use anchor_lang::prelude::*;

/// Calculate outstanding debt including accrued interest based on elapsed time.
/// Uses elapsed time (not full duration) so liquidation captures partial interest.
pub fn calculate_outstanding_debt(
    debt_amount: u64,
    apy: u8,
    elapsed_secs: u64,
) -> Result<u64> {
    let interest = (debt_amount as u128)
        .checked_mul(apy as u128)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(elapsed_secs as u128)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_div(APY_DIVISOR as u128)
        .ok_or(AgioError::NumericalOverflowError)?;

    let total = (debt_amount as u128)
        .checked_add(interest)
        .ok_or(AgioError::NumericalOverflowError)?;

    Ok(total as u64)
}

/// Result of liquidation calculation
pub struct LiquidationResult {
    /// Whether the loan is eligible for liquidation
    pub is_liquidatable: bool,
    /// Amount of collateral tokens equivalent to the outstanding debt
    pub debt_in_collateral: u64,
    /// Excess collateral after covering the debt
    pub excess_collateral: u64,
    /// Half of excess going to lender
    pub lender_excess: u64,
    /// Half of excess going to treasury
    pub treasury_excess: u64,
}

/// Check if a loan is liquidatable and calculate collateral distribution.
///
/// Prices from Pyth have an exponent (e.g., price=15000000, expo=-5 means $150.00000).
/// All math is done in u128 to avoid overflow.
///
/// Liquidatable when: collateral_value <= debt_value * threshold / 10000
/// Where value = amount * price * 10^expo (adjusted for token decimals)
///
/// `force_liquidation = true` bypasses the threshold check — used for expired-loan
/// foreclosure where the trigger is time, not collateral ratio. Healthy expired
/// loans must still distribute collateral; without this flag they hit the
/// `is_liquidatable = false` branch and the lender receives nothing (BUG-030).
pub fn calculate_liquidation(
    collateral_amount: u64,
    collateral_price: u64,
    collateral_expo: i32,
    collateral_decimals: u8,
    outstanding_debt: u64,
    debt_price: u64,
    debt_expo: i32,
    debt_decimals: u8,
    threshold_bps: u16,
    force_liquidation: bool,
) -> Result<LiquidationResult> {
    // We compare: collateral_value vs debt_value * threshold / BPS_DIVISOR
    // To avoid floating point, cross-multiply:
    //   collateral_amount * collateral_price * 10^collateral_expo * BPS_DIVISOR
    //     vs
    //   outstanding_debt * debt_price * 10^debt_expo * threshold_bps
    //
    // But exponents can be negative, so we normalize by shifting both sides.
    // collateral_value_raw = collateral_amount * collateral_price (in collateral smallest units * price units)
    // debt_value_raw = outstanding_debt * debt_price (in debt smallest units * price units)
    //
    // To compare in same units, we need to account for:
    //   - Token decimals (collateral_decimals vs debt_decimals)
    //   - Price exponents (collateral_expo vs debt_expo)
    //
    // Normalize: shift everything so we can compare directly
    // collateral_value = collateral_amount * collateral_price * 10^(debt_decimals) * 10^(-collateral_expo)
    // debt_value = outstanding_debt * debt_price * 10^(collateral_decimals) * 10^(-debt_expo)
    //
    // Then: liquidatable if collateral_value * BPS_DIVISOR <= debt_value * threshold_bps

    let col_amt = collateral_amount as u128;
    let col_price = collateral_price as u128;
    let debt_amt = outstanding_debt as u128;
    let d_price = debt_price as u128;

    // For the comparison, we need to normalize exponents.
    // price_value = amount * price * 10^(-decimals) * 10^(expo) in USD
    // To avoid fractions, we multiply both sides by 10^(max_abs_expo + max_decimals)
    //
    // Simpler approach: compute USD values scaled by a common factor.
    // USD_collateral = collateral_amount * collateral_price * 10^(collateral_expo - collateral_decimals)
    // USD_debt = outstanding_debt * debt_price * 10^(debt_expo - debt_decimals)
    //
    // To compare without fractions, shift by the more negative combined exponent.
    let col_combined = collateral_expo as i64 - collateral_decimals as i64;
    let debt_combined = debt_expo as i64 - debt_decimals as i64;

    // Shift both to eliminate the more negative exponent
    let shift = col_combined.min(debt_combined);
    let col_shift = (col_combined - shift) as u32;
    let debt_shift = (debt_combined - shift) as u32;

    let col_value = col_amt
        .checked_mul(col_price)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(10u128.pow(col_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    let debt_value = debt_amt
        .checked_mul(d_price)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(10u128.pow(debt_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    // Liquidatable if: col_value * BPS_DIVISOR <= debt_value * threshold_bps
    let lhs = col_value
        .checked_mul(BPS_DIVISOR as u128)
        .ok_or(AgioError::NumericalOverflowError)?;
    let rhs = debt_value
        .checked_mul(threshold_bps as u128)
        .ok_or(AgioError::NumericalOverflowError)?;

    let is_liquidatable = force_liquidation || lhs <= rhs;

    if !is_liquidatable {
        return Ok(LiquidationResult {
            is_liquidatable: false,
            debt_in_collateral: 0,
            excess_collateral: 0,
            lender_excess: 0,
            treasury_excess: 0,
        });
    }

    // Calculate how much collateral covers the debt:
    // debt_in_collateral = outstanding_debt * debt_price * 10^(debt_expo) / (collateral_price * 10^(collateral_expo))
    //                    * 10^(collateral_decimals) / 10^(debt_decimals)
    //
    // Simplified using our normalized values:
    // debt_in_collateral = debt_value / col_price_per_unit
    // where col_price_per_unit = col_price * 10^(col_shift) [value per smallest collateral unit]
    //
    // Actually: debt_in_collateral (in collateral smallest units) =
    //   outstanding_debt * debt_price * 10^(debt_shift) / (collateral_price * 10^(col_shift))
    // This gives us collateral tokens needed.

    let numerator = debt_amt
        .checked_mul(d_price)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(10u128.pow(debt_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    let denominator = col_price
        .checked_mul(10u128.pow(col_shift))
        .ok_or(AgioError::NumericalOverflowError)?;

    // Round up to ensure lender gets fully repaid
    let debt_in_collateral_128 = numerator
        .checked_add(denominator.checked_sub(1).ok_or(AgioError::NumericalOverflowError)?)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_div(denominator)
        .ok_or(AgioError::NumericalOverflowError)?;

    // Cap at collateral_amount (if debt exceeds collateral value)
    let debt_in_collateral = debt_in_collateral_128.min(col_amt) as u64;

    let excess_collateral = collateral_amount
        .checked_sub(debt_in_collateral)
        .unwrap_or(0);

    // Split excess 50/50
    let lender_excess = (excess_collateral as u128)
        .checked_mul(EXCESS_SPLIT_BPS as u128)
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_div(BPS_DIVISOR as u128)
        .ok_or(AgioError::NumericalOverflowError)? as u64;

    let treasury_excess = excess_collateral
        .checked_sub(lender_excess)
        .unwrap_or(0);

    Ok(LiquidationResult {
        is_liquidatable: true,
        debt_in_collateral,
        excess_collateral,
        lender_excess,
        treasury_excess,
    })
}
