use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

declare_id!("AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX");

#[program]
pub mod agio {
    use super::*;

    pub fn create_borrow_offer<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateBorrowOffer<'info>>,
        args: CreateBorrowOfferArgs,
    ) -> Result<()> {
        instructions::create_borrow_offer(ctx, args)
    }

    pub fn create_lend_offer<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateLendOffer<'info>>,
        args: CreateLendOfferArgs,
    ) -> Result<()> {
        instructions::create_lend_offer(ctx, args)
    }

    pub fn accept_borrow_offer<'info>(
        ctx: Context<'_, '_, '_, 'info, AcceptBorrowOffer<'info>>,
    ) -> Result<()> {
        instructions::accept_borrow_offer(ctx)
    }

    pub fn accept_lend_offer<'info>(
        ctx: Context<'_, '_, '_, 'info, AcceptLendOffer<'info>>,
    ) -> Result<()> {
        instructions::accept_lend_offer(ctx)
    }

    pub fn repay_loan<'info>(
        ctx: Context<'_, '_, '_, 'info, RepayLoan<'info>>,
        args: RepayLoanArgs,
    ) -> Result<()> {
        instructions::repay_loan(ctx, args)
    }

    pub fn foreclose_loan<'info>(
        ctx: Context<'_, '_, '_, 'info, ForecloseLoan<'info>>,
    ) -> Result<()> {
        instructions::foreclose_loan(ctx)
    }

    pub fn foreclose_loan_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, ForecloseLoanV2<'info>>,
    ) -> Result<()> {
        instructions::foreclose_loan_v2(ctx)
    }

    pub fn rescind_borrow_offer<'info>(
        ctx: Context<'_, '_, '_, 'info, RescindBorrowOffer<'info>>,
    ) -> Result<()> {
        instructions::rescind_borrow_offer(ctx)
    }

    pub fn rescind_lend_offer<'info>(
        ctx: Context<'_, '_, '_, 'info, RescindLendOffer<'info>>,
    ) -> Result<()> {
        instructions::rescind_lend_offer(ctx)
    }

    pub fn add_collateral<'info>(
        ctx: Context<'_, '_, '_, 'info, AddCollateral<'info>>,
        args: AddCollateralArgs,
    ) -> Result<()> {
        instructions::add_collateral(ctx, args)
    }

    pub fn init_vault_authority<'info>(
        ctx: Context<'_, '_, '_, 'info, InitVaultAuthority<'info>>,
    ) -> Result<()> {
        instructions::init_vault_authority(ctx)
    }

    pub fn init_vault_token_account<'info>(
        ctx: Context<'_, '_, '_, 'info, InitVaultTokenAccount<'info>>,
    ) -> Result<()> {
        instructions::init_vault_token_account(ctx)
    }

    pub fn update_vault_disabled_mints<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateVaultDisabledMints<'info>>,
    ) -> Result<()> {
        instructions::update_vault_disabled_mints(ctx)
    }

    pub fn migrate_vault_authority<'info>(
        ctx: Context<'_, '_, '_, 'info, MigrateVaultAuthority<'info>>,
    ) -> Result<()> {
        instructions::migrate_vault_authority(ctx)
    }

    pub fn update_protocol_fees<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateProtocolFees<'info>>,
        args: UpdateProtocolFeesArgs,
    ) -> Result<()> {
        instructions::update_protocol_fees(ctx, args)
    }

    pub fn update_protocol_config<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateProtocolConfig<'info>>,
        args: UpdateProtocolConfigArgs,
    ) -> Result<()> {
        instructions::update_protocol_config(ctx, args)
    }

    pub fn init_price_feed_config<'info>(
        ctx: Context<'_, '_, '_, 'info, InitPriceFeedConfig<'info>>,
        args: InitPriceFeedConfigArgs,
    ) -> Result<()> {
        instructions::init_price_feed_config(ctx, args)
    }

    pub fn liquidate_loan<'info>(
        ctx: Context<'_, '_, '_, 'info, LiquidateLoan<'info>>,
    ) -> Result<()> {
        instructions::liquidate_loan(ctx)
    }

    pub fn rescind_undercollateralized_offer<'info>(
        ctx: Context<'_, '_, '_, 'info, RescindUndercollateralizedOffer<'info>>,
    ) -> Result<()> {
        instructions::rescind_undercollateralized_offer(ctx)
    }
}
