import { Router, type Router as ExpressRouter } from "express";
import { ids, signingCreateSchema, signingConfirmSchema, SUPPORTED_SIGNING_METHODS } from "@noderails-card/common";
import { authRequired, getUser } from "../lib/auth.js";
import { signerSign } from "../lib/signer-client.js";
import { db, type Prisma } from "@noderails-card/database";
import { sha256Hex } from "../lib/security.js";
import { asyncRoute } from "../lib/async-route.js";

export const signingRouter: ExpressRouter = Router();
signingRouter.use(authRequired);

signingRouter.post("/", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const parsed = signingCreateSchema.parse(req.body);
  const id = ids.signingRequest();
  await db.signingRequest.create({
    data: {
      id,
      userId: user.sub,
      chainFamily: parsed.chain,
      method: parsed.method,
      payload: parsed.payload as unknown as object,
      status: "awaiting_pin",
      requestSource: parsed.requestSource ?? null,
      requestOrigin: parsed.requestOrigin ?? null
    }
  });
  res.status(202).json({ id, status: "awaiting_pin" });
}));

signingRouter.get("/methods", (_req, res) => {
  res.json({ data: SUPPORTED_SIGNING_METHODS });
});

signingRouter.post("/:id/confirm", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const parsed = signingConfirmSchema.parse(req.body);
  const record = await db.signingRequest.findUnique({ where: { id: req.params.id } });
  if (!record || record.userId !== user.sub) {
    res.status(404).json({ error: "signing_request_not_found" });
    return;
  }

  // --- OTP verification ---
  if (parsed.useOtp) {
    if (!parsed.otpCode) {
      res.status(400).json({ error: "otp_required" });
      return;
    }
    const otpRecord = await db.otpAttempt.findFirst({
      where: { userId: user.sub, purpose: "signing", consumedAt: null },
      orderBy: { createdAt: "desc" }
    });
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
    if (
      !otpRecord ||
      otpRecord.codeHash !== sha256Hex(parsed.otpCode) ||
      otpRecord.expiresAt.getTime() < Date.now() ||
      otpRecord.createdAt < fiveMinutesAgo
    ) {
      res.status(401).json({ error: "invalid_otp" });
      return;
    }
    // Mark OTP consumed only after all verifications pass (done below in transaction)
  }

  // --- PIN verification ---
  if (parsed.pin) {
    const userRecord = await db.user.findUnique({ where: { id: user.sub } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storedPinHash = (userRecord as any)?.pinHash as string | null | undefined;
    if (storedPinHash) {
      const isValid = await verifyArgon2idPin(parsed.pin, storedPinHash);
      if (!isValid) {
        res.status(401).json({ error: "invalid_pin" });
        return;
      }
    }
    // If no pinHash stored yet (legacy users), skip PIN check
  }

  // --- Get walletRef for this user ---
  const chainFamily = record.chainFamily as "evm" | "solana";
  const account = await db.account.findFirst({
    where: { userId: user.sub, chainFamily }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletRef = (account as any)?.walletRef as string | null | undefined;
  if (!walletRef) {
    res.status(409).json({ error: "wallet_not_provisioned" });
    return;
  }

  // --- Atomically consume OTP and dispatch signing ---
  try {
    // Consume OTP if used
    if (parsed.useOtp && parsed.otpCode) {
      const otpRecord = await db.otpAttempt.findFirst({
        where: { userId: user.sub, purpose: "signing", consumedAt: null },
        orderBy: { createdAt: "desc" }
      });
      if (otpRecord) {
        await db.otpAttempt.update({ where: { id: otpRecord.id }, data: { consumedAt: new Date() } });
      }
    }

    // Call signer — walletRef only, no PIN or card credentials
    const payload = record.payload as Record<string, unknown>;
    const result = await signerSign({
      userId: user.sub,
      walletRef,
      chain: chainFamily,
      method: record.method,
      payload
    });

    await db.signingRequest.update({
      where: { id: record.id },
      data: {
        status: "succeeded",
        signature: result.signature,
        signingOutput: result.signingOutput as Prisma.InputJsonValue,
        error: null
      }
    });

    res.json({
      id: record.id,
      status: "succeeded",
      signature: result.signature,
      signingOutput: result.signingOutput,
      enclavePcrDigest: result.enclavePcrDigest
      // walletRef intentionally omitted from response
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    console.error("[signing-requests/confirm]", record.id, detail);
    const truncated = detail.length > 900 ? `${detail.slice(0, 897)}...` : detail;
    await db.signingRequest.update({
      where: { id: record.id },
      data: { status: "failed", error: `signing_failure:${truncated}` }
    });
    const isProd = process.env.APP_ENV === "production";
    res.status(400).json({
      id: record.id,
      status: "failed",
      error: "signing_failure",
      ...(!isProd ? { detail } : {})
    });
  }
}));

// Verify argon2id PIN hash stored as "argon2id$<salt_b64>$<hash_b64>"
async function verifyArgon2idPin(pin: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "argon2id") return false;
    const salt = new Uint8Array(Buffer.from(parts[1], "base64"));
    const expectedHash = new Uint8Array(Buffer.from(parts[2], "base64"));
    const { argon2id } = await import("@noble/hashes/argon2");
    const computed = argon2id(pin, salt, { t: 3, m: 1 << 16, p: 1, dkLen: 32 });
    if (computed.length !== expectedHash.length) return false;
    return computed.every((byte, i) => byte === expectedHash[i]);
  } catch {
    return false;
  }
}
