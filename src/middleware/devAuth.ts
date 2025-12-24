import type { Request, Response, NextFunction } from "express";

export function devAuth(req: Request, _res: Response, next: NextFunction) {
  const id = req.headers["x-dev-user-id"];
  const email = req.headers["x-dev-user-email"];
  if (id && email) {
    req.user = { id: String(id), email: String(email) };
  }
  next();
}
