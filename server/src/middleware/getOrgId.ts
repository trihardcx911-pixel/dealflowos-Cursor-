import { Request } from "express";

/**
 * Canonical orgId extraction for DFOS routes.
 *
 * Priority:
 * 1. req.orgId (set by auth middleware)
 * 2. In dev mode only: x-dev-org-id header (when no Authorization present)
 * 3. Fallback: "default-org" for dev mode, throws in production
 *
 * Usage:
 *   import { getOrgId } from "../middleware/getOrgId";
 *   const orgId = getOrgId(req);
 *
 * GUARDRAIL: Do not use (req as any).orgId or inline header access.
 * GUARDRAIL: Do not access x-dev-org-id directly in route handlers.
 */

interface AuthenticatedRequest extends Request {
  orgId?: string;
  userId?: string;
}

/**
 * Runtime dev mode check - requires BOTH conditions:
 * 1. NODE_ENV === "development"
 * 2. DEV_AUTH_BYPASS === "1"
 *
 * This prevents accidental dev behavior in production if only one flag is set.
 */
function isDevMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
}

export function getOrgId(req: AuthenticatedRequest): string {
  // 1. Prefer orgId set by auth middleware
  if (req.orgId) {
    return req.orgId;
  }

  // 2. In dev mode, allow x-dev-org-id header ONLY if no Authorization present
  if (isDevMode()) {
    const hasAuth = !!req.headers.authorization;
    if (!hasAuth) {
      const devOrgId = req.headers["x-dev-org-id"];
      if (typeof devOrgId === "string" && devOrgId.length > 0) {
        return devOrgId;
      }
    }
    // Dev fallback
    return "default-org";
  }

  // 3. Production: require orgId from auth
  throw new Error("orgId not found in request. Ensure auth middleware is applied.");
}

export function getUserId(req: AuthenticatedRequest): string {
  if (req.userId) {
    return req.userId;
  }

  if (isDevMode()) {
    const devUserId = req.headers["x-dev-user-id"];
    if (typeof devUserId === "string" && devUserId.length > 0) {
      return devUserId;
    }
    return "dev-user";
  }

  throw new Error("userId not found in request. Ensure auth middleware is applied.");
}
