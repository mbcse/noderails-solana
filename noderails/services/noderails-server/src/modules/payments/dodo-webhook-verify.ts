/**
 * Standard Webhooks signature verification (Dodo Payments forwards Svix-compatible headers).
 * @see https://docs.dodopayments.com/developer-resources/webhooks
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TIMESTAMP_TOLERANCE_SEC = 300;

function decodeWebhookSecret(secret: string): Buffer {
  const s = secret.trim();
  if (s.startsWith('whsec_')) {
    return Buffer.from(s.slice(6), 'base64');
  }
  return Buffer.from(s, 'utf8');
}

export function verifyStandardWebhookSignature(opts: {
  rawPayload: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignatureHeader: string;
  secret: string;
}): boolean {
  const { rawPayload, webhookId, webhookTimestamp, webhookSignatureHeader, secret } = opts;
  if (!webhookId || !webhookTimestamp || !webhookSignatureHeader || !secret) return false;

  const tsNum = Number(webhookTimestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > TIMESTAMP_TOLERANCE_SEC) return false;

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawPayload}`;
  const key = decodeWebhookSecret(secret);
  const expected = createHmac('sha256', key).update(signedContent).digest();

  const entries = webhookSignatureHeader.trim().split(/\s+/);
  for (const entry of entries) {
    const comma = entry.indexOf(',');
    if (comma <= 0) continue;
    const version = entry.slice(0, comma);
    const sigB64 = entry.slice(comma + 1);
    if (version !== 'v1') continue;
    let sig: Buffer;
    try {
      sig = Buffer.from(sigB64, 'base64');
    } catch {
      continue;
    }
    if (sig.length !== expected.length) continue;
    try {
      if (timingSafeEqual(sig, expected)) return true;
    } catch {
      continue;
    }
  }
  return false;
}
