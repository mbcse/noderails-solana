//! Merchant payout manager — on-chain only; mirrors `NodeRailsMerchantManager.sol` using ed25519 + documented message layouts.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer as SysTransfer};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer};
use ed25519_dalek::{PublicKey, Signature, Verifier};

declare_id!("GKiurKP2ELeBXxjvXncvLzHpUyHVzBvWzuzm1f2i4KUz");

const SESSION_DOMAIN: &[u8] = b"NodeRailsMerchantManager::Session:v1";
const PAYOUT_SPL_DOMAIN: &[u8] = b"NodeRailsMerchantManager::NoderailsPayoutSpl:v1";
const PAYOUT_NATIVE_DOMAIN: &[u8] = b"NodeRailsMerchantManager::NoderailsNativePayout:v1";

#[program]
pub mod noderails_merchant_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        require_keys_neq!(
            ctx.accounts.super_admin.key(),
            ctx.accounts.first_admin.key(),
            MmError::AdminIsSuper
        );
        let cfg = &mut ctx.accounts.config;
        cfg.super_admin = ctx.accounts.super_admin.key();
        cfg.paused = false;
        cfg.bump_cfg = ctx.bumps.config;

        let sr = &mut ctx.accounts.super_role;
        sr.role = KeyRole::SuperAdmin as u8;
        sr.bump = ctx.bumps.super_role;

        let ar = &mut ctx.accounts.admin_role;
        ar.role = KeyRole::Admin as u8;
        ar.bump = ctx.bumps.admin_role;
        Ok(())
    }

    /// Super admin creates a `RoleRecord` for a new admin pubkey (pays rent).
    pub fn add_admin(ctx: Context<AddAdmin>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.super_admin.key(),
            ctx.accounts.config.super_admin,
            MmError::NotSuperAdmin
        );
        let nr = &mut ctx.accounts.new_role;
        nr.role = KeyRole::Admin as u8;
        nr.bump = ctx.bumps.new_role;
        Ok(())
    }

    pub fn set_role(ctx: Context<SetRole>, role: u8) -> Result<()> {
        let caller = ctx.accounts.caller_role.role;
        if caller == KeyRole::SuperAdmin as u8 {
            require!(role <= KeyRole::SuperAdmin as u8, MmError::BadRole);
            ctx.accounts.target_role.role = role;
            return Ok(());
        }
        require!(role <= KeyRole::TransactionKey as u8, MmError::BadRole);
        if caller == KeyRole::Admin as u8 {
            require!(
                role == KeyRole::TransactionKey as u8 || role == KeyRole::None as u8,
                MmError::BadRole
            );
            let tr = ctx.accounts.target_role.role;
            require!(
                tr != KeyRole::SuperAdmin as u8 && tr != KeyRole::Admin as u8,
                MmError::CannotChangeAdmin
            );
            ctx.accounts.target_role.role = role;
            return Ok(());
        }
        err!(MmError::NotAuthorized)
    }

    pub fn pause(ctx: Context<PauseIx>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.super_admin.key(),
            ctx.accounts.config.super_admin,
            MmError::NotSuperAdmin
        );
        ctx.accounts.config.paused = true;
        Ok(())
    }

    pub fn unpause(ctx: Context<PauseIx>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.super_admin.key(),
            ctx.accounts.config.super_admin,
            MmError::NotSuperAdmin
        );
        ctx.accounts.config.paused = false;
        Ok(())
    }

    pub fn execute_payout_spl(
        ctx: Context<ExecutePayoutSpl>,
        payout_intent_id: [u8; 32],
        amount: u64,
        session_expiry: i64,
        nonce: [u8; 32],
        session_message: Vec<u8>,
        session_signature: [u8; 64],
        payout_message: Vec<u8>,
        noderails_signature: [u8; 64],
    ) -> Result<()> {
        require_execute_auth(&ctx.accounts.config, &ctx.accounts.executor_role)?;
        require!(!ctx.accounts.config.paused, MmError::Paused);
        require!(amount > 0, MmError::BadAmount);
        require!(
            Clock::get()?.unix_timestamp < session_expiry,
            MmError::SessionExpired
        );
        verify_ed25519(
            &ctx.accounts.merchant_wallet.key(),
            &session_message,
            &session_signature,
        )?;
        verify_session_message(
            &session_message,
            &ctx.accounts.merchant_wallet.key(),
            session_expiry,
        )?;

        require_exec_authorized(&ctx.accounts.noderails_role)?;
        verify_ed25519(
            &ctx.accounts.noderails_wallet.key(),
            &payout_message,
            &noderails_signature,
        )?;
        verify_payout_spl_message(
            &payout_message,
            &payout_intent_id,
            &ctx.accounts.merchant_wallet.key(),
            &ctx.accounts.recipient.key(),
            &ctx.accounts.mint.key(),
            amount,
            &nonce,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                SplTransfer {
                    from: ctx.accounts.merchant_token.to_account_info(),
                    to: ctx.accounts.recipient_token.to_account_info(),
                    authority: ctx.accounts.merchant_wallet.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(PayoutExecuted {
            payout_intent_id,
            merchant: ctx.accounts.merchant_wallet.key(),
            recipient: ctx.accounts.recipient.key(),
            token: ctx.accounts.mint.key(),
            amount,
        });
        Ok(())
    }

    pub fn execute_native_payout(
        ctx: Context<ExecuteNativePayout>,
        payout_intent_id: [u8; 32],
        amount: u64,
        session_expiry: i64,
        nonce: [u8; 32],
        session_message: Vec<u8>,
        session_signature: [u8; 64],
        payout_message: Vec<u8>,
        noderails_signature: [u8; 64],
    ) -> Result<()> {
        require_execute_auth(&ctx.accounts.config, &ctx.accounts.executor_role)?;
        require!(!ctx.accounts.config.paused, MmError::Paused);
        require!(amount > 0, MmError::BadAmount);
        require!(
            Clock::get()?.unix_timestamp < session_expiry,
            MmError::SessionExpired
        );
        verify_ed25519(
            &ctx.accounts.merchant_wallet.key(),
            &session_message,
            &session_signature,
        )?;
        verify_session_message(
            &session_message,
            &ctx.accounts.merchant_wallet.key(),
            session_expiry,
        )?;

        require_exec_authorized(&ctx.accounts.noderails_role)?;
        verify_ed25519(
            &ctx.accounts.noderails_wallet.key(),
            &payout_message,
            &noderails_signature,
        )?;
        verify_payout_native_message(
            &payout_message,
            &payout_intent_id,
            &ctx.accounts.merchant_wallet.key(),
            &ctx.accounts.recipient.key(),
            amount,
            &nonce,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                SysTransfer {
                    from: ctx.accounts.executor.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(NativePayoutExecuted {
            payout_intent_id,
            merchant: ctx.accounts.merchant_wallet.key(),
            recipient: ctx.accounts.recipient.key(),
            amount,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub super_admin: Signer<'info>,
    pub first_admin: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + MerchConfig::INIT_SPACE,
        seeds = [b"mm_cfg"],
        bump
    )]
    pub config: Account<'info, MerchConfig>,
    #[account(
        init,
        payer = payer,
        space = 8 + RoleRecord::INIT_SPACE,
        seeds = [b"role", super_admin.key().as_ref()],
        bump
    )]
    pub super_role: Account<'info, RoleRecord>,
    #[account(
        init,
        payer = payer,
        space = 8 + RoleRecord::INIT_SPACE,
        seeds = [b"role", first_admin.key().as_ref()],
        bump
    )]
    pub admin_role: Account<'info, RoleRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddAdmin<'info> {
    pub super_admin: Signer<'info>,
    #[account(seeds = [b"mm_cfg"], bump = config.bump_cfg)]
    pub config: Account<'info, MerchConfig>,
    /// CHECK: new admin pubkey
    pub new_admin: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + RoleRecord::INIT_SPACE,
        seeds = [b"role", new_admin.key().as_ref()],
        bump
    )]
    pub new_role: Account<'info, RoleRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetRole<'info> {
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"role", caller.key().as_ref()],
        bump = caller_role.bump,
        constraint = caller_role.role != KeyRole::None as u8 @ MmError::NotAuthorized
    )]
    pub caller_role: Account<'info, RoleRecord>,
    /// CHECK: target key
    pub target: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"role", target.key().as_ref()],
        bump = target_role.bump
    )]
    pub target_role: Account<'info, RoleRecord>,
}

