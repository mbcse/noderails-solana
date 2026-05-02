import { Router, type Router as ExpressRouter } from "express";
import { authRequired, getUser } from "../lib/auth.js";
import { db } from "@noderails-card/database";
import {
  fetchEvmErc20Balance,
  fetchEvmNativeBalance,
  fetchSolanaNativeBalance,
  fetchSolanaSplBalance
} from "@noderails-card/chain";
import { asyncRoute } from "../lib/async-route.js";
import { decryptCvvDigits, decryptPanDigits } from "../lib/pan-crypto.js";

function prismaBytesToUint8(v: Buffer | Uint8Array): Uint8Array {
  if (Buffer.isBuffer(v)) {
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  return v instanceof Uint8Array ? v : new Uint8Array(v);
}

export const walletRouter: ExpressRouter = Router();
walletRouter.use(authRequired);

walletRouter.get("/profile", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const row = await db.user.findUnique({
    where: { id: user.sub },
    select: { email: true, displayName: true }
  });
  if (!row) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  res.json({
    email: row.email,
    displayName: row.displayName
  });
}));

/** Recent WallCard signing requests (Web3) — separate from balance snapshots. */
walletRouter.get("/activity", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const take = Math.min(Number(req.query.limit ?? 30) || 30, 100);
  const rows = await db.signingRequest.findMany({
    where: { userId: user.sub },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      status: true,
      chainFamily: true,
      method: true,
      createdAt: true,
      updatedAt: true,
      requestSource: true,
      requestOrigin: true,
      error: true
    }
  });
  res.json({ data: rows });
}));

const FALLBACK_CHAIN_REGISTRY: Array<{ key: string; family: "evm" | "solana"; name: string; symbol: string; rpcUrl: string }> = [
  { key: "ethereum-mainnet", family: "evm", name: "Ethereum", symbol: "ETH", rpcUrl: "https://eth.llamarpc.com" },
  { key: "solana-mainnet", family: "solana", name: "Solana", symbol: "SOL", rpcUrl: "https://api.mainnet-beta.solana.com" }
];

walletRouter.get("/accounts", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const accounts = await db.account.findMany({ where: { userId: user.sub } });
  res.json({ data: accounts });
}));

walletRouter.get("/cards", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const cards = await db.card.findMany({ where: { userId: user.sub } });
  const data = cards.map((c) => {
    const { panEncrypted, cvvEncrypted, ...rest } = c;
    let fullPanDigits: string | undefined;
    if (panEncrypted != null && panEncrypted.byteLength > 0) {
      const decoded = decryptPanDigits(prismaBytesToUint8(panEncrypted));
      if (decoded) fullPanDigits = decoded;
    }
    let cvvDigits: string | undefined;
    if (cvvEncrypted != null && cvvEncrypted.byteLength > 0) {
      const decoded = decryptCvvDigits(prismaBytesToUint8(cvvEncrypted));
      if (decoded) cvvDigits = decoded;
    }
    return {
      ...rest,
      ...(fullPanDigits ? { fullPanDigits } : {}),
      ...(cvvDigits ? { cvvDigits } : {})
    };
  });
  res.json({ data });
}));

walletRouter.get("/balances", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const accounts = await db.account.findMany({ where: { userId: user.sub } });
  const configuredChains = await db.chainConfig.findMany({
    where: { isEnabled: true },
    orderBy: { createdAt: "asc" }
  });
  const registry =
    configuredChains.length > 0
      ? configuredChains.map((c) => ({
          key: c.key,
          family: c.family,
          name: c.name,
          symbol: c.symbol,
          rpcUrl: c.rpcUrl
        }))
      : FALLBACK_CHAIN_REGISTRY;
  const chainKeys = registry.map((c) => c.key);
  const tokenRows = await db.tokenConfig.findMany({
    where: { chainKey: { in: chainKeys }, isEnabled: true },
    orderBy: [{ chainKey: "asc" }, { symbol: "asc" }]
  });
  const tokensByChain = new Map<string, typeof tokenRows>();
  for (const t of tokenRows) {
    const list = tokensByChain.get(t.chainKey) ?? [];
    list.push(t);
    tokensByChain.set(t.chainKey, list);
  }
  const data = await Promise.all(
    registry.map(async (chainDef) => {
      const account =
        accounts.find((a) => a.chainKey === chainDef.key) ??
        accounts.find((a) => a.chainFamily === chainDef.family);
      let balance = "0";
      let source: "real-rpc" | "testing" | "rpc_unreachable" = "testing";
      if (account?.address) {
        try {
          balance =
            chainDef.family === "evm"
              ? await fetchEvmNativeBalance(chainDef.rpcUrl, account.address)
              : await fetchSolanaNativeBalance(chainDef.rpcUrl, account.address);
          source = "real-rpc";
        } catch {
          balance = "unavailable";
          source = "rpc_unreachable";
        }
      }
      return {
        chain: chainDef.key,
        chainName: chainDef.name,
        symbol: chainDef.symbol,
        address: account?.address ?? null,
        balance,
        source,
        tokens:
          account?.address && (tokensByChain.get(chainDef.key)?.length ?? 0) > 0
            ? await Promise.all(
                (tokensByChain.get(chainDef.key) ?? []).map(async (token) => {
                  try {
                    const amount =
                      token.kind === "erc20"
                        ? await fetchEvmErc20Balance(
                            chainDef.rpcUrl,
                            account.address!,
                            token.contractAddress,
                            token.decimals ?? 6
                          )
                        : await fetchSolanaSplBalance(chainDef.rpcUrl, account.address!, token.contractAddress);
                    return { symbol: token.symbol, balance: amount, source: "real-rpc" as const };
                  } catch {
                    return { symbol: token.symbol, balance: "0.000000", source: "testing" as const };
                  }
                })
              )
            : []
      };
    })
  );
  res.json({
    data,
    note:
      configuredChains.length > 0
        ? "Loaded from chain registry. Token balances use TokenConfig rows (seed via /v1/chains/seed or /v1/tokens/seed)."
        : "Using fallback chain registry. Seed /v1/chains/seed to manage chains from dashboard. Add tokens with /v1/tokens or token seed."
  });
}));
