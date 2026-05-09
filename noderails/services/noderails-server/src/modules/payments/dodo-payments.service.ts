/**
 * Dodo Payments integration — NodeRails owns checkout correlation via session metadata;
 * card completion updates audit fields only (does not advance on-chain escrow by itself).
 *
 * Routes:
 * - `POST /checkout-sessions/public/:id/dodo-session` — creates a Dodo checkout session (API returns hosted URL).
 * - `POST /webhooks/dodo` — Standard Webhooks verification + metadata merge on `CheckoutSession` / `PaymentIntent`.
 */
import { getDatabaseClient } from '@noderails/database';
import { ValidationError, NotFoundError } from '@noderails/common';
import type { Logger } from '@noderails/service-base';
import { getRedis } from '@noderails/redis';
import { env } from '../../config.js';
import { dodoCreateCheckoutSession } from './dodo-payments.client.js';
import { verifyStandardWebhookSignature } from './dodo-webhook-verify.js';

function jsonObject(existing: unknown): Record<string, unknown> {
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return { ...(existing as Record<string, unknown>) };
  }
  return {};
}

function mergeNested(obj: Record<string, unknown>, key: string, patch: Record<string, unknown>): Record<string, unknown> {
  const prev = jsonObject(obj[key]);
  return { ...obj, [key]: { ...prev, ...patch } };
}

/** Walk payload trees and find NodeRails checkout session id echoed from checkout `metadata`. */
export function extractNodeRailsCheckoutSessionId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const o = payload as Record<string, unknown>;

  const meta = o.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    const id = m.noderails_checkout_session_id ?? m.noderailsCheckoutSessionId;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }

  for (const v of Object.values(o)) {
    const found = extractNodeRailsCheckoutSessionId(v);
    if (found) return found;
  }
  return undefined;
}

function extractEventHint(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const o = payload as Record<string, unknown>;
  if (typeof o.type === 'string') return o.type;
  if (typeof o.event === 'string') return o.event;
  if (typeof o.event_type === 'string') return o.event_type;
  if (o.data && typeof o.data === 'object') return extractEventHint(o.data);
  return undefined;
}

function extractPaymentStatus(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const o = payload as Record<string, unknown>;
  const candidates = [o.status, o.payment_status, o.paymentStatus];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  if (o.data && typeof o.data === 'object') return extractPaymentStatus(o.data);
  return undefined;
}

export function assertDodoConfigured(): void {
  if (!env.DODO_PAYMENTS_ENABLED) {
    throw new ValidationError('Dodo Payments card checkout is disabled on this deployment');
  }
  if (!env.DODO_PAYMENTS_API_KEY.trim()) {
    throw new ValidationError('Dodo Payments API key is not configured');
  }
  if (!env.DODO_PAYMENTS_PRODUCT_ID.trim()) {
    throw new ValidationError('Dodo Payments product id is not configured');
  }
}

export async function createDodoCheckoutForPublicSession(opts: {
  checkoutSessionId: string;
  logger: Logger;
}): Promise<{ checkoutUrl: string; dodoSessionId: string }> {
  assertDodoConfigured();

  const db = getDatabaseClient();
  const session = await db.checkoutSession.findUnique({
    where: { id: opts.checkoutSessionId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      mode: true,
      amount: true,
      currency: true,
      successUrl: true,
      cancelUrl: true,
      appId: true,
      metadata: true,
    },
  });

  if (!session) throw new NotFoundError('CheckoutSession', opts.checkoutSessionId);

  if (session.status !== 'OPEN') {
    throw new ValidationError(`Checkout session is ${session.status}; cannot start card checkout`);
  }
  if (session.expiresAt < new Date()) {
    await db.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    });
    throw new ValidationError('Checkout session has expired');
  }
  if (session.mode !== 'PAYMENT') {
    throw new ValidationError('Dodo card checkout is only available for one-time payment sessions');
  }

  const fiat = session.amount !== null ? Number(session.amount) : NaN;
  if (!Number.isFinite(fiat) || fiat <= 0) {
    throw new ValidationError('Checkout session must have a positive fiat total for card checkout');
  }

  const currency = (session.currency ?? 'USD').toUpperCase();
  if (currency !== 'USD') {
    throw new ValidationError(
      'Dodo card checkout currently expects USD-priced sessions (configure USD or extend mapping)',
    );
  }

  const cents = Math.round(fiat * 100);
  if (cents < 50) {
    throw new ValidationError('Amount too low for card checkout (minimum 0.50 USD)');
  }

  const baseUi = env.PAYMENT_UI_PUBLIC_URL.replace(/\/+$/, '');
  const returnUrl = session.successUrl?.trim() || `${baseUi}/checkout/${session.id}?dodo=return`;
  const cancelUrl = session.cancelUrl?.trim() || `${baseUi}/checkout/${session.id}?dodo=cancel`;

  const metaStrings: Record<string, string> = {
    noderails_checkout_session_id: session.id,
    noderails_app_id: session.appId,
  };

  const dodoRes = await dodoCreateCheckoutSession({
    baseUrl: env.DODO_PAYMENTS_BASE_URL,
    apiKey: env.DODO_PAYMENTS_API_KEY.trim(),
    logger: opts.logger,
    body: {
      product_cart: [
        {
          product_id: env.DODO_PAYMENTS_PRODUCT_ID.trim(),
          quantity: 1,
          amount: cents,
        },
      ],
      metadata: metaStrings,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  });

  if (!dodoRes.checkout_url) {
    throw new ValidationError(
      'Dodo Payments did not return a checkout URL — check product configuration (hosted checkout enabled)',
    );
  }

  const metaObj = jsonObject(session.metadata);
  const merged = mergeNested(metaObj, 'dodo', {
    lastCreatedSessionId: dodoRes.session_id,
    lastCreatedAt: new Date().toISOString(),
    lastAmountCents: cents,
    currency,
  });

  await db.checkoutSession.update({
    where: { id: session.id },
    data: { metadata: merged as object },
  });

  return {
    checkoutUrl: dodoRes.checkout_url,
    dodoSessionId: dodoRes.session_id,
  };
}

