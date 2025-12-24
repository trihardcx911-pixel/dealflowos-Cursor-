import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/node";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Zod validation
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "ValidationError",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  // Prisma unique constraint
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return res.status(409).json({ error: "Conflict", message: "Resource already exists" });
  }

  // Fallback
  Sentry.captureException?.(err);
  return res.status(500).json({ error: "InternalServerError" });
};
