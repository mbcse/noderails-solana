import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { db } from "@noderails-card/database";
import { authRequired } from "../lib/auth.js";
import { getEvmChainHealth, getSolanaChainHealth } from "@noderails-card/chain";
import { seedDefaultTokens } from "../lib/token-seed.js";
import { asyncRoute } from "../lib/async-route.js";

const chainCreateSchema = z.object({
  key: z.string().min(2).max(64),
  name: z.string().min(2).max(80),
  symbol: z.string().min(2).max(16),
  family: z.enum(["evm", "solana"]),
  rpcUrl: z.string().url(),
  explorerUrl: z.string().url().optional(),
  isEnabled: z.boolean().optional()
});

const chainUpdateSchema = chainCreateSchema.partial();

const DEFAULT_CHAINS = [
  {
    key: "ethereum-mainnet",
    name: "Ethereum",
    symbol: "ETH",
    family: "evm" as const,
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    isEnabled: true
  },
  {
    key: "solana-mainnet",
    name: "Solana",
    symbol: "SOL",
    family: "solana" as const,
    rpcUrl: "https://api.mainnet-beta.solana.com",
    explorerUrl: "https://solscan.io",
    isEnabled: true
  }
];

export const chainsRouter: ExpressRouter = Router();
chainsRouter.use(authRequired);

chainsRouter.post("/seed", asyncRoute(async (_req, res) => {
  for (const chain of DEFAULT_CHAINS) {
    await db.chainConfig.upsert({
      where: { key: chain.key },
      update: {},
      create: chain
    });
  }
  const tokensSeeded = await seedDefaultTokens();
  res.json({ ok: true, seeded: DEFAULT_CHAINS.length, tokensSeeded });
}));

chainsRouter.get("/", asyncRoute(async (_req, res) => {
  const data = await db.chainConfig.findMany({ orderBy: { createdAt: "asc" } });
  res.json({ data });
}));

chainsRouter.get("/health", asyncRoute(async (_req, res) => {
  const chains = await db.chainConfig.findMany({ where: { isEnabled: true }, orderBy: { createdAt: "asc" } });
  const data = await Promise.all(
    chains.map(async (chain) => {
      const health =
        chain.family === "evm"
          ? await getEvmChainHealth(chain.rpcUrl)
          : await getSolanaChainHealth(chain.rpcUrl);
      return {
        key: chain.key,
        name: chain.name,
        family: chain.family,
        rpcUrl: chain.rpcUrl,
        ...health
      };
    })
  );
  res.json({ data });
}));

chainsRouter.post("/", asyncRoute(async (req, res) => {
  const parsed = chainCreateSchema.parse(req.body);
  const row = await db.chainConfig.create({
    data: {
      key: parsed.key,
      name: parsed.name,
      symbol: parsed.symbol,
      family: parsed.family,
      rpcUrl: parsed.rpcUrl,
      explorerUrl: parsed.explorerUrl,
      isEnabled: parsed.isEnabled ?? true
    }
  });
  res.status(201).json({ data: row });
}));

chainsRouter.patch("/:key", asyncRoute(async (req, res) => {
  const parsed = chainUpdateSchema.parse(req.body);
  const key = req.params.key;
  const row = await db.chainConfig.update({
    where: { key },
    data: parsed
  });
  res.json({ data: row });
}));

chainsRouter.delete("/:key", asyncRoute(async (req, res) => {
  const key = req.params.key;
  await db.chainConfig.delete({ where: { key } });
  res.json({ ok: true, key });
}));
