import { Router, type Router as ExpressRouter } from "express";
import { authRequired, getUser } from "../lib/auth.js";
import { db } from "@noderails-card/database";
import { asyncRoute } from "../lib/async-route.js";

export const transactionsRouter: ExpressRouter = Router();
transactionsRouter.use(authRequired);

transactionsRouter.get("/", asyncRoute(async (req, res) => {
  const user = getUser(req);
  const txs = await db.transaction.findMany({
    where: { userId: user.sub },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json({ data: txs });
}));
