import { Router, type Router as ExpressRouter } from "express";
import { db } from "@noderails-card/database";
import { asyncRoute } from "../lib/async-route.js";

export const publicRouter: ExpressRouter = Router();

publicRouter.get("/resolve/:alias16", asyncRoute(async (req, res) => {
  const alias16 = req.params.alias16;
  const accounts = await db.account.findMany({
    where: {
      OR: [{ alias16 }, { alias16: `${alias16}1` }]
    },
    select: { alias16: true, chainFamily: true, address: true, userId: true }
  });

  if (!accounts.length) {
    res.status(404).json({ error: "alias_not_found" });
    return;
  }

  const evm = accounts.find((a) => a.chainFamily === "evm")?.address ?? null;
  const solana = accounts.find((a) => a.chainFamily === "solana")?.address ?? null;

  res.json({
    alias16,
    records: {
      evm,
      solana
    },
    // Public resolver response shape for account-number -> chain address style mapping.
    ttlSeconds: 60
  });
}));
