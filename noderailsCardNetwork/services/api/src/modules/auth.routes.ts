import { Router, type Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { onboardingSetupSchema, otpRequestSchema, otpVerifySchema } from "@noderails-card/common";
import { authRequired, getUser, signAccessToken } from "../lib/auth.js";
import { signerProvision } from "../lib/signer-client.js";
import { db } from "@noderails-card/database";
import { sha256Hex, computePanLookupHash } from "../lib/security.js";
import { otpQueue } from "@noderails-card/queue";
import { defaultExpiryFromNowYears, issueWallCardCvv, issueWallCardPan } from "../lib/card-issue.js";
import { encryptCvvDigits, encryptPanDigits } from "../lib/pan-crypto.js";
import { asyncRoute } from "../lib/async-route.js";

export const authRouter: ExpressRouter = Router();

authRouter.post("/otp/request", asyncRoute(async (req, res) => {
  try {
    const parsed = otpRequestSchema.parse(req.body);
    const user = await db.user.upsert({
      where: { email: parsed.email },
      update: parsed.phone ? { phone: parsed.phone } : {},
      create: { email: parsed.email, phone: parsed.phone }
    });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.otpAttempt.create({
      data: {
        userId: user.id,
        purpose: parsed.purpose,
        channel: parsed.phone ? "sms" : "email",
        codeHash: sha256Hex(code),
        expiresAt: new Date(Date.now() + 5 * 60_000)
      }
    });
    const isProd = process.env.APP_ENV === "production";
    await otpQueue.add(
      "deliver",
      {
        destination: parsed.email,
        code,
        channel: "email",
        purpose: parsed.purpose
      },
      {
        attempts: isProd ? 5 : 1,
        backoff: isProd ? { type: "exponential", delay: 1500 } : undefined,
        removeOnComplete: 200,
        removeOnFail: 500
      }
    );
    if (!isProd) {
      console.log(
        `[auth/otp/request] otp queued purpose=${parsed.purpose} userId=${user.id} email=${parsed.email} (delivered by email; local dev without SES — see worker logs)`
      );
    }
    res.json({
      ok: true,
      message: "otp issued"
    });
  } catch (e) {
    if (e instanceof ZodError) {
      res.status(400).json({ error: "validation_failed", issues: e.flatten() });
      return;
    }
    const msg = e instanceof Error ? e.message : "otp_request_failed";
    console.error("[auth/otp/request]", msg);
    res.status(500).json({ error: "otp_request_failed", detail: msg });
  }
}));

authRouter.post("/otp/verify", asyncRoute(async (req, res) => {
  const parsed = otpVerifySchema.parse(req.body);
  const user = await db.user.findUnique({ where: { email: parsed.email } });
  if (!user) {
    res.status(400).json({ error: "invalid_otp" });
    return;
  }
  const record = await db.otpAttempt.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" }
  });
  if (!record || record.codeHash !== sha256Hex(parsed.code) || record.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "invalid_otp" });
    return;
  }
  await db.otpAttempt.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  const accessToken = signAccessToken({ sub: user.id, email: parsed.email });
  // Setup is complete only when an active card exists.
  const existingCard = await db.card.findFirst({ where: { userId: user.id, status: "active" } });
  res.json({
    ok: true,
    accessToken,
    needsSetup: !existingCard,
    ...(existingCard
      ? {
          card: {
            id: existingCard.id,
            maskedNumber: existingCard.maskedNumber,
            panLastFour: existingCard.panLastFour,
            expiryMonth: existingCard.expiryMonth,
            expiryYear: existingCard.expiryYear,
            brand: existingCard.brand,
            status: existingCard.status
          }
        }
      : {})
  });
}));

