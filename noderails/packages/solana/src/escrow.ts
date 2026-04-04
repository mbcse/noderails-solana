import { createHash } from 'node:crypto';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, TransactionInstruction } from '@solana/web3.js';

/** First 8 bytes of sha256("global:${ixName}") — Anchor instruction discriminator. */
export function anchorInstructionDiscriminator(ixName: string): Buffer {
  return createHash('sha256').update(`global:${ixName}`).digest().subarray(0, 8);
}

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n, 0);
  return b;
}

function u16LE(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

/** Solana native Ed25519 signature-check program (tx must include this ix before `capture_*`). */
export const ED25519_PROGRAM_ID = new PublicKey('Ed25519SigVerify111111111111111111111111111');

/**
 * Build an Ed25519 verify instruction (single sig, data self-contained — matches
 * `solana_sdk::ed25519_instruction::new_ed25519_instruction`).
 */
export function ed25519VerifyInstruction(params: {
  publicKey: PublicKey;
  message: Buffer;
  signature: Buffer;
}): TransactionInstruction {
  if (params.signature.length !== 64) {
    throw new Error('ed25519 signature must be 64 bytes');
  }
  const dataStart = 16;
  const publicKeyOffset = dataStart;
  const signatureOffset = publicKeyOffset + 32;
  const messageOffset = signatureOffset + 64;
  const messageSize = params.message.length;
  if (messageSize > 65535) {
    throw new Error('ed25519 message too large for u16 size field');
  }
  const ixIndexSelf = 65535;
  const offsets = Buffer.alloc(14);
  offsets.writeUInt16LE(signatureOffset, 0);
  offsets.writeUInt16LE(ixIndexSelf, 2);
  offsets.writeUInt16LE(publicKeyOffset, 4);
  offsets.writeUInt16LE(ixIndexSelf, 6);
  offsets.writeUInt16LE(messageOffset, 8);
  offsets.writeUInt16LE(messageSize, 10);
  offsets.writeUInt16LE(ixIndexSelf, 12);

  const header = Buffer.from([1, 0]);
  const body = Buffer.concat([params.publicKey.toBuffer(), params.signature, params.message]);
  if (publicKeyOffset !== 16) {
    throw new Error('ed25519 ix layout');
  }
  const data = Buffer.concat([header, offsets, body]);
  return new TransactionInstruction({
    programId: ED25519_PROGRAM_ID,
    keys: [],
    data,
  });
}

export function paymentVaultPdas(programId: PublicKey, paymentIntentId: Uint8Array): {
  payment: PublicKey;
  vault: PublicKey;
} {
  const [payment] = PublicKey.findProgramAddressSync(
    [Buffer.from('pay', 'utf8'), Buffer.from(paymentIntentId)],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vlm', 'utf8'), Buffer.from(paymentIntentId)],
    programId,
  );
  return { payment, vault };
}

export function escrowAuthorityPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('escrow_auth', 'utf8')], programId);
  return pda;
}

export function payerSplAta(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);
}