#[derive(Accounts)]
pub struct PauseIx<'info> {
    pub super_admin: Signer<'info>,
    #[account(mut, seeds = [b"mm_cfg"], bump = config.bump_cfg)]
    pub config: Account<'info, MerchConfig>,
}

#[derive(Accounts)]
#[instruction(nonce: [u8; 32])]
pub struct ExecutePayoutSpl<'info> {
    #[account(seeds = [b"mm_cfg"], bump = config.bump_cfg)]
    pub config: Account<'info, MerchConfig>,
    pub executor: Signer<'info>,
    #[account(
        seeds = [b"role", executor.key().as_ref()],
        bump = executor_role.bump
    )]
    pub executor_role: Account<'info, RoleRecord>,
    pub merchant_wallet: Signer<'info>,
    /// CHECK:
    pub recipient: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, constraint = merchant_token.owner == merchant_wallet.key() @ MmError::BadToken, constraint = merchant_token.mint == mint.key() @ MmError::BadToken)]
    pub merchant_token: Account<'info, TokenAccount>,
    #[account(mut, constraint = recipient_token.owner == recipient.key() @ MmError::BadToken, constraint = recipient_token.mint == mint.key() @ MmError::BadToken)]
    pub recipient_token: Account<'info, TokenAccount>,
    /// CHECK: pubkey that signed `payout_message`
    pub noderails_wallet: UncheckedAccount<'info>,
    #[account(
        seeds = [b"role", noderails_wallet.key().as_ref()],
        bump = noderails_role.bump
    )]
    pub noderails_role: Account<'info, RoleRecord>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8,
        seeds = [b"nonce", nonce.as_ref()],
        bump
    )]
    pub nonce_marker: Account<'info, NonceMarker>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: [u8; 32])]
