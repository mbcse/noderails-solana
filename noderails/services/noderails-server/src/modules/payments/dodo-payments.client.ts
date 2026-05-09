/**
 * Minimal Dodo Payments REST client — POST /checkouts (checkout session creation).
 * Official API: bearer auth against test or live host.
 * @see https://docs.dodopayments.com/api-reference/checkout-sessions/create
 */
import type { Logger } from '@noderails/service-base';

export interface DodoCreateCheckoutBody {
  product_cart: Array<{
    product_id: string;
    quantity: number;
    /** Lowest currency denomination when product supports PWYW (e.g. cents for USD). */
    amount?: number;
  }>;
  metadata?: Record<string, string>;
  return_url?: string | null;
  cancel_url?: string | null;
}

export interface DodoCreateCheckoutResponse {
  session_id: string;
  checkout_url?: string | null;
}

export async function dodoCreateCheckoutSession(opts: {
  baseUrl: string;
  apiKey: string;
  body: DodoCreateCheckoutBody;
  logger: Logger;
  timeoutMs?: number;
}): Promise<DodoCreateCheckoutResponse> {
  const { baseUrl, apiKey, body, logger, timeoutMs = 25_000 } = opts;
  const url = `${baseUrl.replace(/\/+$/, '')}/checkouts`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      logger.warn('Dodo Payments non-JSON response', { status: res.status, snippet: text.slice(0, 200) });
      throw new Error(`Dodo Payments invalid JSON (${res.status})`);
    }

    if (!res.ok) {
      const msg =
        typeof json === 'object' &&
        json &&
        'message' in json &&
        typeof (json as { message?: unknown }).message === 'string'
          ? (json as { message: string }).message
          : text.slice(0, 400);
      logger.warn('Dodo Payments checkout create failed', { status: res.status, msg });
      throw new Error(`Dodo Payments HTTP ${res.status}: ${msg}`);
    }

    const session_id =
      typeof json === 'object' &&
      json &&
      'session_id' in json &&
      typeof (json as { session_id?: unknown }).session_id === 'string'
        ? (json as { session_id: string }).session_id
        : '';

    if (!session_id) {
      throw new Error('Dodo Payments response missing session_id');
    }

    const checkout_url =
      typeof json === 'object' &&
      json &&
      'checkout_url' in json &&
      typeof (json as { checkout_url?: unknown }).checkout_url === 'string'
        ? (json as { checkout_url: string }).checkout_url
        : undefined;

    return {
      session_id,
      checkout_url: checkout_url ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}