export function vaultSplAta(
  mint: PublicKey,
  programId: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  const escrowAuth = escrowAuthorityPda(programId);
  return getAssociatedTokenAddressSync(
    mint,
    escrowAuth,
    true,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/** Re-export for callers resolving mint program id (classic vs Token-2022). */
export { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID };

/** Canonical bytes MTXM must sign for `capture_spl` authorization. */
export function buildCaptureSplAuthMessage(params: {
  paymentIntentId: Uint8Array;
  merchant: PublicKey;
  mint: PublicKey;
  amount: bigint;
  feeBps: number;
  timelocks: Uint8Array;
}): Buffer {
  if (params.paymentIntentId.length !== 32 || params.timelocks.length !== 32) {
    throw new Error('paymentIntentId and timelocks must be 32 bytes');
  }
  return Buffer.concat([
    Buffer.from('NodeRailsEscrow::CaptureSpl:v1', 'utf8'),
    Buffer.from(params.paymentIntentId),
    Buffer.from(params.merchant.toBytes()),
    Buffer.from(params.mint.toBytes()),
    u64LE(params.amount),
    u16LE(params.feeBps),
    Buffer.from(params.timelocks),
  ]);
}

export function encodeCaptureSplInstructionData(params: {
  paymentIntentId: Uint8Array;
  amount: bigint;
  feeBps: number;
  timelocks: Uint8Array;
}): Buffer {
  if (params.paymentIntentId.length !== 32 || params.timelocks.length !== 32) {
    throw new Error('paymentIntentId and timelocks must be 32 bytes');
  }
  const disc = anchorInstructionDiscriminator('capture_spl');
  const body = Buffer.concat([
    Buffer.from(params.paymentIntentId),
    u64LE(params.amount),
    u16LE(params.feeBps),
    Buffer.from(params.timelocks),
  ]);
  return Buffer.concat([disc, body]);
}

export function captureSplInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  funder: PublicKey;
  owner: PublicKey;
  payerToken: PublicKey;
  mint: PublicKey;
  merchant: PublicKey;
  paymentIntentId: Uint8Array;
  data: Buffer;
  /** SPL Token or Token-2022 program id for this mint (default: classic SPL). */
  tokenProgramId?: PublicKey;
}): TransactionInstruction {
  const tokenProgram = params.tokenProgramId ?? TOKEN_PROGRAM_ID;
  const cfg = escrowConfigPda(params.programId);
  const { payment } = paymentVaultPdas(params.programId, params.paymentIntentId);
  const escrowAuth = escrowAuthorityPda(params.programId);
  const vaultAta = vaultSplAta(params.mint, params.programId, tokenProgram);

  return new TransactionInstruction({
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.owner, isSigner: false, isWritable: false },
      { pubkey: params.payerToken, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: payment, isSigner: false, isWritable: true },
      { pubkey: params.funder, isSigner: true, isWritable: true },
      { pubkey: escrowAuth, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: params.merchant, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: params.programId,
    data: Buffer.from(params.data),
  });
}

export function encodeSettleSplInstructionData(paymentIntentId: Uint8Array): Buffer {
  if (paymentIntentId.length !== 32) throw new Error('paymentIntentId must be 32 bytes');
  return Buffer.concat([anchorInstructionDiscriminator('settle_spl'), Buffer.from(paymentIntentId)]);
}

export function settleSplInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  paymentIntentId: Uint8Array;
  mint: PublicKey;
  merchantRecipient: PublicKey;
  feeRecipient: PublicKey;
  tokenProgramId?: PublicKey;
}): TransactionInstruction {
  const tokenProgram = params.tokenProgramId ?? TOKEN_PROGRAM_ID;
  const cfg = escrowConfigPda(params.programId);
  const { payment } = paymentVaultPdas(params.programId, params.paymentIntentId);
  const escrowAuth = escrowAuthorityPda(params.programId);
  const vaultAta = vaultSplAta(params.mint, params.programId, tokenProgram);
  const merchantToken = getAssociatedTokenAddressSync(
    params.mint,
    params.merchantRecipient,
    false,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const feeToken = getAssociatedTokenAddressSync(
    params.mint,
    params.feeRecipient,
    false,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  return new TransactionInstruction({
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: payment, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: merchantToken, isSigner: false, isWritable: true },
      { pubkey: feeToken, isSigner: false, isWritable: true },
      { pubkey: escrowAuth, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    programId: params.programId,
    data: encodeSettleSplInstructionData(params.paymentIntentId),
  });
}

export function refundSplInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  paymentIntentId: Uint8Array;
  mint: PublicKey;
  payerOwner: PublicKey;
  tokenProgramId?: PublicKey;
}): TransactionInstruction {
  const tokenProgram = params.tokenProgramId ?? TOKEN_PROGRAM_ID;
  const cfg = escrowConfigPda(params.programId);
  const { payment } = paymentVaultPdas(params.programId, params.paymentIntentId);
  const escrowAuth = escrowAuthorityPda(params.programId);
  const vaultAta = vaultSplAta(params.mint, params.programId, tokenProgram);
  const payerToken = payerSplAta(params.mint, params.payerOwner, tokenProgram);

  return new TransactionInstruction({
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: payment, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: payerToken, isSigner: false, isWritable: true },
      { pubkey: escrowAuth, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    programId: params.programId,
    data: Buffer.concat([anchorInstructionDiscriminator('refund_spl'), Buffer.from(params.paymentIntentId)]),
  });
}

