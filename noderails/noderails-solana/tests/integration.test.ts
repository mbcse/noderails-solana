import * as anchor from '@anchor-lang/core';
import { expect } from 'chai';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createApproveInstruction,
  createAssociatedTokenAccountInstruction,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
} from '@solana/web3.js';
import BN from 'bn.js';
import nacl from 'tweetnacl';
import {
  buildCaptureNativeAuthMessage,
  buildCaptureSplAuthMessage,
  ed25519VerifyInstruction,
  escrowAuthorityPda,
} from '@noderails/solana';
import {
  assertWithinProtocolComputeBudget,
  ensureSol,
  getClockUnix,
  loadProgram,
  packTimelocksBytes,
  simulateSignedTxUnitsConsumed,
  SOLANA_PROTOCOL_MAX_COMPUTE_UNITS,
} from './helpers.js';

/** Pre-instruction: runtime verifies Ed25519; escrow only checks pubkey + message binding. */
function ed25519PreInstruction(message: Buffer, noderailsAuth: Keypair) {
  const sig = nacl.sign.detached(new Uint8Array(message), noderailsAuth.secretKey);
  return ed25519VerifyInstruction({
    publicKey: noderailsAuth.publicKey,
    message,
    signature: Buffer.from(sig),
  });
}

/** Solana caps one transaction at 1.4M CUs (clusters and local test validator). */
const SOLANA_TX_MAX_CU = SOLANA_PROTOCOL_MAX_COMPUTE_UNITS;

/** Matches wallet capture limit in `apps/payment-ui/.../payment-link-checkout.tsx`. */
const SOLANA_NATIVE_CAPTURE_CU_LIMIT = SOLANA_TX_MAX_CU;

const SPL_CAPTURE_CU_LIMIT = SOLANA_TX_MAX_CU;

/**
 * Simulate legacy `captureNative` CU usage (uses cluster max CU limit so the tx can complete if it fits).
 */
async function measureCaptureNativeCu(
  escrow: anchor.Program,
  provider: anchor.AnchorProvider,
  params: {
    payer: Keypair;
    merchant: PublicKey;
    noderailsAuth: Keypair;
    lamports: bigint;
    feeBps: number;
  },
): Promise<number> {
  const intent = Keypair.generate();
  const pid = Array.from(intent.publicKey.toBytes());
  const nowClock = await getClockUnix(provider.connection);
  const timelocks = packTimelocksBytes(nowClock, 0, 0);
  const msg = buildCaptureNativeAuthMessage({
    paymentIntentId: Uint8Array.from(pid),
    merchant: params.merchant,
    amount: params.lamports,
    feeBps: params.feeBps,
    timelocks: Uint8Array.from(timelocks),
  });
  const tx = await escrow.methods
    .captureNative(pid, new BN(params.lamports.toString()), params.feeBps, timelocks)
    .accounts({
      config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
      payer: params.payer.publicKey,
      merchant: params.merchant,
      ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .signers([params.payer])
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: SPL_CAPTURE_CU_LIMIT }),
      ed25519PreInstruction(Buffer.from(msg), params.noderailsAuth),
    ])
    .transaction();

  return simulateSignedTxUnitsConsumed(provider.connection, tx, [params.payer], 'captureNative(measured)');
}

