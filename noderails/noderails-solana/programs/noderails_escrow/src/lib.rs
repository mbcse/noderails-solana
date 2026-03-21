//! NodeRails escrow — Anchor parity with `NodeRailsEscrow.sol` (native SOL + SPL + lifecycle).

use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use anchor_spl::token_2022::{self, TransferChecked as SplTransferChecked};
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};
use solana_sdk_ids::{ed25519_program, sysvar::instructions as instructions_sysvar};

declare_id!("ErG2kE3uhKxkBympZytSjvxGik7aSigvpeDAxC9gcT6Y");

/// Max entries in `EscrowConfig::transaction_authorities` (admin/refund/SPL-capture ix signers).
pub const MAX_TRANSACTION_AUTHORITIES: usize = 8;
/// Max Ed25519 pubkeys that may verify `capture_*` auth signatures (MTXM rotaton).
pub const MAX_AUTHORIZED_NODERAILS_KEYS: usize = 8;

pub const MAX_FEE_BPS: u16 = 1000;
pub const NATIVE_MINT_SENTINEL: Pubkey = Pubkey::new_from_array([0u8; 32]);

/// Must match `buildCaptureNativeAuthMessage` in `packages/solana/src/escrow.ts`.
const CAPTURE_NATIVE_V1: &[u8] = b"NodeRailsEscrow::CaptureNative:v1";
/// Must match `buildCaptureSplAuthMessage` in `packages/solana/src/escrow.ts`.
const CAPTURE_SPL_V1: &[u8] = b"NodeRailsEscrow::CaptureSpl:v1";

fn expected_capture_native_message(
    payment_intent_id: &[u8; 32],
    merchant: &Pubkey,
    amount: u64,
    fee_bps: u16,
    timelocks: &[u8; 32],
) -> Vec<u8> {
    let mut v = Vec::with_capacity(
        CAPTURE_NATIVE_V1.len() + 32 + 32 + 8 + 2 + 32,
    );
    v.extend_from_slice(CAPTURE_NATIVE_V1);
    v.extend_from_slice(payment_intent_id);
    v.extend_from_slice(merchant.as_ref());
    v.extend_from_slice(&amount.to_le_bytes());
    v.extend_from_slice(&fee_bps.to_le_bytes());
    v.extend_from_slice(timelocks);
    v
}

fn expected_capture_spl_message(
    payment_intent_id: &[u8; 32],
    merchant: &Pubkey,
    mint: &Pubkey,
    amount: u64,
    fee_bps: u16,
    timelocks: &[u8; 32],
) -> Vec<u8> {
    let mut v = Vec::with_capacity(CAPTURE_SPL_V1.len() + 32 + 32 + 32 + 8 + 2 + 32);
    v.extend_from_slice(CAPTURE_SPL_V1);
    v.extend_from_slice(payment_intent_id);
    v.extend_from_slice(merchant.as_ref());
    v.extend_from_slice(mint.as_ref());
    v.extend_from_slice(&amount.to_le_bytes());
    v.extend_from_slice(&fee_bps.to_le_bytes());
    v.extend_from_slice(timelocks);
    v
}

