import type { IKeyProvider, WalletResult, SignRequest, SignResult } from '@noderails-card/crypto';
import { splitSecret2of2, combineSecret2of2 } from '@noderails-card/crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { deriveEvmPrivateKey, deriveSolanaSeed, evmAddressAlias16, solanaAddressFromSeed } from '../derive-keys.js';
import { performSign } from '../sign-operations.js';
import type { SigningMethod } from '@noderails-card/common';

type LegacyState = {
  shareA: string;  // base64
  shareB: string;  // base64
  evmAddress: string;
  solanaAddress: string;
};

/** Persisted so signer-host restarts do not lose legacy wallets (dev/local only — sensitive material). */
function legacyStateFilePath(): string {
  const fromEnv = process.env.LEGACY_SIGNER_STATE_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), '.legacy-signer-state.json');
}

export class LegacyKeyProvider implements IKeyProvider {
  readonly providerName = 'legacy';
  private readonly state = new Map<string, LegacyState>();
  private readonly statePath = legacyStateFilePath();

  constructor() {
    this.hydrateFromDiskSync();
  }

  private isLegacyState(v: unknown): v is LegacyState {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return (
      typeof o.shareA === 'string' &&
      typeof o.shareB === 'string' &&
      typeof o.evmAddress === 'string' &&
      typeof o.solanaAddress === 'string'
    );
  }

  private hydrateFromDiskSync(): void {
    try {
      if (!existsSync(this.statePath)) return;
      const raw = readFileSync(this.statePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== 'object' || parsed === null) return;
      let count = 0;
      for (const [userId, entry] of Object.entries(parsed)) {
        if (!this.isLegacyState(entry)) continue;
        this.state.set(userId, entry);
        count++;
      }
      if (count > 0) {
        console.log(`[legacy] loaded ${count} wallet key bundle(s) from ${this.statePath}`);
      }
    } catch (e) {
      console.warn('[legacy] could not read state file — starting empty:', e instanceof Error ? e.message : e);
    }
  }

  private persistToDiskSync(): void {
    try {
      const dir = path.dirname(this.statePath);
      mkdirSync(dir, { recursive: true });
      const payload = JSON.stringify(Object.fromEntries(this.state));
      const tmp = `${this.statePath}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
      renameSync(tmp, this.statePath);
    } catch (e) {
      console.warn('[legacy] could not persist state:', e instanceof Error ? e.message : e);
    }
  }

  async generateWallet(userId: string): Promise<WalletResult> {
    const seed = Uint8Array.from(randomBytes(32));
    const [shareA, shareB] = splitSecret2of2(seed);

    const evmPk = deriveEvmPrivateKey(seed, userId);
    const evmAccount = privateKeyToAccount(evmPk);
    const evmAddress = evmAccount.address;
    const solSeed = deriveSolanaSeed(seed, userId);
    const solanaAddress = solanaAddressFromSeed(solSeed);
    const accountAlias = evmAddressAlias16(evmAddress);

    this.state.set(userId, {
      shareA: Buffer.from(shareA).toString('base64'),
      shareB: Buffer.from(shareB).toString('base64'),
      evmAddress,
      solanaAddress,
    });
    this.persistToDiskSync();

    return {
      evmAddress,
      solanaAddress,
      evmWalletRef: userId,      // in legacy mode, walletRef IS the userId
      solanaWalletRef: userId,
      accountAlias,
    };
  }

  async sign(walletRef: string, req: SignRequest): Promise<SignResult> {
    const stored = this.state.get(walletRef);
    if (!stored) {
      throw new Error('legacy_wallet_not_found');
    }

    const shareA = Uint8Array.from(Buffer.from(stored.shareA, 'base64'));
    const shareB = Uint8Array.from(Buffer.from(stored.shareB, 'base64'));
    const master = combineSecret2of2(shareA, shareB);

    const outcome = await performSign(
      req.method as SigningMethod,
      req.payload,
      master,
      walletRef
    );

    return {
      signature: outcome.signature,
      signingOutput: outcome.signingOutput,
      providerTag: 'legacy-simulate',
    };
  }
}
