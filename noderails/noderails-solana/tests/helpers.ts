import * as anchor from '@anchor-lang/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connection, Signer } from '@solana/web3.js';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
} from '@solana/web3.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/** One legacy Solana transaction cannot consume more than this many CUs (mainnet / local test validator). */
export const SOLANA_PROTOCOL_MAX_COMPUTE_UNITS = 1_400_000 as const;

export function assertWithinProtocolComputeBudget(
  unitsConsumed: number,
  context = 'transaction',
): void {
  if (unitsConsumed > SOLANA_PROTOCOL_MAX_COMPUTE_UNITS) {
    throw new Error(
      `${context}: ${unitsConsumed} CU exceeds protocol max ${SOLANA_PROTOCOL_MAX_COMPUTE_UNITS}`,
    );
  }
}

export function loadProgram(
  provider: anchor.AnchorProvider,
  crate: 'noderails_escrow' | 'noderails_merchant_manager',
): anchor.Program {
  const idlPath = path.join(ROOT, 'target', 'idl', `${crate}.json`);
  const kpPath = path.join(ROOT, 'target', 'deploy', `${crate}-keypair.json`);
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8'))),
  );
  idl.address = kp.publicKey.toBase58();
  return new anchor.Program(idl, provider);
}

export async function getClockUnix(connection: Connection): Promise<number> {
  const acc = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  if (!acc?.data) throw new Error('missing clock sysvar');
  return Number(acc.data.readBigInt64LE(32));
}

/** Timelocks uint256 as 32-byte big-endian buffer (matches on-chain `U256::from_big_endian`). */
export function packTimelocksBytes(
  capturedAt: number,
  disputeStartSeconds: number,
  settlementSeconds: number,
): number[] {
  const bi =
    (BigInt(capturedAt) << 224n) |
    (BigInt(settlementSeconds) << 64n) |
    (BigInt(disputeStartSeconds) << 32n);
  const h = bi.toString(16).padStart(64, '0');
  return [...Buffer.from(h, 'hex')];
}

export async function ensureSol(
  connection: Connection,
  pub: PublicKey,
  sol = 25,
): Promise<void> {
  const bal = await connection.getBalance(pub);
  if (bal >= sol * LAMPORTS_PER_SOL) return;
  const sig = await connection.requestAirdrop(pub, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
}

/**
 * Simulate a legacy `Transaction` and return compute units consumed.
 * Passes `signers` into `Connection.simulateTransaction` so the connection can
 * refresh `recentBlockhash` and sign (required web3.js API for `Transaction`).
 * Include `ComputeBudgetProgram.setComputeUnitLimit` when consumption may exceed ~200k.
 */
export async function simulateSignedTxUnitsConsumed(
  connection: Connection,
  tx: Transaction,
  signers: Signer[],
  label = 'tx',
): Promise<number> {
  if (!tx.feePayer && signers.length > 0) {
    tx.feePayer = signers[0].publicKey;
  }
  const sim = await connection.simulateTransaction(tx, signers, false);
  if (sim.value.err) {
    const logs = sim.value.logs?.join('\n') ?? '';
    throw new Error(
      `Simulation failed (${label}): ${JSON.stringify(sim.value.err)}\n${logs}`,
    );
  }
  const units = sim.value.unitsConsumed;
  if (units == null) {
    throw new Error(`Simulation returned no unitsConsumed (${label})`);
  }
  return units;
}
