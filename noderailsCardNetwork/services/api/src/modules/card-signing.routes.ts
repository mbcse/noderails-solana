import { Router, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { cardSigningSessionSchema } from "@noderails-card/common";
import { db } from "@noderails-card/database";
import { timingSafeEqual } from "node:crypto";
import { signAccessToken } from "../lib/auth.js";
import { decryptCvvDigits } from "../lib/pan-crypto.js";
import { computePanLookupHash } from "../lib/security.js";
import { asyncRoute } from "../lib/async-route.js";

export const cardSigningRouter: ExpressRouter = Router();

function prismaBytesToUint8(v: Buffer | Uint8Array): Uint8Array {
  if (Buffer.isBuffer(v)) {
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  return v instanceof Uint8Array ? v : new Uint8Array(v);
}

function timingSafeEqualDigits(stored: string, presented: string): boolean {
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(presented, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

/**
 * Card-present session: verify PAN + CVV without a prior wallet login JWT.
 * Issues the same access-token shape as OTP login (short TTL) so /v1/signing-requests + OTP flow work unchanged.
 */
cardSigningRouter.post("/session", asyncRoute(async (req, res) => {
  try {
    const parsed = cardSigningSessionSchema.parse(req.body);
    const panDigits = parsed.panDigits.replace(/\D/g, "");
    const cvvDigits = parsed.cvvDigits.replace(/\D/g, "");
    if (panDigits.length < 13 || panDigits.length > 19) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }
    if (!/^\d{3,4}$/.test(cvvDigits)) {
      res.status(400).json({ error: "validation_failed" });
      return;
    }

    const panLookupHash = computePanLookupHash(panDigits);
    const card = await db.card.findFirst({
      where: { panLookupHash, status: "active" },
      include: { user: true }
    });

    if (!card?.user?.email || !card.cvvEncrypted || card.cvvEncrypted.byteLength === 0) {
      res.status(401).json({ error: "invalid_card_or_cvv" });
      return;
    }

    const decrypted = decryptCvvDigits(prismaBytesToUint8(card.cvvEncrypted));
    if (!decrypted || !timingSafeEqualDigits(decrypted, cvvDigits)) {
      res.status(401).json({ error: "invalid_card_or_cvv" });
      return;
    }

    const accessToken = signAccessToken(
      { sub: card.userId, email: card.user.email },
      { expiresIn: "15m" }
    );

    res.json({ ok: true, accessToken });
  } catch (e) {
    if (e instanceof ZodError) {
      res.status(400).json({ error: "validation_failed", issues: e.flatten() });
      return;
    }
    throw e;
  }
}));
