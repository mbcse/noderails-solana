import cookieParser from "cookie-parser";
import express from "express";
import { jsonErrorMiddleware, requestIdMiddleware, requireIdempotency } from "@noderails-card/service-base";
import { rateLimitMiddleware } from "./lib/security.js";
import { config } from "./config.js";
import { apiErrorHandler } from "./lib/api-error-handler.js";
import { authRouter } from "./modules/auth.routes.js";
import { cardSigningRouter } from "./modules/card-signing.routes.js";
import { walletRouter } from "./modules/wallet.routes.js";
import { signingRouter } from "./modules/signing.routes.js";
import { dappsRouter } from "./modules/dapps.routes.js";
import { docsRouter } from "./modules/docs.routes.js";
import { transactionsRouter } from "./modules/transactions.routes.js";
import { publicRouter } from "./modules/public.routes.js";
import { chainsRouter } from "./modules/chains.routes.js";
import { tokensRouter } from "./modules/tokens.routes.js";

/** Always allow CORS from these deployed WallCard HTTPS origins (in addition to `process.env`). */
const WALLCARD_FIXED_CORS_ORIGINS = ["https://webapp.wallcard.noderails.com", "https://wallcard.noderails.com"];

const app = express();
if (config.TRUST_PROXY) app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
const allowedOrigins = new Set(
  [
    ...WALLCARD_FIXED_CORS_ORIGINS,
    process.env.WALLET_APP_ORIGIN,
    process.env.NEXT_PUBLIC_WEB_URL,
    process.env.NEXT_PUBLIC_WALLET_URL,
    process.env.NEXT_PUBLIC_DASHBOARD_URL,
    process.env.EXPO_WEB_ORIGIN,
    ...config.CORS_ALLOWED_ORIGINS,
    "http://localhost:8090",
    "http://127.0.0.1:8090"
  ].filter((v): v is string => Boolean(v))
);

const EXPO_DEV_WEB_PORT = "8090";

function isLanHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

/** Browser sends Origin; Expo web on a phone uses http://<LAN-IP>:8090 which must be allowed in dev. */
function corsAllowsOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  if (config.APP_ENV === "production") return false;
  try {
    const u = new URL(origin);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    if (port !== EXPO_DEV_WEB_PORT) return false;
    return isLanHostname(u.hostname);
  } catch {
    return false;
  }
}

app.use((req, res, next) => {
  const origin = req.header("origin");
  if (origin && corsAllowsOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "content-type, authorization, idempotency-key");
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    if (origin && !corsAllowsOrigin(origin)) {
      console.warn(`[api] cors preflight denied for origin="${origin}" (set EXPO_WEB_ORIGIN / WALLET_APP_ORIGIN / CORS_ALLOWED_ORIGINS)`);
    }
    res.status(204).end();
    return;
  }
  next();
});
app.use(requestIdMiddleware);
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[api] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});
app.use(requireIdempotency);
app.use(rateLimitMiddleware);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

app.use("/v1/auth", authRouter);
app.use("/v1/card-signing", cardSigningRouter);
app.use("/v1/wallet", walletRouter);
app.use("/v1/signing-requests", signingRouter);
app.use("/v1/transactions", transactionsRouter);
app.use("/v1/dapps", dappsRouter);
app.use("/v1/chains", chainsRouter);
app.use("/v1/tokens", tokensRouter);
app.use("/v1/public", publicRouter);
app.use("/v1", docsRouter);
app.use(apiErrorHandler);
app.use(jsonErrorMiddleware);

const port = config.PORT;
const host = config.LISTEN_HOST;
app.listen(port, host, () => {
  console.log(`api listening on ${host}:${port}`);
});
