import type { Request, Response, NextFunction } from "express";
import type { ErrorResponse } from "../types/ErrorResponse";

export class AppError extends Error {
  code: string;
  hint?: string;
  docs_url?: string;
  status: number;
  constructor(code: string, message: string, status = 400, hint?: string, docs_url?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.hint = hint;
    this.docs_url = docs_url;
  }
}

export function errorMiddleware(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = typeof err.status === "number" ? err.status : 500;
  const payload: ErrorResponse = {
    code: err.code || "INTERNAL_ERROR",
    message: err.message || "Something went wrong",
    hint: err.hint,
    docs_url: err.docs_url,
    request_id: req.requestId || "",
  };
  res.status(status).json(payload);
}