export async function processDodoWebhook(opts: {
  rawBody: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  logger: Logger;
}): Promise<boolean> {
  const secret = env.DODO_PAYMENTS_WEBHOOK_SECRET.trim();
  if (!secret) {
    opts.logger.warn('Dodo webhook rejected: DODO_PAYMENTS_WEBHOOK_SECRET not set');
    return false;
  }

  const okSig = verifyStandardWebhookSignature({
    rawPayload: opts.rawBody,
    webhookId: opts.webhookId,
    webhookTimestamp: opts.webhookTimestamp,
    webhookSignatureHeader: opts.webhookSignature,
    secret,
  });
  if (!okSig) {
    opts.logger.warn('Dodo webhook rejected: invalid signature');
    return false;
  }

  let payload: unknown;
  try {
    payload = opts.rawBody ? JSON.parse(opts.rawBody) : {};
  } catch {
    opts.logger.warn('Dodo webhook rejected: invalid JSON');
    return false;
  }

  const redis = getRedis();
  const dedupeKey = `dodo:webhook:${opts.webhookId}`;
  const nx = await redis.set(dedupeKey, '1', 'EX', 86400 * 7, 'NX');
  if (nx !== 'OK') {
    opts.logger.info('Dodo webhook duplicate ignored', { webhookId: opts.webhookId });
    return true;
  }

  const checkoutSessionId = extractNodeRailsCheckoutSessionId(payload);
  if (!checkoutSessionId) {
    opts.logger.warn('Dodo webhook: could not correlate payload to NodeRails checkout session');
    return true;
  }

  const db = getDatabaseClient();
  const cs = await db.checkoutSession.findUnique({
    where: { id: checkoutSessionId },
    select: { id: true, metadata: true, paymentIntentId: true },
  });

  if (!cs) {
    opts.logger.warn('Dodo webhook: checkout session not found', { checkoutSessionId });
    return true;
  }

  const eventHint = extractEventHint(payload);
  const paymentStatus = extractPaymentStatus(payload);

  const patch = {
    lastWebhookId: opts.webhookId,
    lastWebhookAt: new Date().toISOString(),
    lastEventHint: eventHint ?? null,
    lastPaymentStatus: paymentStatus ?? null,
    /** Card rail state only — independent from crypto escrow lifecycle */
    cardRailNote:
      'Updates reflect Dodo-hosted card payments only; on-chain authorization/capture is unchanged.',
  };

  const csMeta = mergeNested(jsonObject(cs.metadata), 'dodoWebhook', patch);

  await db.checkoutSession.update({
    where: { id: cs.id },
    data: { metadata: csMeta as object },
  });

  if (cs.paymentIntentId) {
    const pi = await db.paymentIntent.findUnique({
      where: { id: cs.paymentIntentId },
      select: { metadata: true },
    });
    if (pi) {
      const piMeta = mergeNested(jsonObject(pi.metadata), 'dodoWebhook', patch);
      await db.paymentIntent.update({
        where: { id: cs.paymentIntentId },
        data: { metadata: piMeta as object },
      });
    }
  }

  opts.logger.info('Processed Dodo webhook', {
    webhookId: opts.webhookId,
    checkoutSessionId,
    eventHint,
    paymentStatus,
  });

  return true;
}
