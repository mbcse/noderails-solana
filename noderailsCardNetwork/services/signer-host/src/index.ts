import express from "express";
import { z } from "zod";
import type { SigningMethod } from "@noderails-card/common";
import { createKeyProvider } from "./providers/index.js";

const app = express();
app.use(express.json());

const appEnv = process.env.APP_ENV ?? "development";
const sharedToken = process.env.SIGNER_SHARED_TOKEN ?? "dev_signer_shared_token";
const nitroMode = process.env.NITRO_MODE ?? "simulate";

// Instantiate provider at startup — exits if misconfigured
const keyProvider = createKeyProvider();

const provisionSchema = z.object({
  userId: z.string().min(3),
});

const signSchema = z.object({
  userId: z.string().min(3),
  walletRef: z.string().min(1),
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
  payload: z.record(z.string(), z.unknown()),
  chainId: z.number().int().positive().optional(),
});

function methodChainConsistent(chain: "evm" | "solana", method: SigningMethod): boolean {
  const sol = method.startsWith("solana_");
  return chain === "solana" ? sol : !sol;
}

app.use((req, res, next) => {
  if (req.path === "/healthz") { next(); return; }
  const token = req.header("x-signer-token");
  if (!token || token !== sharedToken) {
    res.status(401).json({ error: "unauthorized_signer_access" });
    return;
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "signer-host", nitroMode, appEnv, provider: keyProvider.providerName });
});

app.post("/provision", async (req, res) => {
  try {
    const parsed = provisionSchema.parse(req.body);
    const result = await keyProvider.generateWallet(parsed.userId);
    res.json({
      accountAlias: result.accountAlias,
      evmAddress: result.evmAddress,
      solanaAddress: result.solanaAddress,
      evmWalletRef: result.evmWalletRef,
      solanaWalletRef: result.solanaWalletRef,
    });
  } catch (e) {
    res.status(400).json({ error: "provision_failed", detail: e instanceof Error ? e.message : "unknown" });
  }
});

app.post("/sign", async (req, res) => {
  try {
    const parsed = signSchema.parse(req.body);
    if (!methodChainConsistent(parsed.chain, parsed.method as SigningMethod)) {
      res.status(400).json({ error: "chain_method_mismatch" });
      return;
    }
    const result = await keyProvider.sign(parsed.walletRef, {
      chain: parsed.chain,
      method: parsed.method,
      payload: parsed.payload as Record<string, unknown>,
      chainId: parsed.chainId,
    });
    res.json({
      signature: result.signature,
      signingOutput: result.signingOutput,
      providerTag: result.providerTag,
      enclavePcrDigest: nitroMode === "simulate" ? "local-simulate-signer" : "nitro-attestation-required",
    });
  } catch (e) {
    res.status(400).json({
      error: "signing_failed",
      detail: e instanceof Error ? e.message : "unknown_signing_error",
    });
  }
});

const port = Number(process.env.SIGNER_HOST_PORT ?? "8081");
app.listen(port, () => {
  console.log(`signer-host listening on :${port} [provider=${keyProvider.providerName}]`);
});
