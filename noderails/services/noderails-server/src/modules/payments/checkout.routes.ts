import express, { Router } from 'express';
import { z } from 'zod';
import { isValidMerchantWalletAddress } from '@noderails/common';
import { asyncHandler, validate, success, createLogger } from '@noderails/service-base';
import * as authorizeService from './authorize.service.js';
import * as intentService from './intent.service.js';

const router: express.Router = Router();
const logger = createLogger('checkout');

// ── Schemas ──

const permitSignatureSchema = z.object({
  amount: z.string().min(1),
  deadline: z.string(),
  v: z.number(),
  r: z.string(),
  s: z.string(),
});

/** EVM payer (0x…) or Solana base58 public key. */
const checkoutWalletAddressSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((s) => isValidMerchantWalletAddress(s), { message: 'Invalid wallet address' });

const commonAuthFields = {
  walletAddress: checkoutWalletAddressSchema,
  chainId: z.number().int().positive(),
  tokenKey: z.string().min(1),
  authorizationMethod: z.enum(['NATIVE', 'PERMIT']),
  permitSignature: permitSignatureSchema.optional(),
  approvalTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  cryptoAmount: z.string().min(1),
  exchangeRate: z.string().min(1),
  customerEmail: z.string().email().max(255),
  customerName: z.string().max(255).optional(),
  billingAddress: z.string().max(500).optional(),
  billingCity: z.string().max(255).optional(),
  billingState: z.string().max(255).optional(),
  billingCountry: z.string().max(255).optional(),
  billingPostalCode: z.string().max(50).optional(),
};

// Primary: authorize from a checkout session (universal path)
const authorizeFromSessionSchema = z.object({
  checkoutSessionId: z.string().uuid(),
  ...commonAuthFields,
});

// Legacy: authorize from a payment link (backward compat — creates session internally)
const authorizeFromLinkSchema = z.object({
  paymentLinkId: z.string().uuid(),
  ...commonAuthFields,
});

// Combined schema: accepts either checkoutSessionId or paymentLinkId
const authorizeSchema = z.union([authorizeFromSessionSchema, authorizeFromLinkSchema]);

// ── POST /checkout/authorize ──
// Universal authorization endpoint.
// Accepts either { checkoutSessionId, ... } (preferred) or { paymentLinkId, ... } (legacy).

router.post(
  '/authorize',
  validate(authorizeSchema),
  asyncHandler(async (req, res) => {
    let result;
    if ('checkoutSessionId' in req.body) {
      result = await authorizeService.authorizeFromCheckoutSession(req.body, logger);
    } else {
      result = await authorizeService.authorizeFromLink(req.body, logger);
    }
    success(res, result);
  }),
);

// ── POST /checkout/report-native-capture ──
// Called by the frontend after the user sends a native token capture tx.
// Creates a Transaction record and marks the intent as CAPTURING.

/** EVM tx hash (0x + 64 hex) or Solana transaction signature (base58). */
const captureTxHashSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine(
    (h) => /^0x[a-fA-F0-9]{64}$/.test(h) || /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(h),
    { message: 'Invalid transaction hash' },
  );

const reportNativeCaptureSchema = z.object({
  intentId: z.string().uuid(),
  txHash: captureTxHashSchema,
});

router.post(
  '/report-native-capture',
  validate(reportNativeCaptureSchema),
  asyncHandler(async (req, res) => {
    const result = await authorizeService.reportNativeCapture(
      req.body.intentId,
      req.body.txHash,
      logger,
    );
    success(res, result);
  }),
);

// ── GET /checkout/intent/:id ──
// Public intent status polling for the payment UI

router.get(
  '/intent/:id',
  asyncHandler(async (req, res) => {
    const intent = await intentService.getIntentPublic(req.params.id);
    success(res, intent);
  }),
);

export default router;