describe('noderails (localnet)', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const escrow = loadProgram(provider, 'noderails_escrow');
  const merchant = loadProgram(provider, 'noderails_merchant_manager');

  const payer = Keypair.generate();
  const merchantWallet = Keypair.generate();
  const feeRecipient = Keypair.generate();
  const txAuthority = Keypair.generate();
  const noderailsAuth = Keypair.generate();
  const superAdmin = Keypair.generate();

  before(async () => {
    for (const k of [payer, merchantWallet, feeRecipient, txAuthority, noderailsAuth, superAdmin]) {
      await ensureSol(provider.connection, k.publicKey);
    }
  });

  describe('noderails_escrow', () => {
    it('initializes config', async () => {
      await escrow.methods
        .initialize(
          feeRecipient.publicKey,
          [txAuthority.publicKey],
          [noderailsAuth.publicKey],
        )
        .accounts({
          payer: payer.publicKey,
          superAdmin: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer, superAdmin])
        .rpc();
    });

    it('captures and settles native SOL (immediate settlement timelock)', async () => {
      const intent = Keypair.generate();
      const pid = Array.from(intent.publicKey.toBytes());
      const nowClock = await getClockUnix(provider.connection);
      const timelocks = packTimelocksBytes(nowClock, 0, 0);

      const lamports = 2_000_000n;
      const feeBps = 100;
      const msg = buildCaptureNativeAuthMessage({
        paymentIntentId: Uint8Array.from(pid),
        merchant: merchantWallet.publicKey,
        amount: lamports,
        feeBps,
        timelocks: Uint8Array.from(timelocks),
      });
      await escrow.methods
        .captureNative(pid, new BN(lamports.toString()), feeBps, timelocks)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          payer: payer.publicKey,
          merchant: merchantWallet.publicKey,
          ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ed25519PreInstruction(Buffer.from(msg), noderailsAuth),
        ])
        .rpc();

      await escrow.methods
        .settleNative(pid)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          authority: merchantWallet.publicKey,
          merchantRecipient: merchantWallet.publicKey,
          feeRecipient: feeRecipient.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([merchantWallet])
        .rpc();

      const merBal = await provider.connection.getBalance(merchantWallet.publicKey);
      const feeBal = await provider.connection.getBalance(feeRecipient.publicKey);
      expect(merBal).to.be.greaterThan(0);
      expect(feeBal).to.be.greaterThan(0);
    });

    it('captures native then refunds before settlement', async () => {
      const intent = Keypair.generate();
      const pid = Array.from(intent.publicKey.toBytes());
      const nowClock = await getClockUnix(provider.connection);
      const timelocks = packTimelocksBytes(nowClock, 0, 86_400);

      const lamports = 1_500_000n;
      const feeBps = 50;
      const msg = buildCaptureNativeAuthMessage({
        paymentIntentId: Uint8Array.from(pid),
        merchant: merchantWallet.publicKey,
        amount: lamports,
        feeBps,
        timelocks: Uint8Array.from(timelocks),
      });
      const preBal = await provider.connection.getBalance(payer.publicKey);

      await escrow.methods
        .captureNative(pid, new BN(lamports.toString()), feeBps, timelocks)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          payer: payer.publicKey,
          merchant: merchantWallet.publicKey,
          ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ed25519PreInstruction(Buffer.from(msg), noderailsAuth),
        ])
        .rpc();

      await escrow.methods
        .refundNative(pid)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          authority: txAuthority.publicKey,
          payerRecipient: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([txAuthority])
        .rpc();

      const postBal = await provider.connection.getBalance(payer.publicKey);
      expect(postBal).to.be.at.least(preBal - 50_000);
    });

    it('captures native, opens dispute, resolves for merchant', async () => {
      const intent = Keypair.generate();
      const pid = Array.from(intent.publicKey.toBytes());
      const nowClock = await getClockUnix(provider.connection);
      const timelocks = packTimelocksBytes(nowClock, 0, 500);

      const lamports = 3_000_000n;
      const feeBps = 100;
      const msg = buildCaptureNativeAuthMessage({
        paymentIntentId: Uint8Array.from(pid),
        merchant: merchantWallet.publicKey,
        amount: lamports,
        feeBps,
        timelocks: Uint8Array.from(timelocks),
      });
      await escrow.methods
        .captureNative(pid, new BN(lamports.toString()), feeBps, timelocks)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          payer: payer.publicKey,
          merchant: merchantWallet.publicKey,
          ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ed25519PreInstruction(Buffer.from(msg), noderailsAuth),
        ])
        .rpc();

      await escrow.methods
        .initiateDispute(pid)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          authority: txAuthority.publicKey,
        })
        .signers([txAuthority])
        .rpc();

      await escrow.methods
        .resolveDisputeNative(pid, merchantWallet.publicKey)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          authority: txAuthority.publicKey,
          merchantRecipient: merchantWallet.publicKey,
          payerRecipient: payer.publicKey,
          feeRecipient: feeRecipient.publicKey,
          closeReceiver: merchantWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([txAuthority])
        .rpc();
    });

    it('capture_spl: mint, vault ATA, delegate, capture', async () => {
      const mintKp = Keypair.generate();
      const decimals = 6;
      await createMint(
        provider.connection,
        payer,
        payer.publicKey,
        null,
        decimals,
        mintKp,
        undefined,
        TOKEN_PROGRAM_ID,
      );
      const mint = mintKp.publicKey;
      const payerAta = getAssociatedTokenAddressSync(
        mint,
        payer.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      let payerAtaMissing = false;
      try {
        await getAccount(provider.connection, payerAta, 'confirmed', TOKEN_PROGRAM_ID);
      } catch {
        payerAtaMissing = true;
      }
      if (payerAtaMissing) {
        const ix = createAssociatedTokenAccountInstruction(
          payer.publicKey,
          payerAta,
          payer.publicKey,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        const tx = new Transaction().add(ix);
        await provider.sendAndConfirm(tx, [payer]);
      }

      await mintTo(
        provider.connection,
        payer,
        mint,
        payerAta,
        payer,
        10_000_000n,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID,
      );

      const escrowAuth = escrowAuthorityPda(escrow.programId);
      const vaultAta = getAssociatedTokenAddressSync(
        mint,
        escrowAuth,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const createVaultIx = createAssociatedTokenAccountInstruction(
        payer.publicKey,
        vaultAta,
        escrowAuth,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      await provider.sendAndConfirm(new Transaction().add(createVaultIx), [payer]);

      const delIx = createApproveInstruction(
        payerAta,
        escrowAuth,
        payer.publicKey,
        5_000_000n,
        [],
        TOKEN_PROGRAM_ID,
      );
      await provider.sendAndConfirm(new Transaction().add(delIx), [payer]);

      const intent = Keypair.generate();
      const pid = Array.from(intent.publicKey.toBytes());
      const nowClock = await getClockUnix(provider.connection);
      const timelocks = packTimelocksBytes(nowClock, 0, 0);
      const amountRaw = 1_000_000n;
      const feeBps = 100;
      const authMsg = buildCaptureSplAuthMessage({
        paymentIntentId: Uint8Array.from(pid),
        merchant: merchantWallet.publicKey,
        mint,
        amount: amountRaw,
        feeBps,
        timelocks: Uint8Array.from(timelocks),
      });
      await escrow.methods
        .captureSpl(pid, new BN(amountRaw.toString()), feeBps, timelocks)
        .accounts({
          config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
          authority: txAuthority.publicKey,
          owner: payer.publicKey,
          payerToken: payerAta,
          mint,
          funder: txAuthority.publicKey,
          vaultToken: vaultAta,
          ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          merchant: merchantWallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([txAuthority])
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ed25519PreInstruction(Buffer.from(authMsg), noderailsAuth),
        ])
        .rpc();

      const vaultAcc = await getAccount(provider.connection, vaultAta, undefined, TOKEN_PROGRAM_ID);
      expect(vaultAcc.amount).to.equal(1_000_000n);
    });

    describe('compute budget (local simulation)', () => {
      before(async () => {
        const cfg = PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0];
        const info = await provider.connection.getAccountInfo(cfg);
        if (info != null) return;
        await escrow.methods
          .initialize(
            feeRecipient.publicKey,
            [txAuthority.publicKey],
            [noderailsAuth.publicKey],
          )
          .accounts({
            payer: payer.publicKey,
            superAdmin: superAdmin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([payer, superAdmin])
          .rpc();
      });

      it('captureNative: simulated CU stays within protocol 1.4M cap', async () => {
        const consumed = await measureCaptureNativeCu(escrow, provider, {
          payer,
          merchant: merchantWallet.publicKey,
          noderailsAuth,
          lamports: 2_000_000n,
          feeBps: 100,
        });
        expect(consumed).to.be.greaterThan(0);
        assertWithinProtocolComputeBudget(consumed, 'captureNative(measured)');
      });

      it('native settle / refund / resolve: simulated CU stays under lifecycle ceiling', async () => {
        const intent = Keypair.generate();
        const pid = Array.from(intent.publicKey.toBytes());
        const nowClock = await getClockUnix(provider.connection);
        const captureLocks = packTimelocksBytes(nowClock, 0, 0);
        const lamports = 800_000n;
        const feeBps = 50;
        const msg = buildCaptureNativeAuthMessage({
          paymentIntentId: Uint8Array.from(pid),
          merchant: merchantWallet.publicKey,
          amount: lamports,
          feeBps,
          timelocks: Uint8Array.from(captureLocks),
        });

        await escrow.methods
          .captureNative(pid, new BN(lamports.toString()), feeBps, captureLocks)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            payer: payer.publicKey,
            merchant: merchantWallet.publicKey,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .signers([payer])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_NATIVE_CAPTURE_CU_LIMIT }),
            ed25519PreInstruction(Buffer.from(msg), noderailsAuth),
          ])
          .rpc();

        const settleTx = await escrow.methods
          .settleNative(pid)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            authority: merchantWallet.publicKey,
            merchantRecipient: merchantWallet.publicKey,
            feeRecipient: feeRecipient.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([merchantWallet])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const settleCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          settleTx,
          [merchantWallet],
          'settleNative',
        );
        assertWithinProtocolComputeBudget(settleCu, 'settleNative');

        const intent2 = Keypair.generate();
        const pid2 = Array.from(intent2.publicKey.toBytes());
        const refundLocks = packTimelocksBytes(nowClock, 0, 86_400);
        const msg2 = buildCaptureNativeAuthMessage({
          paymentIntentId: Uint8Array.from(pid2),
          merchant: merchantWallet.publicKey,
          amount: lamports,
          feeBps,
          timelocks: Uint8Array.from(refundLocks),
        });

        await escrow.methods
          .captureNative(pid2, new BN(lamports.toString()), feeBps, refundLocks)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            payer: payer.publicKey,
            merchant: merchantWallet.publicKey,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .signers([payer])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_NATIVE_CAPTURE_CU_LIMIT }),
            ed25519PreInstruction(Buffer.from(msg2), noderailsAuth),
          ])
          .rpc();

        const refundTx = await escrow.methods
          .refundNative(pid2)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            authority: txAuthority.publicKey,
            payerRecipient: payer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const refundCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          refundTx,
          [txAuthority],
          'refundNative',
        );
        assertWithinProtocolComputeBudget(refundCu, 'refundNative');

        const intent3 = Keypair.generate();
        const pid3 = Array.from(intent3.publicKey.toBytes());
        const disputeLocks = packTimelocksBytes(nowClock, 0, 500);
        const msg3 = buildCaptureNativeAuthMessage({
          paymentIntentId: Uint8Array.from(pid3),
          merchant: merchantWallet.publicKey,
          amount: lamports,
          feeBps,
          timelocks: Uint8Array.from(disputeLocks),
        });
        await escrow.methods
          .captureNative(pid3, new BN(lamports.toString()), feeBps, disputeLocks)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            payer: payer.publicKey,
            merchant: merchantWallet.publicKey,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .signers([payer])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_NATIVE_CAPTURE_CU_LIMIT }),
            ed25519PreInstruction(Buffer.from(msg3), noderailsAuth),
          ])
          .rpc();

        const disputeSimTx = await escrow.methods
          .initiateDispute(pid3)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            authority: txAuthority.publicKey,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const disputeCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          disputeSimTx,
          [txAuthority],
          'initiateDispute(native)',
        );
        assertWithinProtocolComputeBudget(disputeCu, 'initiateDispute(native)');

        await escrow.methods
          .initiateDispute(pid3)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            authority: txAuthority.publicKey,
          })
          .signers([txAuthority])
          .rpc();

        const resolveTx = await escrow.methods
          .resolveDisputeNative(pid3, merchantWallet.publicKey)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            authority: txAuthority.publicKey,
            merchantRecipient: merchantWallet.publicKey,
            payerRecipient: payer.publicKey,
            feeRecipient: feeRecipient.publicKey,
            closeReceiver: merchantWallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const resolveCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          resolveTx,
          [txAuthority],
          'resolveDisputeNative',
        );
        assertWithinProtocolComputeBudget(resolveCu, 'resolveDisputeNative');
      });

      it('captureSpl: simulated CU stays within protocol 1.4M cap', async () => {
        const mintKp = Keypair.generate();
        const decimals = 6;
        await createMint(
          provider.connection,
          payer,
          payer.publicKey,
          null,
          decimals,
          mintKp,
          undefined,
          TOKEN_PROGRAM_ID,
        );
        const mint = mintKp.publicKey;
        const payerAta = getAssociatedTokenAddressSync(
          mint,
          payer.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        try {
          await getAccount(provider.connection, payerAta, 'confirmed', TOKEN_PROGRAM_ID);
        } catch {
          const ix = createAssociatedTokenAccountInstruction(
            payer.publicKey,
            payerAta,
            payer.publicKey,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          );
          await provider.sendAndConfirm(new Transaction().add(ix), [payer]);
        }

        await mintTo(
          provider.connection,
          payer,
          mint,
          payerAta,
          payer,
          10_000_000n,
          undefined,
          undefined,
          TOKEN_PROGRAM_ID,
        );

        const escrowAuth = escrowAuthorityPda(escrow.programId);
        const vaultAta = getAssociatedTokenAddressSync(
          mint,
          escrowAuth,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        const createVaultIx = createAssociatedTokenAccountInstruction(
          payer.publicKey,
          vaultAta,
          escrowAuth,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        await provider.sendAndConfirm(new Transaction().add(createVaultIx), [payer]);

        const delIx = createApproveInstruction(
          payerAta,
          escrowAuth,
          payer.publicKey,
          5_000_000n,
          [],
          TOKEN_PROGRAM_ID,
        );
        await provider.sendAndConfirm(new Transaction().add(delIx), [payer]);

        const intent = Keypair.generate();
        const pid = Array.from(intent.publicKey.toBytes());
        const nowClock = await getClockUnix(provider.connection);
        const timelocks = packTimelocksBytes(nowClock, 0, 0);
        const amountRaw = 1_000_000n;
        const feeBps = 100;
        const authMsg = buildCaptureSplAuthMessage({
          paymentIntentId: Uint8Array.from(pid),
          merchant: merchantWallet.publicKey,
          mint,
          amount: amountRaw,
          feeBps,
          timelocks: Uint8Array.from(timelocks),
        });
        const tx = await escrow.methods
          .captureSpl(pid, new BN(amountRaw.toString()), feeBps, timelocks)
          .accounts({
            config: PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0],
            authority: txAuthority.publicKey,
            owner: payer.publicKey,
            payerToken: payerAta,
            mint,
            funder: txAuthority.publicKey,
            vaultToken: vaultAta,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            merchant: merchantWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SPL_CAPTURE_CU_LIMIT }),
            ed25519PreInstruction(Buffer.from(authMsg), noderailsAuth),
          ])
          .transaction();

        const consumed = await simulateSignedTxUnitsConsumed(
          provider.connection,
          tx,
          [txAuthority],
          'captureSpl(measured)',
        );
        expect(consumed).to.be.greaterThan(0);
        assertWithinProtocolComputeBudget(consumed, 'captureSpl(measured)');
      });

      it('spl settle / refund / resolve: simulated CU stays within protocol 1.4M cap', async function () {
        this.timeout(180_000);
        const cfg = PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0];
        const escrowAuth = escrowAuthorityPda(escrow.programId);

        const mintKp = Keypair.generate();
        const decimals = 6;
        await createMint(
          provider.connection,
          payer,
          payer.publicKey,
          null,
          decimals,
          mintKp,
          undefined,
          TOKEN_PROGRAM_ID,
        );
        const mint = mintKp.publicKey;
        const payerAta = getAssociatedTokenAddressSync(
          mint,
          payer.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        try {
          await getAccount(provider.connection, payerAta, 'confirmed', TOKEN_PROGRAM_ID);
        } catch {
          await provider.sendAndConfirm(
            new Transaction().add(
              createAssociatedTokenAccountInstruction(
                payer.publicKey,
                payerAta,
                payer.publicKey,
                mint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
              ),
            ),
            [payer],
          );
        }

        await mintTo(
          provider.connection,
          payer,
          mint,
          payerAta,
          payer,
          100_000_000n,
          undefined,
          undefined,
          TOKEN_PROGRAM_ID,
        );

        const vaultAta = getAssociatedTokenAddressSync(
          mint,
          escrowAuth,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        await provider.sendAndConfirm(
          new Transaction().add(
            createAssociatedTokenAccountInstruction(
              payer.publicKey,
              vaultAta,
              escrowAuth,
              mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID,
            ),
          ),
          [payer],
        );

        await provider.sendAndConfirm(
          new Transaction().add(
            createApproveInstruction(payerAta, escrowAuth, payer.publicKey, 50_000_000n, [], TOKEN_PROGRAM_ID),
          ),
          [payer],
        );

        const merchantAta = getAssociatedTokenAddressSync(
          mint,
          merchantWallet.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        const feeAta = getAssociatedTokenAddressSync(
          mint,
          feeRecipient.publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        for (const [ata, owner] of [
          [merchantAta, merchantWallet.publicKey],
          [feeAta, feeRecipient.publicKey],
        ] as const) {
          try {
            await getAccount(provider.connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
          } catch {
            await provider.sendAndConfirm(
              new Transaction().add(
                createAssociatedTokenAccountInstruction(
                  payer.publicKey,
                  ata,
                  owner,
                  mint,
                  TOKEN_PROGRAM_ID,
                  ASSOCIATED_TOKEN_PROGRAM_ID,
                ),
              ),
              [payer],
            );
          }
        }

        const nowClock = await getClockUnix(provider.connection);
        const amountRaw = 1_000_000n;
        const feeBps = 100;

        const intent1 = Keypair.generate();
        const pid1 = Array.from(intent1.publicKey.toBytes());
        const locks1 = packTimelocksBytes(nowClock, 0, 0);
        const authMsg1 = buildCaptureSplAuthMessage({
          paymentIntentId: Uint8Array.from(pid1),
          merchant: merchantWallet.publicKey,
          mint,
          amount: amountRaw,
          feeBps,
          timelocks: Uint8Array.from(locks1),
        });
        await escrow.methods
          .captureSpl(pid1, new BN(amountRaw.toString()), feeBps, locks1)
          .accounts({
            config: cfg,
            authority: txAuthority.publicKey,
            owner: payer.publicKey,
            payerToken: payerAta,
            mint,
            funder: txAuthority.publicKey,
            vaultToken: vaultAta,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            merchant: merchantWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
            ed25519PreInstruction(Buffer.from(authMsg1), noderailsAuth),
          ])
          .rpc();

        const settleTx = await escrow.methods
          .settleSpl(pid1)
          .accounts({
            config: cfg,
            authority: merchantWallet.publicKey,
            mint,
            vaultToken: vaultAta,
            merchantToken: merchantAta,
            feeToken: feeAta,
            escrowAuthority: escrowAuth,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([merchantWallet])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const settleSplCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          settleTx,
          [merchantWallet],
          'settleSpl',
        );
        assertWithinProtocolComputeBudget(settleSplCu, 'settleSpl');

        const intent2 = Keypair.generate();
        const pid2 = Array.from(intent2.publicKey.toBytes());
        const locks2 = packTimelocksBytes(nowClock, 0, 86_400);
        const authMsg2 = buildCaptureSplAuthMessage({
          paymentIntentId: Uint8Array.from(pid2),
          merchant: merchantWallet.publicKey,
          mint,
          amount: amountRaw,
          feeBps,
          timelocks: Uint8Array.from(locks2),
        });
        await escrow.methods
          .captureSpl(pid2, new BN(amountRaw.toString()), feeBps, locks2)
          .accounts({
            config: cfg,
            authority: txAuthority.publicKey,
            owner: payer.publicKey,
            payerToken: payerAta,
            mint,
            funder: txAuthority.publicKey,
            vaultToken: vaultAta,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            merchant: merchantWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
            ed25519PreInstruction(Buffer.from(authMsg2), noderailsAuth),
          ])
          .rpc();

        const refundTx = await escrow.methods
          .refundSpl(pid2)
          .accounts({
            config: cfg,
            authority: txAuthority.publicKey,
            mint,
            vaultToken: vaultAta,
            payerToken: payerAta,
            escrowAuthority: escrowAuth,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const refundSplCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          refundTx,
          [txAuthority],
          'refundSpl',
        );
        assertWithinProtocolComputeBudget(refundSplCu, 'refundSpl');

        const intent3 = Keypair.generate();
        const pid3 = Array.from(intent3.publicKey.toBytes());
        const locks3 = packTimelocksBytes(nowClock, 0, 500);
        const authMsg3 = buildCaptureSplAuthMessage({
          paymentIntentId: Uint8Array.from(pid3),
          merchant: merchantWallet.publicKey,
          mint,
          amount: amountRaw,
          feeBps,
          timelocks: Uint8Array.from(locks3),
        });
        await escrow.methods
          .captureSpl(pid3, new BN(amountRaw.toString()), feeBps, locks3)
          .accounts({
            config: cfg,
            authority: txAuthority.publicKey,
            owner: payer.publicKey,
            payerToken: payerAta,
            mint,
            funder: txAuthority.publicKey,
            vaultToken: vaultAta,
            ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            merchant: merchantWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
            ed25519PreInstruction(Buffer.from(authMsg3), noderailsAuth),
          ])
          .rpc();

        const disputeSplSimTx = await escrow.methods
          .initiateDispute(pid3)
          .accounts({
            config: cfg,
            authority: txAuthority.publicKey,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const disputeSplCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          disputeSplSimTx,
          [txAuthority],
          'initiateDispute(spl)',
        );
        assertWithinProtocolComputeBudget(disputeSplCu, 'initiateDispute(spl)');

        await escrow.methods
          .initiateDispute(pid3)
          .accounts({
            config: cfg,
            authority: txAuthority.publicKey,
          })
          .signers([txAuthority])
          .rpc();

        const resolveSplTx = await escrow.methods
          .resolveDisputeSpl(pid3, merchantWallet.publicKey)
          .accounts({
            config: cfg,
            authority: txAuthority.publicKey,
            mint,
            vaultToken: vaultAta,
            merchantToken: merchantAta,
            payerToken: payerAta,
            feeToken: feeAta,
            escrowAuthority: escrowAuth,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([txAuthority])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU }),
          ])
          .transaction();
        const resolveSplCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          resolveSplTx,
          [txAuthority],
          'resolveDisputeSpl',
        );
        assertWithinProtocolComputeBudget(resolveSplCu, 'resolveDisputeSpl');
      });

      it('super-admin config operations (simulate): CU stays within protocol 1.4M cap', async () => {
        const cfg = PublicKey.findProgramAddressSync([Buffer.from('cfg')], escrow.programId)[0];
        const cuBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: SOLANA_TX_MAX_CU });

        const setFeeTx = await escrow.methods
          .setFeeRecipient(Keypair.generate().publicKey)
          .accounts({ superAdmin: superAdmin.publicKey, config: cfg })
          .signers([superAdmin])
          .preInstructions([cuBudget])
          .transaction();
        const setFeeCu = await simulateSignedTxUnitsConsumed(
          provider.connection,
          setFeeTx,
          [superAdmin],
          'setFeeRecipient',
        );
        assertWithinProtocolComputeBudget(setFeeCu, 'setFeeRecipient');

        const setAuthTx = await escrow.methods
          .setTransactionAuthorities([txAuthority.publicKey])
          .accounts({ superAdmin: superAdmin.publicKey, config: cfg })
          .signers([superAdmin])
          .preInstructions([cuBudget])
          .transaction();
        assertWithinProtocolComputeBudget(
          await simulateSignedTxUnitsConsumed(provider.connection, setAuthTx, [superAdmin], 'setTransactionAuthorities'),
          'setTransactionAuthorities',
        );

        const setNoderailsTx = await escrow.methods
          .setAuthorizedNoderailsKeys([noderailsAuth.publicKey])
          .accounts({ superAdmin: superAdmin.publicKey, config: cfg })
          .signers([superAdmin])
          .preInstructions([cuBudget])
          .transaction();
        assertWithinProtocolComputeBudget(
          await simulateSignedTxUnitsConsumed(provider.connection, setNoderailsTx, [superAdmin], 'setAuthorizedNoderailsKeys'),
          'setAuthorizedNoderailsKeys',
        );

        const pauseTx = await escrow.methods
          .pause()
          .accounts({ superAdmin: superAdmin.publicKey, config: cfg })
          .signers([superAdmin])
          .preInstructions([cuBudget])
          .transaction();
        assertWithinProtocolComputeBudget(
          await simulateSignedTxUnitsConsumed(provider.connection, pauseTx, [superAdmin], 'pause'),
          'pause',
        );

        const unpauseTx = await escrow.methods
          .unpause()
          .accounts({ superAdmin: superAdmin.publicKey, config: cfg })
          .signers([superAdmin])
          .preInstructions([cuBudget])
          .transaction();
        assertWithinProtocolComputeBudget(
          await simulateSignedTxUnitsConsumed(provider.connection, unpauseTx, [superAdmin], 'unpause'),
          'unpause',
        );

        const fullStopTx = await escrow.methods
          .fullStop()
          .accounts({ superAdmin: superAdmin.publicKey, config: cfg })
          .signers([superAdmin])
          .transaction();
        const liftTx = await escrow.methods
          .liftFullStop()
          .accounts({ superAdmin: superAdmin.publicKey, config: cfg })
          .signers([superAdmin])
          .transaction();
        const stopLiftCombo = new Transaction().add(cuBudget);
        for (const ix of fullStopTx.instructions) stopLiftCombo.add(ix);
        for (const ix of liftTx.instructions) stopLiftCombo.add(ix);
        assertWithinProtocolComputeBudget(
          await simulateSignedTxUnitsConsumed(
            provider.connection,
            stopLiftCombo,
            [superAdmin],
            'fullStop+liftFullStop',
          ),
          'fullStop+liftFullStop',
        );
      });
    });
  });

  describe('noderails_merchant_manager', () => {
    it('initializes', async () => {
      const mmPayer = Keypair.generate();
      const mmSuper = Keypair.generate();
      const mmFirstAdmin = Keypair.generate();
      await ensureSol(provider.connection, mmPayer.publicKey);
      await ensureSol(provider.connection, mmSuper.publicKey);
      await ensureSol(provider.connection, mmFirstAdmin.publicKey);

      await merchant.methods
        .initialize()
        .accounts({
          payer: mmPayer.publicKey,
          superAdmin: mmSuper.publicKey,
          firstAdmin: mmFirstAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([mmPayer, mmSuper, mmFirstAdmin])
        .rpc();
    });
  });
});
