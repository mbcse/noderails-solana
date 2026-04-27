import { z } from "zod";

const configSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  /** When behind one reverse proxy (e.g. Caddy), Express uses X-Forwarded-* for req.ip — required for rate limits. */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => (v ? ["true", "1", "yes"].includes(v.toLowerCase()) : false)),
  PORT: z.coerce.number().default(9080),
  LISTEN_HOST: z.string().default("0.0.0.0"),
  SIGNER_HOST_URL: z.string().url().default("http://localhost:8081"),
  SIGNER_SHARED_TOKEN: z.string().min(8).default("dev_signer_shared_token"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(120),
  /** Comma-separated browser origins allowed for CORS (scheme + host, no trailing slash). Merged with WALLET_APP_ORIGIN, EXPO_WEB_ORIGIN, etc. */
  CORS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter((s): s is string => s.length > 0)
        : []
    )
});

export const config = configSchema.parse(process.env);
