import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { redis } from "@noderails-card/redis";
import { config } from "../config.js";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computePanLookupHash(panDigits: string): string {
  const digits = panDigits.replace(/\D/g, "");
  const pepper =
    process.env.CARD_PAN_LOOKUP_PEPPER?.trim() || "wallcard_dev_pan_lookup_pepper_v1_change_in_prod";
  return sha256Hex(`${pepper}:${digits}`);
}

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = req.ip ?? "unknown";
    const key = `rl:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > config.RATE_LIMIT_PER_MINUTE) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[api] rate_limit_redis_skip]", msg);
  }
  next();
}