pub struct ExecuteNativePayout<'info> {
    #[account(seeds = [b"mm_cfg"], bump = config.bump_cfg)]
    pub config: Account<'info, MerchConfig>,
    #[account(mut)]
    pub executor: Signer<'info>,
    #[account(
        seeds = [b"role", executor.key().as_ref()],
        bump = executor_role.bump
    )]
    pub executor_role: Account<'info, RoleRecord>,
    /// CHECK: merchant identity for session binding
    pub merchant_wallet: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    /// CHECK:
    pub noderails_wallet: UncheckedAccount<'info>,
    #[account(
        seeds = [b"role", noderails_wallet.key().as_ref()],
        bump = noderails_role.bump
    )]
    pub noderails_role: Account<'info, RoleRecord>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8,
        seeds = [b"nonce", nonce.as_ref()],
        bump
    )]
    pub nonce_marker: Account<'info, NonceMarker>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct MerchConfig {
    pub super_admin: Pubkey,
    pub paused: bool,
    pub bump_cfg: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RoleRecord {
    pub role: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct NonceMarker {}

#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum KeyRole {
    None = 0,
    TransactionKey = 1,
    Admin = 2,
    SuperAdmin = 3,
}

#[event]
pub struct PayoutExecuted {
    pub payout_intent_id: [u8; 32],
    pub merchant: Pubkey,
    pub recipient: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
}

