/**
 * Dodo Payments card rail — hosted checkout sessions are created by **NodeRails API**
 * (`POST /checkout-sessions/public/:id/dodo-session`). Never put API keys in the browser.
 *
 * Enable card UI with `NEXT_PUBLIC_ENABLE_DODO_CARD=true` after configuring the server
 * (`DODO_PAYMENTS_ENABLED`, keys, product id). Use literal env reads so Next.js inlines them.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export function isDodoCardCheckoutEnabled(): boolean {
  const v = (process.env.NEXT_PUBLIC_ENABLE_DODO_CARD ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export async function createDodoCardCheckoutSession(checkoutSessionId: string): Promise<{
  checkoutUrl: string;
  dodoSessionId: string;
}> {
  const res = await fetch(
    `${API_BASE}/checkout-sessions/public/${encodeURIComponent(checkoutSessionId)}/dodo-session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    },
  );

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      typeof json === 'object' &&
      json &&
      'error' in json &&
      typeof (json as { error?: { message?: string } }).error?.message === 'string'
        ? (json as { error: { message: string } }).error.message
        : `Card checkout unavailable (${res.status})`;
    throw new Error(msg);
  }

  const data =
    typeof json === 'object' && json && 'data' in json ? (json as { data: unknown }).data : json;

  if (
    !data ||
    typeof data !== 'object' ||
    typeof (data as { checkoutUrl?: unknown }).checkoutUrl !== 'string'
  ) {
    throw new Error('Invalid response from payment server');
  }

  const checkoutUrl = (data as { checkoutUrl: string }).checkoutUrl;
  const dodoSessionId =
    typeof (data as { dodoSessionId?: unknown }).dodoSessionId === 'string'
      ? (data as { dodoSessionId: string }).dodoSessionId
      : '';

  return { checkoutUrl, dodoSessionId };
}