export function encodeResolveDisputeSplData(paymentIntentId: Uint8Array, winner: PublicKey): Buffer {
  if (paymentIntentId.length !== 32) throw new Error('paymentIntentId must be 32 bytes');
  return Buffer.concat([
    anchorInstructionDiscriminator('resolve_dispute_spl'),
    Buffer.from(paymentIntentId),
    winner.toBuffer(),
  ]);
}

export function resolveDisputeSplInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  paymentIntentId: Uint8Array;
  mint: PublicKey;
  merchantRecipient: PublicKey;
  payerOwner: PublicKey;
  feeRecipient: PublicKey;
  winner: PublicKey;
  tokenProgramId?: PublicKey;
}): TransactionInstruction {
  const tokenProgram = params.tokenProgramId ?? TOKEN_PROGRAM_ID;
  const cfg = escrowConfigPda(params.programId);
  const { payment } = paymentVaultPdas(params.programId, params.paymentIntentId);
  const escrowAuth = escrowAuthorityPda(params.programId);
  const vaultAta = vaultSplAta(params.mint, params.programId, tokenProgram);
  const merchantToken = getAssociatedTokenAddressSync(
    params.mint,
    params.merchantRecipient,
    false,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const payerToken = payerSplAta(params.mint, params.payerOwner, tokenProgram);
  const feeToken = getAssociatedTokenAddressSync(
    params.mint,
    params.feeRecipient,
    false,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  return new TransactionInstruction({
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: payment, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: merchantToken, isSigner: false, isWritable: true },
      { pubkey: payerToken, isSigner: false, isWritable: true },
      { pubkey: feeToken, isSigner: false, isWritable: true },
      { pubkey: escrowAuth, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    programId: params.programId,
    data: encodeResolveDisputeSplData(params.paymentIntentId, params.winner),
  });
}

/** Canonical bytes MTXM must sign for `capture_native` authorization. */
export function buildCaptureNativeAuthMessage(params: {
  paymentIntentId: Uint8Array;
  merchant: PublicKey;
  amount: bigint;
  feeBps: number;
  timelocks: Uint8Array;
}): Buffer {
  if (params.paymentIntentId.length !== 32 || params.timelocks.length !== 32) {
    throw new Error('paymentIntentId and timelocks must be 32 bytes');
  }
  return Buffer.concat([
    Buffer.from('NodeRailsEscrow::CaptureNative:v1', 'utf8'),
    Buffer.from(params.paymentIntentId),
    Buffer.from(params.merchant.toBytes()),
    u64LE(params.amount),
    u16LE(params.feeBps),
    Buffer.from(params.timelocks),
  ]);
}

export function encodeCaptureNativeInstructionData(params: {
  paymentIntentId: Uint8Array;
  amount: bigint;
  feeBps: number;
  timelocks: Uint8Array;
}): Buffer {
  if (params.paymentIntentId.length !== 32 || params.timelocks.length !== 32) {
    throw new Error('paymentIntentId and timelocks must be 32 bytes');
  }
  const disc = anchorInstructionDiscriminator('capture_native');
  const body = Buffer.concat([
    Buffer.from(params.paymentIntentId),
    u64LE(params.amount),
    u16LE(params.feeBps),
    Buffer.from(params.timelocks),
  ]);
  return Buffer.concat([disc, body]);
}

export function captureNativeInstruction(params: {
  programId: PublicKey;
  payer: PublicKey;
  merchant: PublicKey;
  paymentIntentId: Uint8Array;
  data: Buffer;
}): TransactionInstruction {
  const [cfg] = PublicKey.findProgramAddressSync([Buffer.from('cfg', 'utf8')], params.programId);
  const { payment, vault } = paymentVaultPdas(params.programId, params.paymentIntentId);

  const keys = [
    { pubkey: cfg, isSigner: false, isWritable: false },
    { pubkey: params.payer, isSigner: true, isWritable: true },
    { pubkey: params.merchant, isSigner: false, isWritable: false },
    { pubkey: payment, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: params.programId,
    data: Buffer.from(params.data),
  });
}

export function escrowConfigPda(programId: PublicKey): PublicKey {
  const [cfg] = PublicKey.findProgramAddressSync([Buffer.from('cfg', 'utf8')], programId);
  return cfg;
}

/** First account field after 8-byte Anchor account discriminator (fee_recipient). */
export function parseEscrowConfigFeeRecipient(accountData: Uint8Array): PublicKey {
  if (accountData.length < 8 + 32) {
    throw new Error('Invalid escrow config account data');
  }
  return new PublicKey(accountData.subarray(8, 40));
}

export function encodeSettleNativeInstructionData(paymentIntentId: Uint8Array): Buffer {
  if (paymentIntentId.length !== 32) throw new Error('paymentIntentId must be 32 bytes');
  return Buffer.concat([anchorInstructionDiscriminator('settle_native'), Buffer.from(paymentIntentId)]);
}

export function settleNativeInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  paymentIntentId: Uint8Array;
  merchantRecipient: PublicKey;
  feeRecipient: PublicKey;
}): TransactionInstruction {
  const cfg = escrowConfigPda(params.programId);
  const { payment, vault } = paymentVaultPdas(params.programId, params.paymentIntentId);
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: payment, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.merchantRecipient, isSigner: false, isWritable: true },
      { pubkey: params.feeRecipient, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeSettleNativeInstructionData(params.paymentIntentId),
  });
}

