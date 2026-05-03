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
    let interest = u128::from(debt_amount)
        .checked_mul(u128::from(apy))
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_mul(u128::from(elapsed_secs))
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_div(u128::from(APY_DIVISOR))
        .ok_or(AgioError::NumericalOverflowError)?;

    let total = u128::from(debt_amount)
        .checked_add(interest)
        .ok_or(AgioError::NumericalOverflowError)?;

    u64::try_from(total).map_err(|_| AgioError::NumericalOverflowError.into())
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

    let col_amt = u128::from(collateral_amount);
    let col_price = u128::from(collateral_price);
    let debt_amt = u128::from(outstanding_debt);
    let d_price = u128::from(debt_price);

    // For the comparison, we need to normalize exponents.
    // price_value = amount * price * 10^(-decimals) * 10^(expo) in USD
    // To avoid fractions, we multiply both sides by 10^(max_abs_expo + max_decimals)
    //
    // Simpler approach: compute USD values scaled by a common factor.
    // USD_collateral = collateral_amount * collateral_price * 10^(collateral_expo - collateral_decimals)
    // USD_debt = outstanding_debt * debt_price * 10^(debt_expo - debt_decimals)
    //
    // To compare without fractions, shift by the more negative combined exponent.
    let col_combined = i64::from(collateral_expo)
        .checked_sub(i64::from(collateral_decimals))
        .ok_or(AgioError::NumericalOverflowError)?;
    let debt_combined = i64::from(debt_expo)
        .checked_sub(i64::from(debt_decimals))
        .ok_or(AgioError::NumericalOverflowError)?;

    // Shift both to eliminate the more negative exponent
    let shift = col_combined.min(debt_combined);
    let col_shift = u32::try_from(
        col_combined
            .checked_sub(shift)
            .ok_or(AgioError::NumericalOverflowError)?,
    )
    .map_err(|_| AgioError::NumericalOverflowError)?;
    let debt_shift = u32::try_from(
        debt_combined
            .checked_sub(shift)
            .ok_or(AgioError::NumericalOverflowError)?,
    )
    .map_err(|_| AgioError::NumericalOverflowError)?;

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
        .checked_mul(u128::from(BPS_DIVISOR))
        .ok_or(AgioError::NumericalOverflowError)?;
    let rhs = debt_value
        .checked_mul(u128::from(threshold_bps))
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
    let debt_in_collateral = u64::try_from(debt_in_collateral_128.min(col_amt))
        .map_err(|_| AgioError::NumericalOverflowError)?;

    let excess_collateral = collateral_amount
        .checked_sub(debt_in_collateral)
        .unwrap_or(0);

    // Split excess 50/50
    let lender_excess_u128 = u128::from(excess_collateral)
        .checked_mul(u128::from(EXCESS_SPLIT_BPS))
        .ok_or(AgioError::NumericalOverflowError)?
        .checked_div(u128::from(BPS_DIVISOR))
        .ok_or(AgioError::NumericalOverflowError)?;
    let lender_excess = u64::try_from(lender_excess_u128)
        .map_err(|_| AgioError::NumericalOverflowError)?;

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