#[program]
pub mod noderails_escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        fee_recipient: Pubkey,
        transaction_authorities: Vec<Pubkey>,
        authorized_noderails_keys: Vec<Pubkey>,
    ) -> Result<()> {
        require!(fee_recipient != Pubkey::default(), EscrowError::InvalidAccount);
        require!(!transaction_authorities.is_empty(), EscrowError::InvalidAccount);
        require!(!authorized_noderails_keys.is_empty(), EscrowError::InvalidAccount);
        require!(
            transaction_authorities.len() <= MAX_TRANSACTION_AUTHORITIES,
            EscrowError::TooManyAuthorities
        );
        require!(
            authorized_noderails_keys.len() <= MAX_AUTHORIZED_NODERAILS_KEYS,
            EscrowError::TooManyAuthorities
        );
        validate_pubkey_list(&transaction_authorities)?;
        validate_pubkey_list(&authorized_noderails_keys)?;
        let cfg = &mut ctx.accounts.config;
        cfg.fee_recipient = fee_recipient;
        cfg.super_admin = ctx.accounts.super_admin.key();
        cfg.transaction_authorities = transaction_authorities;
        cfg.authorized_noderails_keys = authorized_noderails_keys;
        cfg.paused = false;
        cfg.full_stopped = false;
        cfg.bump_config = ctx.bumps.config;
        Ok(())
    }

    pub fn set_fee_recipient(ctx: Context<AdminMut>, fee_recipient: Pubkey) -> Result<()> {
        require!(fee_recipient != Pubkey::default(), EscrowError::InvalidAccount);
        ctx.accounts.config.fee_recipient = fee_recipient;
        Ok(())
    }

    pub fn set_transaction_authorities(ctx: Context<AdminMut>, keys: Vec<Pubkey>) -> Result<()> {
        require!(!keys.is_empty(), EscrowError::InvalidAccount);
        require!(
            keys.len() <= MAX_TRANSACTION_AUTHORITIES,
            EscrowError::TooManyAuthorities
        );
        validate_pubkey_list(&keys)?;
        ctx.accounts.config.transaction_authorities = keys;
        Ok(())
    }

    pub fn set_authorized_noderails_keys(ctx: Context<AdminMut>, keys: Vec<Pubkey>) -> Result<()> {
        require!(!keys.is_empty(), EscrowError::InvalidAccount);
        require!(
            keys.len() <= MAX_AUTHORIZED_NODERAILS_KEYS,
            EscrowError::TooManyAuthorities
        );
        validate_pubkey_list(&keys)?;
        ctx.accounts.config.authorized_noderails_keys = keys;
        Ok(())
    }

    pub fn pause(ctx: Context<SuperAdminMut>) -> Result<()> {
        ctx.accounts.config.paused = true;
        Ok(())
    }

    pub fn unpause(ctx: Context<SuperAdminMut>) -> Result<()> {
        ctx.accounts.config.paused = false;
        Ok(())
    }

    pub fn full_stop(ctx: Context<SuperAdminMut>) -> Result<()> {
        require!(!ctx.accounts.config.full_stopped, EscrowError::AlreadyFullStop);
        ctx.accounts.config.full_stopped = true;
        Ok(())
    }

    pub fn lift_full_stop(ctx: Context<SuperAdminMut>) -> Result<()> {
        require!(ctx.accounts.config.full_stopped, EscrowError::NotFullStop);
        ctx.accounts.config.full_stopped = false;
        Ok(())
    }

    pub fn capture_native(
        ctx: Context<CaptureNative>,
        payment_intent_id: [u8; 32],
        amount: u64,
        fee_bps: u16,
        timelocks: [u8; 32],
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, EscrowError::Paused);
        require!(!cfg.full_stopped, EscrowError::FullStop);
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
        require!(
            ctx.accounts.merchant.key() != Pubkey::default(),
            EscrowError::InvalidAccount
        );
        validate_timelocks(&timelocks)?;
        let expected = expected_capture_native_message(
            &payment_intent_id,
            &ctx.accounts.merchant.key(),
            amount,
            fee_bps,
            &timelocks,
        );
        verify_capture_ed25519_precompile(
            ctx.accounts.ix_sysvar.as_ref(),
            &cfg.authorized_noderails_keys,
            expected.as_slice(),
        )?;

        let payment = &mut ctx.accounts.payment;
        require!(payment.status == PaymentStatus::None as u8, EscrowError::BadStatus);

        payment.merchant = ctx.accounts.merchant.key();
        payment.payer = ctx.accounts.payer.key();
        payment.mint = NATIVE_MINT_SENTINEL;
        payment.amount = amount;
        payment.fee_bps = fee_bps;
        payment.status = PaymentStatus::Captured as u8;
        payment.timelocks = timelocks;
        payment.bump = ctx.bumps.payment;
        payment.vault_bump = ctx.bumps.vault;

        system_program::transfer(
            CpiContext::new(
                system_program::ID,
                Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(PaymentCaptured {
            payment_intent_id,
            merchant: payment.merchant,
            payer: payment.payer,
            token: NATIVE_MINT_SENTINEL,
            amount,
            fee_bps,
            timelocks,
        });
        Ok(())
    }

    pub fn settle_native(ctx: Context<SettleNative>, payment_intent_id: [u8; 32]) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.full_stopped, EscrowError::FullStop);
        let now = Clock::get()?.unix_timestamp;
        let payment = &mut ctx.accounts.payment;
        require!(
            payment.status == PaymentStatus::Captured as u8,
            EscrowError::BadStatus
        );
        require_settlement_reached(payment.timelocks, now)?;
        settle_auth(cfg, payment, ctx.accounts.authority.key())?;

        let amount = payment.amount;
        let fee_bps = payment.fee_bps;
        payment.status = PaymentStatus::Settled as u8;
        let (merchant_amt, fee) = split_fee(amount, fee_bps)?;

        let vault_ai = ctx.accounts.vault.to_account_info();
        transfer_lamports_from_escrow_vault(
            &vault_ai,
            &ctx.accounts.merchant_recipient.to_account_info(),
            merchant_amt,
        )?;
        transfer_lamports_from_escrow_vault(
            &vault_ai,
            &ctx.accounts.fee_recipient.to_account_info(),
            fee,
        )?;

        emit!(PaymentSettled {
            payment_intent_id,
            merchant: payment.merchant,
            merchant_amount: merchant_amt,
            fee,
        });
        Ok(())
    }

    pub fn initiate_dispute(ctx: Context<DisputeIx>, payment_intent_id: [u8; 32]) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.full_stopped, EscrowError::FullStop);
        require_transaction_authority(cfg, &ctx.accounts.authority.key())?;
        let now = Clock::get()?.unix_timestamp;
        let payment = &mut ctx.accounts.payment;
        require!(
            payment.status == PaymentStatus::Captured as u8,
            EscrowError::BadStatus
        );
        require_dispute_open(payment.timelocks, now)?;
        payment.status = PaymentStatus::Disputed as u8;
        emit!(DisputeInitiated {
            payment_intent_id,
            merchant: payment.merchant,
            payer: payment.payer,
        });
        Ok(())
    }

    pub fn resolve_dispute_native(
        ctx: Context<ResolveDisputeNative>,
        payment_intent_id: [u8; 32],
        winner: Pubkey,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.full_stopped, EscrowError::FullStop);
        require_transaction_authority(cfg, &ctx.accounts.authority.key())?;
        let payment = &mut ctx.accounts.payment;
        require!(
            payment.status == PaymentStatus::Disputed as u8,
            EscrowError::BadStatus
        );
        require!(
            winner == payment.merchant || winner == payment.payer,
            EscrowError::InvalidWinner
        );
        let amount = payment.amount;
        let fee_bps = payment.fee_bps;

        if winner == payment.merchant {
            payment.status = PaymentStatus::Settled as u8;
            let (merchant_amt, fee) = split_fee(amount, fee_bps)?;
            let vault_ai = ctx.accounts.vault.to_account_info();
            transfer_lamports_from_escrow_vault(
                &vault_ai,
                &ctx.accounts.merchant_recipient.to_account_info(),
                merchant_amt,
            )?;
            transfer_lamports_from_escrow_vault(
                &vault_ai,
                &ctx.accounts.fee_recipient.to_account_info(),
                fee,
            )?;
            emit!(DisputeResolved {
                payment_intent_id,
                winner,
                amount: merchant_amt,
                fee,
            });
        } else {
            payment.status = PaymentStatus::Refunded as u8;
            emit!(DisputeResolved {
                payment_intent_id,
                winner,
                amount,
                fee: 0,
            });
        }
        Ok(())
    }

    pub fn refund_native(ctx: Context<RefundNative>, payment_intent_id: [u8; 32]) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.full_stopped, EscrowError::FullStop);
        require_transaction_authority(cfg, &ctx.accounts.authority.key())?;
        let now = Clock::get()?.unix_timestamp;
        let payment = &mut ctx.accounts.payment;
        require!(
            payment.status == PaymentStatus::Captured as u8,
            EscrowError::BadStatus
        );
        require_before_settlement(payment.timelocks, now)?;
        let amount = payment.amount;
        payment.status = PaymentStatus::Refunded as u8;
        emit!(PaymentRefunded {
            payment_intent_id,
            payer: payment.payer,
            amount,
        });
        Ok(())
    }

    pub fn capture_spl(
        ctx: Context<CaptureSpl>,
        payment_intent_id: [u8; 32],
        amount: u64,
        fee_bps: u16,
        timelocks: [u8; 32],
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, EscrowError::Paused);
        require!(!cfg.full_stopped, EscrowError::FullStop);
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
        require_transaction_authority(cfg, &ctx.accounts.authority.key())?;
        validate_timelocks(&timelocks)?;
        let expected = expected_capture_spl_message(
            &payment_intent_id,
            &ctx.accounts.merchant.key(),
            &ctx.accounts.mint.key(),
            amount,
            fee_bps,
            &timelocks,
        );
        verify_capture_ed25519_precompile(
            ctx.accounts.ix_sysvar.as_ref(),
            &cfg.authorized_noderails_keys,
            expected.as_slice(),
        )?;

        let payment = &mut ctx.accounts.payment;
        require!(payment.status == PaymentStatus::None as u8, EscrowError::BadStatus);
        payment.merchant = ctx.accounts.merchant.key();
        payment.payer = ctx.accounts.owner.key();
        payment.mint = ctx.accounts.mint.key();
        payment.amount = amount;
        payment.fee_bps = fee_bps;
        payment.status = PaymentStatus::Captured as u8;
        payment.timelocks = timelocks;
        payment.bump = ctx.bumps.payment;
        ctx.accounts.escrow_authority.bump = ctx.bumps.escrow_authority;

        let bump = ctx.bumps.escrow_authority;
        let seeds: &[&[u8]] = &[b"escrow_auth", &[bump]];
        let signer = &[seeds];
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SplTransferChecked {
                    from: ctx.accounts.payer_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault_token.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                },
                signer,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        emit!(PaymentCaptured {
            payment_intent_id,
            merchant: payment.merchant,
            payer: payment.payer,
            token: ctx.accounts.mint.key(),
            amount,
            fee_bps,
            timelocks,
        });
        Ok(())
    }

    pub fn settle_spl(ctx: Context<SettleSpl>, payment_intent_id: [u8; 32]) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.full_stopped, EscrowError::FullStop);
        let now = Clock::get()?.unix_timestamp;
        let payment = &mut ctx.accounts.payment;
        require!(
            payment.status == PaymentStatus::Captured as u8,
            EscrowError::BadStatus
        );
        require_settlement_reached(payment.timelocks, now)?;
        settle_auth(cfg, payment, ctx.accounts.authority.key())?;

        let amount = payment.amount;
        let fee_bps = payment.fee_bps;
        payment.status = PaymentStatus::Settled as u8;
        let (merchant_amt, fee) = split_fee(amount, fee_bps)?;

        let bump = ctx.accounts.escrow_authority.bump;
        let seeds: &[&[u8]] = &[b"escrow_auth", &[bump]];
        let signer = &[seeds];

        if merchant_amt > 0 {
            token_2022::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    SplTransferChecked {
                        from: ctx.accounts.vault_token.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.merchant_token.to_account_info(),
                        authority: ctx.accounts.escrow_authority.to_account_info(),
                    },
                    signer,
                ),
                merchant_amt,
                ctx.accounts.mint.decimals,
            )?;
        }
        if fee > 0 {
            token_2022::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    SplTransferChecked {
                        from: ctx.accounts.vault_token.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.fee_token.to_account_info(),
                        authority: ctx.accounts.escrow_authority.to_account_info(),
                    },
                    signer,
                ),
                fee,
                ctx.accounts.mint.decimals,
            )?;
        }

        emit!(PaymentSettled {
            payment_intent_id,
            merchant: payment.merchant,
            merchant_amount: merchant_amt,
            fee,
        });
        Ok(())
    }

    pub fn refund_spl(ctx: Context<RefundSpl>, payment_intent_id: [u8; 32]) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.full_stopped, EscrowError::FullStop);
        require_transaction_authority(cfg, &ctx.accounts.authority.key())?;
        let now = Clock::get()?.unix_timestamp;
        let payment = &mut ctx.accounts.payment;
        require!(
            payment.status == PaymentStatus::Captured as u8,
            EscrowError::BadStatus
        );
        require_before_settlement(payment.timelocks, now)?;
        let amount = payment.amount;
        payment.status = PaymentStatus::Refunded as u8;

        let bump = ctx.accounts.escrow_authority.bump;
        let seeds: &[&[u8]] = &[b"escrow_auth", &[bump]];
        let signer = &[seeds];
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SplTransferChecked {
                    from: ctx.accounts.vault_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.payer_token.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                },
                signer,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        emit!(PaymentRefunded {
            payment_intent_id,
            payer: payment.payer,
            amount,
        });
        Ok(())
    }

    pub fn resolve_dispute_spl(
        ctx: Context<ResolveDisputeSpl>,
        payment_intent_id: [u8; 32],
        winner: Pubkey,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.full_stopped, EscrowError::FullStop);
        require_transaction_authority(cfg, &ctx.accounts.authority.key())?;
        let payment = &mut ctx.accounts.payment;
        require!(
            payment.status == PaymentStatus::Disputed as u8,
            EscrowError::BadStatus
        );
        require!(
            winner == payment.merchant || winner == payment.payer,
            EscrowError::InvalidWinner
        );
        let amount = payment.amount;
        let fee_bps = payment.fee_bps;
        let bump = ctx.accounts.escrow_authority.bump;
        let seeds: &[&[u8]] = &[b"escrow_auth", &[bump]];
        let signer = &[seeds];

        if winner == payment.merchant {
            payment.status = PaymentStatus::Settled as u8;
            let (merchant_amt, fee) = split_fee(amount, fee_bps)?;
            if merchant_amt > 0 {
                token_2022::transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.key(),
                        SplTransferChecked {
                            from: ctx.accounts.vault_token.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            to: ctx.accounts.merchant_token.to_account_info(),
                            authority: ctx.accounts.escrow_authority.to_account_info(),
                        },
                        signer,
                    ),
                    merchant_amt,
                    ctx.accounts.mint.decimals,
                )?;
            }
            if fee > 0 {
                token_2022::transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.key(),
                        SplTransferChecked {
                            from: ctx.accounts.vault_token.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            to: ctx.accounts.fee_token.to_account_info(),
                            authority: ctx.accounts.escrow_authority.to_account_info(),
                        },
                        signer,
                    ),
                    fee,
                    ctx.accounts.mint.decimals,
                )?;
            }
            emit!(DisputeResolved {
                payment_intent_id,
                winner,
                amount: merchant_amt,
                fee,
            });
        } else {
            payment.status = PaymentStatus::Refunded as u8;
            token_2022::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    SplTransferChecked {
                        from: ctx.accounts.vault_token.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.payer_token.to_account_info(),
                        authority: ctx.accounts.escrow_authority.to_account_info(),
                    },
                    signer,
                ),
                amount,
                ctx.accounts.mint.decimals,
            )?;
            emit!(DisputeResolved {
                payment_intent_id,
                winner,
                amount,
                fee: 0,
            });
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub super_admin: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + EscrowConfig::INIT_SPACE,
        seeds = [b"cfg"],
        bump
    )]
    pub config: Account<'info, EscrowConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminMut<'info> {
    pub super_admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"cfg"],
        bump = config.bump_config,
        constraint = config.super_admin == super_admin.key() @ EscrowError::NotSuperAdmin
    )]
    pub config: Account<'info, EscrowConfig>,
}

