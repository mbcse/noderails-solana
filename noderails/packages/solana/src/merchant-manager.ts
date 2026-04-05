import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { anchorInstructionDiscriminator } from './escrow.js';

function u64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n, 0);
  return b;
}

function i64LE(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(n, 0);
  return b;
}

function vecU8(data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.length, 0);
  return Buffer.concat([len, data]);
}

/** `NodeRailsMerchantManager::Session:v1` + merchant + sessionExpiry (i64 LE) — must match on-chain verifier. */
export function buildSolanaSessionMessage(merchant: PublicKey, sessionExpiryUnix: bigint): Buffer {
  return Buffer.concat([
    Buffer.from('NodeRailsMerchantManager::Session:v1', 'utf8'),
    Buffer.from(merchant.toBytes()),
    i64LE(sessionExpiryUnix),
  ]);
}

/** Native payout auth message — must match `verify_payout_native_message` in `noderails_merchant_manager`. */
export function buildNativePayoutMessageSolana(params: {
  payoutIntentId: Uint8Array;
  merchant: PublicKey;
  recipient: PublicKey;
  amountLamports: bigint;
  nonce: Uint8Array;
}): Buffer {
  if (params.payoutIntentId.length !== 32 || params.nonce.length !== 32) {
    throw new Error('payoutIntentId and nonce must be 32 bytes');
  }
  return Buffer.concat([
    Buffer.from('NodeRailsMerchantManager::NoderailsNativePayout:v1', 'utf8'),
    Buffer.from(params.payoutIntentId),
    Buffer.from(params.merchant.toBytes()),
    Buffer.from(params.recipient.toBytes()),
    u64LE(params.amountLamports),
    Buffer.from(params.nonce),
  ]);
}

export function merchantManagerConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('mm_cfg', 'utf8')], programId);
  return pda;
}

export function merchantManagerRolePda(programId: PublicKey, authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('role', 'utf8'), authority.toBytes()],
    programId,
  );
  return pda;
}

export function merchantManagerNonceMarkerPda(programId: PublicKey, nonce: Uint8Array): PublicKey {
  if (nonce.length !== 32) throw new Error('nonce must be 32 bytes');
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('nonce', 'utf8'), Buffer.from(nonce)], programId);
  return pda;
}

export function encodeExecuteNativePayoutInstructionData(params: {
  payoutIntentId: Uint8Array;
  amountLamports: bigint;
  sessionExpiryUnix: bigint;
  nonce: Uint8Array;
  sessionMessage: Buffer;
  sessionSignature: Uint8Array;
  payoutMessage: Buffer;
  noderailsSignature: Uint8Array;
}): Buffer {
  if (params.payoutIntentId.length !== 32 || params.nonce.length !== 32) {
    throw new Error('payoutIntentId and nonce must be 32 bytes');
  }
  if (params.sessionSignature.length !== 64 || params.noderailsSignature.length !== 64) {
    throw new Error('ed25519 signatures must be 64 bytes');
  }
  const disc = anchorInstructionDiscriminator('execute_native_payout');
  const body = Buffer.concat([
    Buffer.from(params.payoutIntentId),
    u64LE(params.amountLamports),
    i64LE(params.sessionExpiryUnix),
    Buffer.from(params.nonce),
    vecU8(params.sessionMessage),
    Buffer.from(params.sessionSignature),
    vecU8(params.payoutMessage),
    Buffer.from(params.noderailsSignature),
  ]);
  return Buffer.concat([disc, body]);
}

export function executeNativePayoutInstruction(params: {
  programId: PublicKey;
  executor: PublicKey;
  merchantWallet: PublicKey;
  recipient: PublicKey;
  noderailsWallet: PublicKey;
  payer: PublicKey;
  nonce: Uint8Array;
  payoutIntentId: Uint8Array;
  amountLamports: bigint;
  sessionExpiryUnix: bigint;
  sessionMessage: Buffer;
  sessionSignature: Uint8Array;
  payoutMessage: Buffer;
  noderailsSignature: Uint8Array;
}): TransactionInstruction {
  const cfg = merchantManagerConfigPda(params.programId);
  const executorRole = merchantManagerRolePda(params.programId, params.executor);
  const noderailsRole = merchantManagerRolePda(params.programId, params.noderailsWallet);
  const nonceMarker = merchantManagerNonceMarkerPda(params.programId, params.nonce);

  const data = encodeExecuteNativePayoutInstructionData({
    payoutIntentId: params.payoutIntentId,
    amountLamports: params.amountLamports,
    sessionExpiryUnix: params.sessionExpiryUnix,
    nonce: params.nonce,
    sessionMessage: params.sessionMessage,
    sessionSignature: params.sessionSignature,
    payoutMessage: params.payoutMessage,
    noderailsSignature: params.noderailsSignature,
  });

  return new TransactionInstruction({
    programId: params.programId,
    keys: [
      { pubkey: cfg, isSigner: false, isWritable: false },
      { pubkey: params.executor, isSigner: true, isWritable: true },
      { pubkey: executorRole, isSigner: false, isWritable: false },
      { pubkey: params.merchantWallet, isSigner: false, isWritable: false },
      { pubkey: params.recipient, isSigner: false, isWritable: true },
      { pubkey: params.noderailsWallet, isSigner: false, isWritable: false },
      { pubkey: noderailsRole, isSigner: false, isWritable: false },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: nonceMarker, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
