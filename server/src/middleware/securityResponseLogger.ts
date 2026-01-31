/**
 * Security Response Logger
 * 
 * Lightweight middleware that logs security-relevant status codes (401, 403, 429)
 * to prevent double-logging, uses req._securityLogged flag.
 */

import { Request, Response, NextFunction } from "express";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";

/**
 * Middleware to log security-relevant response statuses
 * Only logs if not already logged by specific handlers
 */
export function securityResponseLogger(req: Request, res: Response, next: NextFunction) {
  // Store original end function
  const originalEnd = res.end;

  // Override end to capture status code; return value must match Express Response.end
  res.end = function (chunk?: any, encoding?: any): Response {
    // Only log if not already logged and status is security-relevant
    if (!(req as any)._securityLogged && [401, 403, 429].includes(res.statusCode)) {
      // Log asynchronously (best-effort, non-blocking)
      logSecurityEvent({
        event_type: "security_response",
        user_id: (req as any).user?.id || null,
        ip: getClientIp(req),
        user_agent: getUserAgent(req),
        path: req.path,
        method: req.method,
        status_code: res.statusCode,
        reason: res.statusCode === 401 ? "unauthorized" : res.statusCode === 403 ? "forbidden" : "rate_limited",
      }).catch(() => {}); // Ignore errors
    }

    return originalEnd.call(this, chunk, encoding) as Response;
  };

  next();
}










