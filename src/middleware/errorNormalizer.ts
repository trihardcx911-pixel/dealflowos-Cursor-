/**
 * Global Error Normalizer Middleware
 * Ensures consistent error response shape across all routes
 */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { DomainError } from "../domain/leads";
import { Prisma } from "@prisma/client";

interface NormalizedError {
  error: string;
  code: string;
  status: number;
  details?: any;
  requestId?: string;
}

/**
 * Normalize any error into a consistent response shape
 */
export function errorNormalizer(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  const normalized = normalizeError(err);
  
  // Log error (in production, use proper logger)
  console.error("[ERR]", {
    code: normalized.code,
    message: normalized.error,
    path: req.path,
    method: req.method,
    requestId: req.requestId,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });

  return res.status(normalized.status).json({
    error: normalized.error,
    code: normalized.code,
    details: normalized.details,
    request_id: req.requestId,
  });
}

/**
 * Normalize different error types
 */
function normalizeError(err: any): NormalizedError {
  // Zod validation errors
  if (err instanceof ZodError) {
    return {
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      status: 400,
      details: err.flatten(),
    };
  }

  // Domain errors
  if (err instanceof DomainError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      DUPLICATE_LEAD: 409,
      DUPLICATE_DEAL: 409,
      INVALID_STATE: 400,
      INVALID_TRANSITION: 400,
    };

    return {
      error: err.message,
      code: err.code,
      status: statusMap[err.code] || 400,
      details: err.details,
    };
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return normalizePrismaError(err);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      error: "Database validation error",
      code: "DB_VALIDATION_ERROR",
      status: 400,
    };
  }

  // Express body-parser errors
  if (err.type === "entity.parse.failed") {
    return {
      error: "Invalid JSON in request body",
      code: "INVALID_JSON",
      status: 400,
    };
  }

  // JWT/Auth errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return {
      error: "Invalid or expired token",
      code: "UNAUTHENTICATED",
      status: 401,
    };
  }

  // Generic error with status
  if (err.status || err.statusCode) {
    return {
      error: err.message || "An error occurred",
      code: err.code || "ERROR",
      status: err.status || err.statusCode,
    };
  }

  // Unknown errors - don't leak internal details in production
  return {
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message || "Unknown error",
    code: "INTERNAL_ERROR",
    status: 500,
  };
}

/**
 * Normalize Prisma-specific errors
 */
function normalizePrismaError(err: Prisma.PrismaClientKnownRequestError): NormalizedError {
  switch (err.code) {
    case "P2002": // Unique constraint violation
      const field = (err.meta?.target as string[])?.join(", ") || "field";
      return {
        error: `Duplicate value for ${field}`,
        code: "DUPLICATE_ENTRY",
        status: 409,
        details: { field },
      };

    case "P2025": // Record not found
      return {
        error: "Record not found",
        code: "NOT_FOUND",
        status: 404,
      };

    case "P2003": // Foreign key constraint violation
      return {
        error: "Related record not found",
        code: "FOREIGN_KEY_ERROR",
        status: 400,
      };

    case "P2014": // Required relation violation
      return {
        error: "Required relation missing",
        code: "RELATION_ERROR",
        status: 400,
      };

    default:
      return {
        error: "Database error",
        code: `DB_ERROR_${err.code}`,
        status: 500,
      };
  }
}

/**
 * Async handler wrapper to catch errors automatically
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}










