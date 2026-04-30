use anchor_lang::prelude::*;

#[error_code]
pub enum AgioError {
    #[msg("Required token account is missing")]
    MissingTokenAccount,
    #[msg("Private borrow offers must specify a borrower")]
    MissingPrivateBorrower,
    #[msg("Private lend offers must specify a lender")]
    MissingPrivateLender,
    #[msg("Invalid loan status")]
    InvalidLoanStatus,
    #[msg("Invalid private loan status")]
    InvalidPrivateLoanStatus,
    #[msg("Private borrower mismatches")]
    PrivateBorrowerMismatches,
    #[msg("Private lender mismatches")]
    PrivateLenderMismatches,
    #[msg("Loan has not expired")]
    LoanNotExpired,
    #[msg("Numerical overflow error")]
    NumericalOverflowError,
    #[msg("Missing mint to be allowed or disabled")]
    MissingMintToBeAllowedOrDisabled,
    #[msg("Mint is not disabled")]
    MintNotDisabled,
    #[msg("Mint is not allowed")]
    MintNotAllowed,
    #[msg("Mint is already disabled")]
    MintAlreadyDisabled,
    #[msg("Loan is missing a lender")]
    MissingLender,
    #[msg("Loan is missing a borrower")]
    MissingBorrower,
    #[msg("Lender address does not match loan")]
    LenderMismatch,
    #[msg("Borrower address does not match loan")]
    BorrowerMismatch,
    #[msg("Loan is missing a start timestamp")]
    MissingLoanStart,
    #[msg("Unauthorized admin access")]
    Unauthorized,
    #[msg("Invalid vault authority state")]
    InvalidVaultAuthority,
    #[msg("Fee basis points exceeds maximum")]
    FeeBpsTooHigh,
    #[msg("Discount basis points exceeds maximum")]
    DiscountBpsTooHigh,
    #[msg("Invalid treasury address")]
    InvalidTreasury,
    #[msg("Treasury account does not match vault authority")]
    TreasuryMismatch,
    #[msg("Missing treasury account for fee transfer")]
    MissingTreasuryAccount,
    #[msg("Invalid NFT metadata account")]
    InvalidNftMetadata,
    #[msg("NFT collection does not match")]
    InvalidNftCollection,
    #[msg("NFT collection is not verified")]
    NftCollectionNotVerified,
    #[msg("NFT is not held by the user")]
    NftNotHeld,
    #[msg("Loan is not eligible for liquidation")]
    LoanNotLiquidatable,
    #[msg("Pyth price feed is too stale")]
    PriceFeedStale,
    #[msg("Pyth price is negative or zero")]
    PriceFeedNegative,
    #[msg("Price feed config does not match the expected mint")]
    PriceFeedConfigMismatch,
    #[msg("Missing required price feed account")]
    MissingPriceFeed,
    #[msg("Loan duration must be at least 1 day (86400 seconds)")]
    DurationTooShort,
    #[msg("APY is below the protocol minimum")]
    ApyTooLow,
    #[msg("APY exceeds the protocol maximum")]
    ApyTooHigh,
    #[msg("Collateral ratio is below the protocol minimum")]
    CollateralRatioTooLow,
    #[msg("Collateral ratio exceeds the protocol maximum")]
    CollateralRatioTooHigh,
    #[msg("Loan collateral ratio is not below the minimum threshold")]
    LoanNotUndercollateralized,
}