authRouter.post("/onboarding/setup", authRequired, asyncRoute(async (req, res) => {
  const user = getUser(req);
  const parsed = onboardingSetupSchema.parse(req.body);
  // Only treat setup as complete when an active card exists.
  // Accounts can exist without a card due to partial or older flows.
  const existingCard = await db.card.findFirst({ where: { userId: user.sub, status: "active" } });
  if (existingCard) {
    // Still persist display name from setup — older clients hit this branch without ever updating User.displayName.
    if (parsed.fullName.trim()) {
      await db.user.update({
        where: { id: user.sub },
        data: { displayName: parsed.fullName.trim().slice(0, 120) }
      });
    }
    res.json({
      ok: true,
      alreadySetup: true,
      card: {
        id: existingCard.id,
        maskedNumber: existingCard.maskedNumber,
        panLastFour: existingCard.panLastFour,
        binPrefix: existingCard.binPrefix,
        expiryMonth: existingCard.expiryMonth,
        expiryYear: existingCard.expiryYear,
        brand: existingCard.brand,
        status: existingCard.status
      }
    });
    return;
  }

  // Validate PIN format: 4–8 numeric digits
  if (!parsed.pin || !/^\d{4,8}$/.test(parsed.pin)) {
    res.status(400).json({ error: "invalid_pin", detail: "PIN must be 4–8 numeric digits" });
    return;
  }

  // Hash PIN with argon2id — never store plaintext
  const { argon2id } = await import("@noble/hashes/argon2");
  const pinSalt = crypto.getRandomValues(new Uint8Array(16));
  const pinHashBytes = argon2id(parsed.pin, pinSalt, { t: 3, m: 1 << 16, p: 1, dkLen: 32 });
  const pinHashStored = `argon2id$${Buffer.from(pinSalt).toString("base64")}$${Buffer.from(pinHashBytes).toString("base64")}`;

  // Provision wallets — no PIN forwarded to signer-host
  let wallet: Awaited<ReturnType<typeof signerProvision>>;
  try {
    wallet = await signerProvision(user.sub);
  } catch (e) {
    res.status(502).json({ error: "wallet_provisioning_failed", detail: e instanceof Error ? e.message : "unknown" });
    return;
  }

  const issuerBinPrefix = (process.env.WALLCARD_BIN_PREFIX ?? "529741").replace(/\D/g, "").slice(0, 6).padStart(6, "0");
  const issuedPan = issueWallCardPan(issuerBinPrefix);
  const expiry = defaultExpiryFromNowYears(4);
  const enabledChains = await db.chainConfig.findMany({ where: { isEnabled: true } });
  const evmChainKey = enabledChains.find((c) => c.family === "evm")?.key ?? "ethereum-mainnet";
  const solanaChainKey = enabledChains.find((c) => c.family === "solana")?.key ?? "solana-mainnet";

  // Atomic transaction: store PIN hash, upsert accounts by walletRef, and create card idempotently
  const issuedCvv = issueWallCardCvv();

  const [, cardRow, disclosedFullPanDigits, disclosedCvvDigits] = await db.$transaction(async (tx) => {
    // Store PIN hash on user
    await tx.user.update({
      where: { id: user.sub },
      data: { pinHash: pinHashStored, displayName: parsed.fullName.trim().slice(0, 120) }
    });

    // Upsert accounts so retries or concurrent setup calls do not fail on unique walletRef.
    const evmAcc = await tx.account.upsert({
      where: { walletRef: wallet.evmWalletRef },
      create: {
        userId: user.sub,
        alias16: wallet.accountAlias,
        chainFamily: "evm",
        chainKey: evmChainKey,
        address: wallet.evmAddress,
        walletRef: wallet.evmWalletRef,
        walletProvider: "v1",
      },
      update: {
        userId: user.sub,
        alias16: wallet.accountAlias,
        chainKey: evmChainKey,
        address: wallet.evmAddress,
        walletProvider: "v1",
      }
    });

    await tx.account.upsert({
      where: { walletRef: wallet.solanaWalletRef },
      create: {
        userId: user.sub,
        alias16: `${wallet.accountAlias}1`,
        chainFamily: "solana",
        chainKey: solanaChainKey,
        address: wallet.solanaAddress,
        walletRef: wallet.solanaWalletRef,
        walletProvider: "v1",
      },
      update: {
        userId: user.sub,
        alias16: `${wallet.accountAlias}1`,
        chainKey: solanaChainKey,
        address: wallet.solanaAddress,
        walletProvider: "v1",
      }
    });

    // Prevent duplicate cards if setup endpoint is retried concurrently.
    const existingCard = await tx.card.findFirst({
      where: { userId: user.sub, status: "active" },
      orderBy: { createdAt: "desc" }
    });

    if (existingCard) {
      return [evmAcc, existingCard, undefined as string | undefined, undefined as string | undefined] as const;
    }

    let panEncrypted: Buffer;
    try {
      panEncrypted = encryptPanDigits(issuedPan.panDigits);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "pan_encrypt_failed";
      throw new Error(`pan_encryption_failed:${msg}`);
    }

    let cvvEncrypted: Buffer;
    try {
      cvvEncrypted = encryptCvvDigits(issuedCvv);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "cvv_encrypt_failed";
      throw new Error(`cvv_encryption_failed:${msg}`);
    }

    const card = await tx.card.create({
      data: {
        userId: user.sub,
        accountId: evmAcc.id,
        maskedNumber: issuedPan.maskedNumber,
        panLastFour: issuedPan.panLastFour,
        binPrefix: issuedPan.binSix,
        panEncrypted,
        cvvEncrypted,
        panLookupHash: computePanLookupHash(issuedPan.panDigits),
        expiryMonth: expiry.month,
        expiryYear: expiry.year,
        brand: process.env.WALLCARD_BRAND_LABEL ?? "WallCard",
        status: "active"
      }
    });

    return [evmAcc, card, issuedPan.panDigits, issuedCvv] as const;
  });

  await db.auditLog.create({
    data: {
      userId: user.sub,
      action: "onboarding_setup_completed",
      metadata: { fullName: parsed.fullName, dobIso: parsed.dobIso, phone: parsed.phone ?? null }
    }
  });

  // Never return walletRef to client
  res.json({
    ok: true,
    accountAlias: wallet.accountAlias,
    evmAddress: wallet.evmAddress,
    solanaAddress: wallet.solanaAddress,
    card: {
      id: cardRow.id,
      maskedNumber: cardRow.maskedNumber,
      panLastFour: cardRow.panLastFour,
      binPrefix: cardRow.binPrefix,
      expiryMonth: cardRow.expiryMonth,
      expiryYear: cardRow.expiryYear,
      brand: cardRow.brand,
      status: cardRow.status,
      ...(disclosedFullPanDigits ? { fullPanDigits: disclosedFullPanDigits } : {}),
      ...(disclosedCvvDigits ? { cvvDigits: disclosedCvvDigits } : {})
    }
  });
}));
