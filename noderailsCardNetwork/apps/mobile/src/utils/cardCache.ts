import * as SecureStore from './secureStore';

export const PRIMARY_CARD_CACHE_KEY = 'wallcard_primary_card';

export type CachedCard = {
  id: string;
  maskedNumber: string;
  panLastFour: string;
  expiryMonth: number;
  expiryYear: number;
  brand: string;
  status: string;
  /**
   * Full PAN digits, returned from encrypted DB field via GET /wallet/cards (auth).
   * Cached after onboarding/setup when disclosed once, then refreshed from API.
   */
  fullPanDigits?: string;
  /** CVV digits; same disclosure pattern as fullPanDigits. */
  cvvDigits?: string;
};

const LEGACY_ISSUED_KEY = 'wallcard_issued_card';

export async function loadCachedPrimaryCard(): Promise<CachedCard | null> {
  const legacy = await SecureStore.getItemAsync(LEGACY_ISSUED_KEY);
  if (legacy) {
    try {
      const migrated = JSON.parse(legacy) as CachedCard;
      await SecureStore.setItemAsync(PRIMARY_CARD_CACHE_KEY, JSON.stringify(migrated));
      await SecureStore.deleteItemAsync(LEGACY_ISSUED_KEY);
      return migrated;
    } catch {
      /* fall through */
    }
  }

  const raw = await SecureStore.getItemAsync(PRIMARY_CARD_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedCard;
  } catch {
    return null;
  }
}

export function mergePreservingFullPan(incoming: CachedCard, previous: CachedCard | null): CachedCard {
  return {
    ...incoming,
    ...(previous?.fullPanDigits && !incoming.fullPanDigits ? { fullPanDigits: previous.fullPanDigits } : {}),
    ...(previous?.cvvDigits && !incoming.cvvDigits ? { cvvDigits: previous.cvvDigits } : {})
  };
}

export async function saveCachedPrimaryCard(card: CachedCard): Promise<void> {
  const prev = await loadCachedPrimaryCard();
  const merged = mergePreservingFullPan(card, prev);
  await SecureStore.setItemAsync(PRIMARY_CARD_CACHE_KEY, JSON.stringify(merged));
}

export async function clearCachedPrimaryCard(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PRIMARY_CARD_CACHE_KEY);
  } catch {
    /* ignore */
  }
  try {
    await SecureStore.deleteItemAsync(LEGACY_ISSUED_KEY);
  } catch {
    /* ignore */
  }
}
