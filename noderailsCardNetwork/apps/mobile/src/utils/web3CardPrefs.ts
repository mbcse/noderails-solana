import * as SecureStore from './secureStore';
import { shortMethodLabel } from './activityLabels';

/** Mirrors WallCard-supported EIP-1193 / signer methods (demo parity). */
export const ALL_WEB3_METHODS = [
  'personal_sign',
  'eth_sign',
  'eth_signTypedData_v4',
  'eth_signTransaction',
  'eth_sendTransaction',
  'solana_signMessage',
  'solana_signTransaction'
] as const;

export type Web3MethodId = (typeof ALL_WEB3_METHODS)[number];

export type Web3CardPrefs = {
  signingEnabled: boolean;
  transactionsEnabled: boolean;
  dailyTxnLimitUsd: number;
  atmDailyLimitUsd: number;
  methodEnabled: Record<string, boolean>;
};

const STORAGE_KEY = 'wallcard_web3_card_prefs';

export function defaultWeb3CardPrefs(): Web3CardPrefs {
  const methodEnabled: Record<string, boolean> = {};
  for (const m of ALL_WEB3_METHODS) methodEnabled[m] = true;
  return {
    signingEnabled: true,
    transactionsEnabled: true,
    dailyTxnLimitUsd: 25000,
    atmDailyLimitUsd: 5000,
    methodEnabled
  };
}

export function isTransactionMethod(method: string): boolean {
  return (
    method === 'eth_sendTransaction' ||
    method === 'eth_signTransaction' ||
    method === 'solana_signTransaction'
  );
}

export async function loadWeb3CardPrefs(): Promise<Web3CardPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return defaultWeb3CardPrefs();
    const parsed = JSON.parse(raw) as Partial<Web3CardPrefs>;
    const base = defaultWeb3CardPrefs();
    const merged: Web3CardPrefs = {
      signingEnabled: typeof parsed.signingEnabled === 'boolean' ? parsed.signingEnabled : base.signingEnabled,
      transactionsEnabled:
        typeof parsed.transactionsEnabled === 'boolean' ? parsed.transactionsEnabled : base.transactionsEnabled,
      dailyTxnLimitUsd:
        typeof parsed.dailyTxnLimitUsd === 'number' && Number.isFinite(parsed.dailyTxnLimitUsd)
          ? Math.max(0, parsed.dailyTxnLimitUsd)
          : base.dailyTxnLimitUsd,
      atmDailyLimitUsd:
        typeof parsed.atmDailyLimitUsd === 'number' && Number.isFinite(parsed.atmDailyLimitUsd)
          ? Math.max(0, parsed.atmDailyLimitUsd)
          : base.atmDailyLimitUsd,
      methodEnabled: { ...base.methodEnabled, ...(parsed.methodEnabled ?? {}) }
    };
    for (const m of ALL_WEB3_METHODS) {
      if (merged.methodEnabled[m] === undefined) merged.methodEnabled[m] = true;
    }
    return merged;
  } catch {
    return defaultWeb3CardPrefs();
  }
}

export async function saveWeb3CardPrefs(prefs: Web3CardPrefs): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(prefs));
}

export function assertSigningAllowed(method: string, prefs: Web3CardPrefs): void {
  if (!prefs.signingEnabled) {
    throw new Error('Signing is turned off for this card. Switch it on from the Card tab, then try again.');
  }
  if (isTransactionMethod(method) && !prefs.transactionsEnabled) {
    throw new Error('Payments are turned off for this card. Switch them on from the Card tab, then try again.');
  }
  if (prefs.methodEnabled[method] === false) {
    throw new Error(
      `${shortMethodLabel(method)} is disabled. Open Payments & signing from the Card tab to allow it.`
    );
  }
}
