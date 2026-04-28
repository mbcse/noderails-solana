import { randomInt } from "node:crypto";

/** Luhn check digit for a numeric string WITHOUT the check digit (length typically 15 for a 16-digit PAN). */
function luhnChecksumDigit(payload: string): number {
  let sum = 0;
  let alt = false;
  for (let i = payload.length - 1; i >= 0; i--) {
    let n = Number(payload[i]);
    if (Number.isNaN(n)) throw new Error("invalid_pan_digit");
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return (10 - (sum % 10)) % 10;
}

/** Issuer BIN (first 6). Must be 6 digits — use test issuer range in sandbox. PAN/CVV plaintext persisted only as AES-GCM ciphertext (`panEncrypted`, `cvvEncrypted`). */
export function issueWallCardPan(binPrefix: string): {
  maskedNumber: string;
  panLastFour: string;
  binSix: string;
  /** Full primary account number (digits only); encrypted into DB + returned once on setup */
  panDigits: string;
} {
  const bin = binPrefix.replace(/\D/g, "").slice(0, 6).padStart(6, "0");
  if (!/^[0-9]{6}$/.test(bin)) {
    throw new Error("invalid_wallcard_bin_prefix");
  }
  let body = "";
  for (let i = 0; i < 9; i++) {
    body += String(randomInt(0, 10));
  }
  const withoutCheck = bin + body;
  const checkDigit = luhnChecksumDigit(withoutCheck);
  const pan = `${withoutCheck}${checkDigit}`;
  const panLastFour = pan.slice(-4);
  const maskedNumber = `${bin.slice(0, 4)} ${bin.slice(4, 6)} •• •••• ${panLastFour}`;
  return { maskedNumber, panLastFour, binSix: bin, panDigits: pan };
}

export function defaultExpiryFromNowYears(yearsAhead: number): { month: number; year: number } {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsAhead);
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

/** Virtual card CVV — 3 digits (ISO-like demo semantics). */
export function issueWallCardCvv(): string {
  return String(randomInt(0, 1000)).padStart(3, "0");
}
