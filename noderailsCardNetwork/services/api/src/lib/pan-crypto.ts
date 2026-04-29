// @ts-nocheck — Node Buffer vs Cipher GCM typings disagree under strict TS; runtime behavior is correct.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { BinaryLike, CipherKey } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let warnedDevFallback = false;

function getCipherKey(): CipherKey {
  const env = process.env.PAN_ENCRYPTION_KEY?.trim();
  if (env) {
    const key = Buffer.from(env, "base64");
    if (key.length !== 32) {
      throw new Error("PAN_ENCRYPTION_KEY must be base64 that decodes to exactly 32 bytes");
    }
    return key as CipherKey;
  }
  if (process.env.APP_ENV === "production") {
    throw new Error("PAN_ENCRYPTION_KEY is required when APP_ENV=production");
  }
  if (!warnedDevFallback) {
    warnedDevFallback = true;
    console.warn(
      "[pan-crypto] PAN_ENCRYPTION_KEY unset — using deterministic dev-only key (set PAN_ENCRYPTION_KEY in production)"
    );
  }
  return createHash("sha256").update("wallcard-dev-only-pan-encryption-v1").digest() as CipherKey;
}

/** Encrypt PAN digits-only string for storage in `Card.panEncrypted`. */
export function encryptPanDigits(panDigits: string): Buffer {
  const digits = panDigits.replace(/\D/g, "");
  if (!digits || digits.length < 12 || digits.length > 19) {
    throw new Error("invalid_pan_length");
  }
  const key = getCipherKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv as BinaryLike);
  const plain = Buffer.from(digits, "utf8");
  const enc = Buffer.concat([cipher.update(plain as BinaryLike), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

/** Decrypt `Card.panEncrypted` blob; returns digits-only string or null on failure. */
export function decryptPanDigits(blob: Uint8Array): string | null {
  try {
    if (!blob || blob.length < IV_LEN + TAG_LEN + 4) return null;
    const key = getCipherKey();
    const iv = blob.subarray(0, IV_LEN);
    const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = blob.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv as BinaryLike);
    decipher.setAuthTag(tag as BinaryLike);
    const dec = Buffer.concat([decipher.update(data as BinaryLike), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** Encrypt CVV digits for `Card.cvvEncrypted` (same key material as PAN). */
export function encryptCvvDigits(cvvDigits: string): Buffer {
  const digits = cvvDigits.replace(/\D/g, "");
  if (!/^\d{3,4}$/.test(digits)) {
    throw new Error("invalid_cvv_length");
  }
  const key = getCipherKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv as BinaryLike);
  const plain = Buffer.from(digits, "utf8");
  const enc = Buffer.concat([cipher.update(plain as BinaryLike), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

/** Decrypt `Card.cvvEncrypted`; returns digits or null on failure. */
export function decryptCvvDigits(blob: Uint8Array): string | null {
  try {
    if (!blob || blob.length < IV_LEN + TAG_LEN + 1) return null;
    const key = getCipherKey();
    const iv = blob.subarray(0, IV_LEN);
    const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = blob.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv as BinaryLike);
    decipher.setAuthTag(tag as BinaryLike);
    const dec = Buffer.concat([decipher.update(data as BinaryLike), decipher.final()]);
    const out = dec.toString("utf8");
    return /^\d{3,4}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}
