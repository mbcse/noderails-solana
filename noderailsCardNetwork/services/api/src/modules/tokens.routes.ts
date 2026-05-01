import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { db } from "@noderails-card/database";
import { authRequired } from "../lib/auth.js";
import { seedDefaultTokens } from "../lib/token-seed.js";
import { asyncRoute } from "../lib/async-route.js";

const tokenCreateSchema = z.object({
  chainKey: z.string().min(2).max(64),
  symbol: z.string().min(1).max(32),
  kind: z.enum(["erc20", "spl"]),
  contractAddress: z.string().min(2).max(128),
  decimals: z.number().int().min(0).max(18).optional(),
  isEnabled: z.boolean().optional()
});

const tokenUpdateSchema = tokenCreateSchema.partial();

export const tokensRouter: ExpressRouter = Router();
tokensRouter.use(authRequired);

tokensRouter.post("/seed", asyncRoute(async (_req, res) => {
  const n = await seedDefaultTokens();
  res.json({ ok: true, tokensSeeded: n });
}));

tokensRouter.get("/", asyncRoute(async (req, res) => {
  const chainKey = typeof req.query.chainKey === "string" ? req.query.chainKey : undefined;
  const data = await db.tokenConfig.findMany({
    where: chainKey ? { chainKey } : undefined,
    orderBy: [{ chainKey: "asc" }, { symbol: "asc" }]
  });
  res.json({ data });
}));

tokensRouter.post("/", asyncRoute(async (req, res) => {
  const parsed = tokenCreateSchema.parse(req.body);
  const chain = await db.chainConfig.findUnique({ where: { key: parsed.chainKey } });
  if (!chain) {
    res.status(400).json({ error: "unknown_chain_key", message: `No chain with key "${parsed.chainKey}". Create it first.` });
    return;
  }
  if (parsed.kind === "erc20" && chain.family !== "evm") {
    res.status(400).json({ error: "kind_mismatch", message: "erc20 tokens require an EVM chain." });
    return;
  }
  if (parsed.kind === "spl" && chain.family !== "solana") {
    res.status(400).json({ error: "kind_mismatch", message: "spl tokens require a Solana chain." });
    return;
  }
  const row = await db.tokenConfig.create({
    data: {
      chainKey: parsed.chainKey,
      symbol: parsed.symbol,
      kind: parsed.kind,
      contractAddress: parsed.contractAddress,
      decimals: parsed.decimals ?? null,
      isEnabled: parsed.isEnabled ?? true
    }
  });
  res.status(201).json({ data: row });
}));

tokensRouter.patch("/:id", asyncRoute(async (req, res) => {
  const parsed = tokenUpdateSchema.parse(req.body);
  const id = req.params.id;
  const existing = await db.tokenConfig.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (parsed.chainKey !== undefined && parsed.chainKey !== existing.chainKey) {
    const chain = await db.chainConfig.findUnique({ where: { key: parsed.chainKey } });
    if (!chain) {
      res.status(400).json({ error: "unknown_chain_key", message: `No chain with key "${parsed.chainKey}".` });
      return;
    }
  }
  const nextKind = parsed.kind ?? existing.kind;
  const nextChainKey = parsed.chainKey ?? existing.chainKey;
  const chain = await db.chainConfig.findUnique({ where: { key: nextChainKey } });
  if (!chain) {
    res.status(400).json({ error: "unknown_chain_key" });
    return;
  }
  if (nextKind === "erc20" && chain.family !== "evm") {
    res.status(400).json({ error: "kind_mismatch", message: "erc20 tokens require an EVM chain." });
    return;
  }
  if (nextKind === "spl" && chain.family !== "solana") {
    res.status(400).json({ error: "kind_mismatch", message: "spl tokens require a Solana chain." });
    return;
  }
  const row = await db.tokenConfig.update({
    where: { id },
    data: parsed
  });
  res.json({ data: row });
}));

tokensRouter.delete("/:id", asyncRoute(async (req, res) => {
  const id = req.params.id;
  await db.tokenConfig.delete({ where: { id } });
  res.json({ ok: true, id });
}));
