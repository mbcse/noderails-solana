import { Router, type Router as ExpressRouter } from "express";
import { authRequired } from "../lib/auth.js";
import { z } from "zod";
import { db } from "@noderails-card/database";
import { asyncRoute } from "../lib/async-route.js";

export const dappsRouter: ExpressRouter = Router();
dappsRouter.use(authRequired);

const createDappSchema = z.object({
  name: z.string().min(2),
  origin: z.string().url()
});

dappsRouter.get("/", asyncRoute(async (_req, res) => {
  const data = await db.dApp.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ data });
}));

dappsRouter.post("/", asyncRoute(async (req, res) => {
  const parsed = createDappSchema.parse(req.body);
  const row = await db.dApp.create({
    data: { name: parsed.name, origin: parsed.origin, status: "unverified" }
  });
  res.status(201).json({
    id: row.id,
    status: row.status
  });
}));