#[derive(Accounts)]
pub struct SuperAdminMut<'info> {
    pub super_admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"cfg"],
        bump = config.bump_config,
        constraint = config.super_admin == super_admin.key() @ EscrowError::NotSuperAdmin
    )]
    pub config: Account<'info, EscrowConfig>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct CaptureNative<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK:
    pub merchant: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Payment::INIT_SPACE,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump
    )]
    pub payment: Account<'info, Payment>,
    /// Native SOL vault PDA (program-owned); lamports moved in-program on settle/refund.
    #[account(
        init,
        payer = payer,
        space = 8 + NativeSolVault::INIT_SPACE,
        seeds = [b"vlm", payment_intent_id.as_ref()],
        bump
    )]
    pub vault: Account<'info, NativeSolVault>,
    /// CHECK: Instructions sysvar — required to assert an Ed25519 program ix pre-verified the auth payload.
    #[account(address = instructions_sysvar::ID)]
    pub ix_sysvar: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct SettleNative<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = merchant_recipient,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump = payment.bump
    )]
    pub payment: Account<'info, Payment>,
    /// Native SOL vault PDA; seeds and bump match payment.vault_bump.
    #[account(
        mut,
        close = merchant_recipient,
        seeds = [b"vlm", payment_intent_id.as_ref()],
        bump = payment.vault_bump
    )]
    pub vault: Account<'info, NativeSolVault>,
    #[account(mut, address = payment.merchant)]
    pub merchant_recipient: SystemAccount<'info>,
    #[account(mut, address = config.fee_recipient)]
    pub fee_recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct DisputeIx<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump = payment.bump
    )]
    pub payment: Account<'info, Payment>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32], winner: Pubkey)]
