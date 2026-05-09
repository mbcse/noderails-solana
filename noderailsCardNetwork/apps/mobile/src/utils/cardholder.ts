import * as SecureStore from './secureStore';

/** Uppercase embossed-style line for card face (max ~22 chars). */
export function formatCardholderLine(primary: string | null | undefined): string {
  const t = (primary ?? '').trim();
  if (!t) return 'CARDHOLDER';
  const u = t.toUpperCase();
  return u.length > 22 ? `${u.slice(0, 19)}…` : u;
}

export async function fetchWalletProfileDisplayName(
  apiUrl: string,
  token: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  const res = await fetch(`${apiUrl}/v1/wallet/profile`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { displayName?: string | null };
  const n = body.displayName?.trim();
  return n || undefined;
}

/** Resolve embossed cardholder: local setup name first, then profile API, then email local-part. */
export async function resolveCardholderEmbossLine(apiUrl: string, signal?: AbortSignal): Promise<string> {
  const cached = await SecureStore.getItemAsync('wallcard_display_name');
  if (cached?.trim()) return formatCardholderLine(cached);

  const token = await SecureStore.getItemAsync('wallcard_auth_token');
  if (token) {
    const dn = await fetchWalletProfileDisplayName(apiUrl, token, signal);
    if (dn) return formatCardholderLine(dn);
  }

  const email = await SecureStore.getItemAsync('wallcard_user_email');
  if (email?.includes('@')) {
    const local = email.split('@')[0]?.replace(/[._]/g, ' ') ?? '';
    if (local.trim()) return formatCardholderLine(local);
  }
  return formatCardholderLine('');
}
