import type { NextFunction, Request, Response } from "express";
import pino from "pino";

export const logger = pino({ name: "noderails-card" });

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

function errorLogFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: string; meta?: unknown };
    return {
      name: err.name,
      message: err.message,
      ...(typeof anyErr.code === "string" ? { code: anyErr.code } : {}),
      ...(anyErr.meta !== undefined ? { meta: anyErr.meta } : {})
    };
  }
  return { message: String(err) };
}

export function jsonErrorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(errorLogFields(err), "request failed");
  const maybe = err as { code?: string; message?: string; statusCode?: number };
  if (maybe.statusCode) {
    res.status(maybe.statusCode).json({ error: maybe.code ?? "request_error", message: maybe.message });
    return;
  }
  res.status(500).json({ error: "internal_error" });
}

export function requireIdempotency(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "POST" && !req.header("idempotency-key")) {
    res.status(400).json({ error: "idempotency_key_required" });
    return;
  }
  next();
}