pub struct ResolveDisputeNative<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = close_receiver,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump = payment.bump
    )]
    pub payment: Account<'info, Payment>,
    /// Native SOL vault PDA; seeds and bump match payment.vault_bump.
    #[account(
        mut,
        close = close_receiver,
        seeds = [b"vlm", payment_intent_id.as_ref()],
        bump = payment.vault_bump
    )]
    pub vault: Account<'info, NativeSolVault>,
    #[account(mut, address = payment.merchant)]
    pub merchant_recipient: SystemAccount<'info>,
    #[account(mut, address = payment.payer)]
    pub payer_recipient: SystemAccount<'info>,
    #[account(mut, address = config.fee_recipient)]
    pub fee_recipient: SystemAccount<'info>,
    /// CHECK: Must match `winner`; receives lamports from closing payment + vault PDAs.
    #[account(mut, constraint = close_receiver.key() == winner @ EscrowError::InvalidAccount)]
    pub close_receiver: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct RefundNative<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = payer_recipient,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump = payment.bump
    )]
    pub payment: Account<'info, Payment>,
    /// Native SOL vault PDA; seeds and bump match payment.vault_bump.
    #[account(
        mut,
        close = payer_recipient,
        seeds = [b"vlm", payment_intent_id.as_ref()],
        bump = payment.vault_bump
    )]
    pub vault: Account<'info, NativeSolVault>,
    #[account(mut, address = payment.payer)]
    pub payer_recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct CaptureSpl<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    /// CHECK:
    pub owner: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = payer_token.owner == owner.key() @ EscrowError::BadTokenOwner,
        constraint = payer_token.mint == mint.key() @ EscrowError::BadTokenMint
    )]
    pub payer_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = funder,
        space = 8 + Payment::INIT_SPACE,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump
    )]
    pub payment: Account<'info, Payment>,
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(
        init_if_needed,
        payer = funder,
        space = 8 + EscrowAuthPda::INIT_SPACE,
        seeds = [b"escrow_auth"],
        bump
    )]
    pub escrow_authority: Account<'info, EscrowAuthPda>,
    /// Must already exist (create the escrow vault ATA in a separate tx — Token-2022 ATA init + capture exceeds one tx CU limit).
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
        associated_token::token_program = token_program,
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Instructions sysvar — required to assert an Ed25519 program ix pre-verified the auth payload.
    #[account(address = instructions_sysvar::ID)]
    pub ix_sysvar: UncheckedAccount<'info>,
    /// CHECK:
    pub merchant: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct SettleSpl<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump = payment.bump
    )]
    pub payment: Account<'info, Payment>,
    #[account(
        constraint = mint.key() == payment.mint @ EscrowError::BadTokenMint
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = vault_token.owner == escrow_authority.key() @ EscrowError::BadTokenOwner
    )]
    pub vault_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = merchant_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = merchant_token.owner == payment.merchant @ EscrowError::BadTokenOwner
    )]
    pub merchant_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = fee_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = fee_token.owner == config.fee_recipient @ EscrowError::BadTokenOwner
    )]
    pub fee_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [b"escrow_auth"], bump = escrow_authority.bump)]
    pub escrow_authority: Account<'info, EscrowAuthPda>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct RefundSpl<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump = payment.bump
    )]
    pub payment: Account<'info, Payment>,
    #[account(
        constraint = mint.key() == payment.mint @ EscrowError::BadTokenMint
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = vault_token.owner == escrow_authority.key() @ EscrowError::BadTokenOwner
    )]
    pub vault_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = payer_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = payer_token.owner == payment.payer @ EscrowError::BadTokenOwner
    )]
    pub payer_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [b"escrow_auth"], bump = escrow_authority.bump)]
    pub escrow_authority: Account<'info, EscrowAuthPda>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: [u8; 32])]
