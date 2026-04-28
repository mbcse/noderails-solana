import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "@noderails-card/common";

const jwtSecret: Secret = process.env.JWT_SECRET ?? "dev_secret";
type JwtPayload = { sub: string; email: string };

export function signAccessToken(payload: JwtPayload, opts?: { expiresIn?: string }): string {
  const options = { expiresIn: opts?.expiresIn ?? "12h" } as SignOptions;
  return jwt.sign(payload, jwtSecret, options);
}

export function authRequired(req: Request, _res: Response, next: NextFunction): void {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    next(new AppError("Missing token", "unauthorized", 401));
    return;
  }
  try {
    const data = jwt.verify(token, jwtSecret) as JwtPayload;
    (req as Request & { user: JwtPayload }).user = data;
    next();
  } catch {
    next(new AppError("Invalid token", "unauthorized", 401));
  }
}

export function getUser(req: Request): JwtPayload {
  return (req as Request & { user: JwtPayload }).user;
}
