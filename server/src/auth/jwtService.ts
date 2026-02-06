import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const isProd = process.env.NODE_ENV === "production";

/**
 * In production, JWT_SECRET MUST exist.
 * In development, we allow an insecure fallback
 * so the server can boot.
 */
export const JWT_SECRET =
  process.env.JWT_SECRET ??
  (isProd
    ? undefined
    : "DEV_ONLY_INSECURE_JWT_SECRET_DO_NOT_USE_IN_PROD_123456");

if (
  isProd &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
) {
  throw new Error(
    "JWT_SECRET environment variable is required and must be at least 32 characters long"
  );
}

if (!process.env.JWT_SECRET) {
  console.warn("[DEV WARNING] JWT_SECRET not set – using dev auth mode");
}

/** Returns JWT_SECRET for sign/verify; throws if missing (runtime-safe). */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "DEV_ONLY_INSECURE_JWT_SECRET_DO_NOT_USE_IN_PROD_123456");
  if (!secret) throw new Error("JWT_SECRET missing");
  return secret;
}

// JWT TTL: 24h default in production (MVP), 7 days in dev for convenience
// Override via JWT_TTL_SECONDS env var if needed
const DEFAULT_TTL_SECONDS = parseInt(process.env.JWT_TTL_SECONDS || "86400", 10); // 24h
const DEV_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const JWT_TTL_SECONDS = (process.env.NODE_ENV !== "production") ? DEV_TTL_SECONDS : DEFAULT_TTL_SECONDS;


export interface AppTokenPayload {
  iss: string; // Issuer
  sub: string; // Subject (user.id)
  userId: string;
  firebaseUid: string;
  email: string;
  plan: string;
  orgId?: string; // Tenant scope (required in production for tenant-scoped routes)
  jti: string; // JWT ID (unique per token)
  sv: number; // Session version (for forced logout)
  iat: number; // Issued at
  exp: number; // Expiration
}

export interface SessionUser {
  id: string;
  firebase_uid: string;
  email: string;
  plan: string;
  session_version: number;
  orgId?: string; // Tenant scope; in dev use org_dev
}

/**
 * Sign an application session token for a user
 * 
 * @param user - User information to embed in token
 * @returns Signed JWT token string
 */
export function signAppToken(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();
  const payload: AppTokenPayload = {
    iss: "dealflowos",
    sub: user.id,
    userId: user.id,
    firebaseUid: user.firebase_uid,
    email: user.email,
    plan: user.plan,
    ...(user.orgId != null && user.orgId !== "" && { orgId: user.orgId }),
    jti: jti,
    sv: user.session_version, // Session version for forced logout
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  };

  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256" });
}

/**
 * Verify an application session token
 * 
 * @param token - JWT token string to verify
 * @returns Decoded token payload
 * @throws Error if token is invalid, expired, or not a DealflowOS token
 */
export function verifyAppToken(token: string): AppTokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: "dealflowos",
    }) as unknown as AppTokenPayload;

    // Additional validation: ensure it's a DealflowOS token
    if (decoded.iss !== "dealflowos") {
      throw new Error("Invalid token issuer");
    }

    return decoded;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token signature or format");
    }
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

/**
 * Get JWT_SECRET debug info (DEV-only, for diagnostics)
 * Returns only length and env source, never the actual secret
 */
export function getJwtSecretMeta(): { jwtSecretLength: number; usingEnv: boolean } {
  const usingEnv = !!process.env.JWT_SECRET;
  const length = JWT_SECRET ? JWT_SECRET.length : 0;
  return { jwtSecretLength: length, usingEnv };
}