pub struct ResolveDisputeSpl<'info> {
    #[account(seeds = [b"cfg"], bump = config.bump_config)]
    pub config: Account<'info, EscrowConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pay", payment_intent_id.as_ref()],
        bump = payment.bump
    )]
    pub payment: Account<'info, Payment>,
    #[account(
        constraint = mint.key() == payment.mint @ EscrowError::BadTokenMint
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = vault_token.owner == escrow_authority.key() @ EscrowError::BadTokenOwner
    )]
    pub vault_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = merchant_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = merchant_token.owner == payment.merchant @ EscrowError::BadTokenOwner
    )]
    pub merchant_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = payer_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = payer_token.owner == payment.payer @ EscrowError::BadTokenOwner
    )]
    pub payer_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = fee_token.mint == payment.mint @ EscrowError::BadTokenMint,
        constraint = fee_token.owner == config.fee_recipient @ EscrowError::BadTokenOwner
    )]
    pub fee_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [b"escrow_auth"], bump = escrow_authority.bump)]
    pub escrow_authority: Account<'info, EscrowAuthPda>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowConfig {
    pub fee_recipient: Pubkey,
    pub super_admin: Pubkey,
    #[max_len(8)]
    pub transaction_authorities: Vec<Pubkey>,
    #[max_len(8)]
    pub authorized_noderails_keys: Vec<Pubkey>,
    pub paused: bool,
    pub full_stopped: bool,
    pub bump_config: u8,
}

