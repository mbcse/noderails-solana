import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "@noderails-card/common";
import { Prisma } from "@noderails-card/database";

/**
 * Maps common errors before the generic logger; keeps tsx/dev output readable.
 */
export const apiErrorHandler: ErrorRequestHandler = (err, _req, res, next): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "validation_failed", issues: err.flatten() });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(400).json({
      error: err.code,
      message: err.message,
      ...(err.meta !== undefined ? { meta: err.meta } : {})
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: "prisma_validation_error", message: err.message });
    return;
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    res.status(503).json({ error: "database_unavailable", message: err.message });
    return;
  }
  next(err);
};