export function initiateDisputeInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  paymentIntentId: Uint8Array;
}): TransactionInstruction {
  const cfg = escrowConfigPda(params.programId);
  const { payment } = paymentVaultPdas(params.programId, params.paymentIntentId);
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: payment, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([anchorInstructionDiscriminator('initiate_dispute'), Buffer.from(params.paymentIntentId)]),
  });
}

export function refundNativeInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  paymentIntentId: Uint8Array;
  payerRecipient: PublicKey;
}): TransactionInstruction {
  const cfg = escrowConfigPda(params.programId);
  const { payment, vault } = paymentVaultPdas(params.programId, params.paymentIntentId);
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: payment, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.payerRecipient, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([anchorInstructionDiscriminator('refund_native'), Buffer.from(params.paymentIntentId)]),
  });
}

export function encodeResolveDisputeNativeData(paymentIntentId: Uint8Array, winner: PublicKey): Buffer {
  if (paymentIntentId.length !== 32) throw new Error('paymentIntentId must be 32 bytes');
  return Buffer.concat([
    anchorInstructionDiscriminator('resolve_dispute_native'),
    Buffer.from(paymentIntentId),
    winner.toBuffer(),
  ]);
}

export function resolveDisputeNativeInstruction(params: {
  programId: PublicKey;
  authority: PublicKey;
  paymentIntentId: Uint8Array;
  merchantRecipient: PublicKey;
  payerRecipient: PublicKey;
  feeRecipient: PublicKey;
  winner: PublicKey;
}): TransactionInstruction {
  const cfg = escrowConfigPda(params.programId);
  const { payment, vault } = paymentVaultPdas(params.programId, params.paymentIntentId);
  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: payment, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.merchantRecipient, isSigner: false, isWritable: true },
      { pubkey: params.payerRecipient, isSigner: false, isWritable: true },
      { pubkey: params.feeRecipient, isSigner: false, isWritable: true },
      { pubkey: params.winner, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeResolveDisputeNativeData(params.paymentIntentId, params.winner),
  });
}

/** Shape expected by MTXM `solana.instructions[]` (see MTXM API: `keys`, `dataBase64`). */
export function instructionToMtxmSolana(ix: TransactionInstruction): {
  programId: string;
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  dataBase64?: string;
} {
  const data = Buffer.from(ix.data);
  const dataBase64 = data.length > 0 ? data.toString('base64') : undefined;
  return {
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((k) => ({
      pubkey: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    ...(dataBase64 ? { dataBase64 } : {}),
  };
}