#[event]
pub struct NativePayoutExecuted {
    pub payout_intent_id: [u8; 32],
    pub merchant: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

fn require_execute_auth(_cfg: &MerchConfig, exec: &RoleRecord) -> Result<()> {
    require_exec_authorized(exec)
}

fn require_exec_authorized(rec: &RoleRecord) -> Result<()> {
    let r = rec.role;
    require!(
        r == KeyRole::TransactionKey as u8
            || r == KeyRole::Admin as u8
            || r == KeyRole::SuperAdmin as u8,
        MmError::NotAuthorized
    );
    Ok(())
}

fn verify_ed25519(key: &Pubkey, message: &[u8], signature: &[u8; 64]) -> Result<()> {
    let pk = PublicKey::from_bytes(key.as_ref()).map_err(|_| error!(MmError::BadSig))?;
    let sig = Signature::from_bytes(signature).map_err(|_| error!(MmError::BadSig))?;
    pk.verify(message, &sig)
        .map_err(|_| error!(MmError::BadSig))?;
    Ok(())
}

fn verify_session_message(msg: &[u8], merchant: &Pubkey, expiry: i64) -> Result<()> {
    let need = SESSION_DOMAIN.len().checked_add(32).and_then(|n| n.checked_add(8));
    let need = need.ok_or(MmError::BadMessage)? as usize;
    require!(msg.len() == need, MmError::BadMessage);
    require!(
        msg.starts_with(SESSION_DOMAIN),
        MmError::BadMessage
    );
    let off = SESSION_DOMAIN.len();
    let mk: [u8; 32] = msg[off..off + 32].try_into().map_err(|_| error!(MmError::BadMessage))?;
    require_keys_eq!(Pubkey::new_from_array(mk), *merchant, MmError::BadMessage);
    let e = i64::from_le_bytes(msg[off + 32..].try_into().map_err(|_| error!(MmError::BadMessage))?);
    require!(e == expiry, MmError::BadMessage);
    Ok(())
}

fn verify_payout_spl_message(
    msg: &[u8],
    payout_intent_id: &[u8; 32],
    merchant: &Pubkey,
    recipient: &Pubkey,
    mint: &Pubkey,
    amount: u64,
    nonce: &[u8; 32],
) -> Result<()> {
    let need = PAYOUT_SPL_DOMAIN
        .len()
        .checked_add(32 * 5)
        .and_then(|n| n.checked_add(8))
        .ok_or(MmError::BadMessage)? as usize;
    require!(msg.len() == need, MmError::BadMessage);
    require!(msg.starts_with(PAYOUT_SPL_DOMAIN), MmError::BadMessage);
    let mut o = PAYOUT_SPL_DOMAIN.len();
    require_slice(msg, &mut o, payout_intent_id)?;
    require_pubkey(msg, &mut o, merchant)?;
    require_pubkey(msg, &mut o, recipient)?;
    require_pubkey(msg, &mut o, mint)?;
    let amt = read_u64_le(msg, &mut o)?;
    require!(amt == amount, MmError::BadMessage);
    require_slice(msg, &mut o, nonce)?;
    require!(o == msg.len(), MmError::BadMessage);
    Ok(())
}

fn verify_payout_native_message(
    msg: &[u8],
    payout_intent_id: &[u8; 32],
    merchant: &Pubkey,
    recipient: &Pubkey,
    amount: u64,
    nonce: &[u8; 32],
) -> Result<()> {
    let need = PAYOUT_NATIVE_DOMAIN
        .len()
        .checked_add(32 * 4)
        .and_then(|n| n.checked_add(8))
        .ok_or(MmError::BadMessage)? as usize;
    require!(msg.len() == need, MmError::BadMessage);
    require!(
        msg.starts_with(PAYOUT_NATIVE_DOMAIN),
        MmError::BadMessage
    );
    let mut o = PAYOUT_NATIVE_DOMAIN.len();
    require_slice(msg, &mut o, payout_intent_id)?;
    require_pubkey(msg, &mut o, merchant)?;
    require_pubkey(msg, &mut o, recipient)?;
    let amt = read_u64_le(msg, &mut o)?;
    require!(amt == amount, MmError::BadMessage);
    require_slice(msg, &mut o, nonce)?;
    require!(o == msg.len(), MmError::BadMessage);
    Ok(())
}

fn require_slice(msg: &[u8], off: &mut usize, want: &[u8; 32]) -> Result<()> {
    require!(
        *off + 32 <= msg.len(),
        MmError::BadMessage
    );
    require!(
        &msg[*off..*off + 32] == want.as_slice(),
        MmError::BadMessage
    );
    *off += 32;
    Ok(())
}

fn require_pubkey(msg: &[u8], off: &mut usize, want: &Pubkey) -> Result<()> {
    require!(
        *off + 32 <= msg.len(),
        MmError::BadMessage
    );
    let pk = Pubkey::new_from_array(msg[*off..*off + 32].try_into().unwrap());
    require_keys_eq!(pk, *want, MmError::BadMessage);
    *off += 32;
    Ok(())
}

fn read_u64_le(msg: &[u8], off: &mut usize) -> Result<u64> {
    require!(
        *off + 8 <= msg.len(),
        MmError::BadMessage
    );
    let v = u64::from_le_bytes(msg[*off..*off + 8].try_into().map_err(|_| error!(MmError::BadMessage))?);
    *off += 8;
    Ok(v)
}

#[error_code]
pub enum MmError {
    #[msg("Bad role")]
    BadRole,
    #[msg("Bad amount")]
    BadAmount,
    #[msg("Paused")]
    Paused,
    #[msg("Session expired")]
    SessionExpired,
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("Not super admin")]
    NotSuperAdmin,
    #[msg("Admin is super")]
    AdminIsSuper,
    #[msg("Role exists")]
    RoleExists,
    #[msg("Cannot change admin")]
    CannotChangeAdmin,
    #[msg("Bad signature")]
    BadSig,
    #[msg("Bad message")]
    BadMessage,
    #[msg("Bad token account")]
    BadToken,
}
