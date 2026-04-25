import { z } from "zod";

export const idSchema = z.string().min(3);
export const otpSchema = z.string().regex(/^[0-9]{6}$/);
export const pinSchema = z.string().min(4).max(64);

export const signingIntentSchema = z.object({
  chain: z.enum(["evm", "solana"]),
  method: z.enum([
    "eth_sendTransaction",
    "eth_signTransaction",
    "eth_sign",
    "personal_sign",
    "eth_signTypedData_v4",
    "solana_signMessage",
    "solana_signTransaction"
  ]),
  payload: z.unknown()
});
export const otpRequestSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8).optional(),
  purpose: z.enum(["login", "signing"]).default("login")
});
export const otpVerifySchema = z.object({
  email: z.string().email(),
  code: otpSchema
});
export const onboardingSetupSchema = z.object({
  fullName: z.string().min(2).max(120),
  dobIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(8).max(24).optional(),
  pin: pinSchema
});
export const signingCreateSchema = z.object({
  chain: z.enum(["evm", "solana"]),
  method: signingIntentSchema.shape.method,
  payload: z.record(z.string(), z.unknown()),
  otpToken: z.string().optional(),
  /** Client hint: mobile_app, wallet_sdk_iframe, etc. */
  requestSource: z.string().max(120).optional(),
  /** Origin URL or referrer string */
  requestOrigin: z.string().max(512).optional()
});
export const signingConfirmSchema = z.object({
  pin: pinSchema,
  useOtp: z.boolean().default(false),
  otpCode: otpSchema.optional()
});
export const cardSigningSessionSchema = z.object({
  panDigits: z.string().min(1),
  cvvDigits: z.string().min(1)
});

export type SigningIntent = z.infer<typeof signingIntentSchema>;
export type SigningMethod = z.infer<typeof signingIntentSchema>["method"];

export const SUPPORTED_SIGNING_METHODS: SigningMethod[] = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "personal_sign",
  "eth_signTypedData_v4",
  "solana_signMessage",
  "solana_signTransaction"
];

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

export const ids = {
  account: () => `acc_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`,
  card: () => `card_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`,
  signingRequest: () => `sr_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`
};
