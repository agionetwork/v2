use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum LoanStatus {
    Pending = 0,
    Accepted = 1,
    Rescinded = 2,
    Repaid = 3,
    Foreclosed = 4,
    Liquidated = 5,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum PrivateStatus {
    Public = 0,
    PrivateBorrower = 1,
    PrivateLender = 2,
}

#[derive(InitSpace)]
#[account]
pub struct Loan {
    pub version: u8,
    pub create_key: Pubkey,
    pub bump: u8,
    pub lender: Option<Pubkey>,
    pub borrower: Option<Pubkey>,
    pub debt_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub debt_amount: u64,
    pub collateral_amount: u64,
    pub start: Option<i64>,
    pub duration: u64,
    pub apy: u8,
    pub private_status: u8,
    pub status: u8,
}

impl Loan {
    pub const PREFIX: &'static str = "loan";
    pub const SPACE: usize = 512;
}
