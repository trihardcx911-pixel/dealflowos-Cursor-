import { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ensureUserProvisioned } from "../services/ensureUserProvisioned";
import { env } from "../config/env";

const JWKS = env.SUPABASE_JWKS_URL ? createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL)) : null;

export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    // Dev bypass for local testing
    if (env.DEV_AUTH_BYPASS === true || env.DEV_AUTH_BYPASS === "true") {
      const userId = req.header("x-dev-user-id") || "u_demo";
      const email = req.header("x-dev-user-email") || "demo@example.com";
      const org = await ensureUserProvisioned(userId, email);
      
      if (!org.orgId) {
        return res.status(401).json({ error: "Missing orgId in auth context" });
      }
      
      req.auth = { userId, email, orgId: org.orgId };
      req.context = { orgId: org.orgId, userId };
      return next();
    }

    // Real JWT path
    const hdr = req.header("authorization");
    if (!hdr?.startsWith("Bearer ")) {
      return res.status(401).json({ code: "UNAUTHENTICATED", message: "Missing token", request_id: req.requestId });
    }

    const token = hdr.slice("Bearer ".length);
    if (!JWKS) {
      return res.status(500).json({ code: "SERVER_CONFIG", message: "JWKS not configured", request_id: req.requestId });
    }

    const { payload } = await jwtVerify(token, JWKS, { algorithms: ["RS256"] });
    const userId = String(payload.sub || "");
    const email = String(payload.email || "");
    
    if (!userId || !email) {
      return res.status(401).json({ code: "UNAUTHENTICATED", message: "Invalid token", request_id: req.requestId });
    }

    const org = await ensureUserProvisioned(userId, email);
    
    if (!org.orgId) {
      return res.status(401).json({ error: "Missing orgId in auth context" });
    }
    
    req.auth = { userId, email, orgId: org.orgId };
    req.context = { orgId: org.orgId, userId };
    next();
  } catch (err) {
    next(err);
  }
}

// Middleware to ensure auth is present
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.orgId || !req.auth?.userId) {
    return res.status(401).json({ error: "Missing orgId or userId in auth context" });
  }
  next();
}