#[account]
#[derive(InitSpace)]
pub struct NativeSolVault {}

#[account]
#[derive(InitSpace)]
pub struct Payment {
    pub merchant: Pubkey,
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub fee_bps: u16,
    pub status: u8,
    pub timelocks: [u8; 32],
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowAuthPda {
    pub bump: u8,
}

#[derive(Clone, Copy)]
pub enum PaymentStatus {
    None = 0,
    Captured = 1,
    Settled = 2,
    Disputed = 3,
    Refunded = 4,
}

#[event]
pub struct PaymentCaptured {
    pub payment_intent_id: [u8; 32],
    pub merchant: Pubkey,
    pub payer: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
    pub fee_bps: u16,
    pub timelocks: [u8; 32],
}

#[event]
pub struct PaymentSettled {
    pub payment_intent_id: [u8; 32],
    pub merchant: Pubkey,
    pub merchant_amount: u64,
    pub fee: u64,
}

#[event]
pub struct DisputeInitiated {
    pub payment_intent_id: [u8; 32],
    pub merchant: Pubkey,
    pub payer: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub payment_intent_id: [u8; 32],
    pub winner: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct PaymentRefunded {
    pub payment_intent_id: [u8; 32],
    pub payer: Pubkey,
    pub amount: u64,
}

fn validate_pubkey_list(keys: &[Pubkey]) -> Result<()> {
    for k in keys {
        require!(*k != Pubkey::default(), EscrowError::InvalidAccount);
    }
    for i in 0..keys.len() {
        for j in (i + 1)..keys.len() {
            require!(keys[i] != keys[j], EscrowError::DuplicateAuthority);
        }
    }
    Ok(())
}

fn require_transaction_authority(cfg: &EscrowConfig, key: &Pubkey) -> Result<()> {
    require!(
        cfg.transaction_authorities.iter().any(|k| k == key),
        EscrowError::NotAuthorized
    );
    Ok(())
}

/// Ed25519 ix data: single signature, all offsets into this ix's data (`instruction_index == u16::MAX`).
fn parse_ed25519_single_sig_ix(data: &[u8]) -> Result<(Pubkey, &[u8])> {
    const DATA_START: usize = 16;
    const PK_LEN: usize = 32;
    if data.len() < DATA_START {
        return err!(EscrowError::BadEd25519);
    }
    if data[0] != 1 {
        return err!(EscrowError::BadEd25519);
    }
    let read_u16 = |i: usize| -> u16 {
        u16::from_le_bytes([data[i], data[i + 1]])
    };
    let signature_offset = read_u16(2) as usize;
    let signature_instruction_index = read_u16(4);
    let public_key_offset = read_u16(6) as usize;
    let public_key_instruction_index = read_u16(8);
    let message_data_offset = read_u16(10) as usize;
    let message_data_size = read_u16(12) as usize;
    let message_instruction_index = read_u16(14);
    let idx_self = u16::MAX;
    require!(
        signature_instruction_index == idx_self
            && public_key_instruction_index == idx_self
            && message_instruction_index == idx_self,
        EscrowError::BadEd25519
    );
    let pk_end = public_key_offset
        .checked_add(PK_LEN)
        .ok_or(EscrowError::BadEd25519)?;
    if pk_end > data.len() {
        return err!(EscrowError::BadEd25519);
    }
    let pk_bytes: [u8; 32] = data[public_key_offset..pk_end]
        .try_into()
        .map_err(|_| error!(EscrowError::BadEd25519))?;
    let pubkey = Pubkey::new_from_array(pk_bytes);
    let msg_end = message_data_offset
        .checked_add(message_data_size)
        .ok_or(EscrowError::BadEd25519)?;
    if msg_end > data.len() {
        return err!(EscrowError::BadEd25519);
    }
    let _sig_end = signature_offset
        .checked_add(64)
        .ok_or(EscrowError::BadEd25519)?;
    if _sig_end > data.len() {
        return err!(EscrowError::BadEd25519);
    }
    let message = &data[message_data_offset..msg_end];
    Ok((pubkey, message))
}

/// Requires a prior instruction in this tx to the Ed25519 program, for the same canonical payload
/// and a pubkey in `authorized_noderails_keys`. The runtime verifies the signature; we only check binding.
fn verify_capture_ed25519_precompile(
    instructions_ai: &AccountInfo<'_>,
    authorized_keys: &[Pubkey],
    expected_message: &[u8],
) -> Result<()> {
    let current =
        load_current_index_checked(instructions_ai).map_err(|_| error!(EscrowError::BadEd25519))?
            as usize;

    for i in 0..current {
        let ix = load_instruction_at_checked(i, instructions_ai)
            .map_err(|_| error!(EscrowError::BadEd25519))?;
        if !ed25519_program::check_id(&ix.program_id) {
            continue;
        }
        let (pk, msg) = parse_ed25519_single_sig_ix(&ix.data)?;
        if msg == expected_message && authorized_keys.iter().any(|k| *k == pk) {
            return Ok(());
        }
    }
    err!(EscrowError::BadEd25519)
}

/// EVM `packTimelocks` layout (`packages/web3/src/timelocks.ts`).
/// Decoded with `u128` pairs to avoid pulling in `primitive-types` (SBF stack limits on `U512` paths).
fn decode_timelocks_abs(buf: &[u8; 32]) -> (i64, i64, i64) {
    let hi = u128::from_be_bytes(buf[0..16].try_into().unwrap());
    let lo = u128::from_be_bytes(buf[16..32].try_into().unwrap());
    let captured = (hi >> 96) as u32 as i64;
    let dispute_off = ((lo >> 32) & 0xffff_ffff) as u32 as i64;
    let settlement_off = ((lo >> 64) & 0xffff_ffff) as u32 as i64;
    (
        captured,
        captured + dispute_off,
        captured + settlement_off,
    )
}

fn validate_timelocks(buf: &[u8; 32]) -> Result<()> {
    let (c, d_at, s_at) = decode_timelocks_abs(buf);
    require!(c > 0, EscrowError::InvalidTimelocks);
    require!(s_at >= c, EscrowError::InvalidTimelocks);
    require!(d_at <= s_at, EscrowError::InvalidTimelocks);
    Ok(())
}

fn require_settlement_reached(timelocks: [u8; 32], now: i64) -> Result<()> {
    let (_, _, settle_at) = decode_timelocks_abs(&timelocks);
    require!(now >= settle_at, EscrowError::TooEarly);
    Ok(())
}

fn require_dispute_open(timelocks: [u8; 32], now: i64) -> Result<()> {
    let (_, dispute_at, settle_at) = decode_timelocks_abs(&timelocks);
    require!(now >= dispute_at, EscrowError::TooEarly);
    require!(now < settle_at, EscrowError::TooLate);
    Ok(())
}

fn require_before_settlement(timelocks: [u8; 32], now: i64) -> Result<()> {
    let (_, _, settle_at) = decode_timelocks_abs(&timelocks);
    require!(now < settle_at, EscrowError::TooLate);
    Ok(())
}

fn settle_auth(cfg: &EscrowConfig, payment: &Payment, auth: Pubkey) -> Result<()> {
    require!(
        auth == payment.merchant || cfg.transaction_authorities.contains(&auth),
        EscrowError::NotAuthorized
    );
    Ok(())
}

/// Native vault PDA is program-owned (Anchor `NativeSolVault`); System Program cannot debit it. Move
/// escrowed lamports in-program; rent-exempt reserve stays until accounts are closed.
fn transfer_lamports_from_escrow_vault(
    vault: &AccountInfo,
    to: &AccountInfo,
    lamports: u64,
) -> Result<()> {
    if lamports == 0 {
        return Ok(());
    }
    let v = **vault.try_borrow_lamports()?;
    let v_next = v
        .checked_sub(lamports)
        .ok_or(EscrowError::MathOverflow)?;
    let t = **to.try_borrow_lamports()?;
    let t_next = t
        .checked_add(lamports)
        .ok_or(EscrowError::MathOverflow)?;
    **vault.try_borrow_mut_lamports()? = v_next;
    **to.try_borrow_mut_lamports()? = t_next;
    Ok(())
}

fn split_fee(amount: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee = amount
        .checked_mul(fee_bps as u64)
        .ok_or(EscrowError::MathOverflow)?
        / 10_000u64;
    let merchant_amt = amount.checked_sub(fee).ok_or(EscrowError::MathOverflow)?;
    Ok((merchant_amt, fee))
}

#[error_code]
pub enum EscrowError {
    #[msg("Duplicate key in authority list")]
    DuplicateAuthority,
    #[msg("Too many authorities in list")]
    TooManyAuthorities,
    #[msg("Paused")]
    Paused,
    #[msg("Full stop")]
    FullStop,
    #[msg("Not full stop")]
    NotFullStop,
    #[msg("Already full stop")]
    AlreadyFullStop,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Fee too high")]
    FeeTooHigh,
    #[msg("Invalid account")]
    InvalidAccount,
    #[msg("Invalid timelocks")]
    InvalidTimelocks,
    #[msg("Bad ed25519")]
    BadEd25519,
    #[msg("Signed auth message does not match capture parameters")]
    BadAuthMessage,
    #[msg("Token mint does not match payment")]
    BadTokenMint,
    #[msg("Bad status")]
    BadStatus,
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("Not super admin")]
    NotSuperAdmin,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Too early")]
    TooEarly,
    #[msg("Too late")]
    TooLate,
    #[msg("Invalid winner")]
    InvalidWinner,
    #[msg("Bad token owner")]
    BadTokenOwner,
}
