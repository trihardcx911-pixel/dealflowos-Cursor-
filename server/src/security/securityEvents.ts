/**
 * Security Event Telemetry
 * 
 * Records authentication and authorization events for:
 * - Auditability
 * - Incident debugging
 * - Future anomaly detection (Phase 5)
 * 
 * All logging is best-effort and must not break requests if DB insert fails.
 */

import { pool } from "../db/pool.js";

export interface SecurityEventPayload {
  event_type: string;
  user_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  path?: string | null;
  method?: string | null;
  status_code?: number | null;
  reason?: string | null;
  meta?: Record<string, any> | null;
}

/**
 * Truncate string to max length
 */
function truncate(str: string | null | undefined, maxLength: number): string | null {
  if (!str) return null;
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength);
}

/**
 * Log a security event (best-effort, non-blocking)
 * 
 * Must never throw.
 * Must not block critical path if possible.
 * Truncates oversized strings to avoid DB bloat.
 * 
 * @param payload - Event payload with all fields
 */
export async function logSecurityEvent(payload: SecurityEventPayload): Promise<void> {
  // Skip telemetry in dev/no-DB mode
  if (process.env.NODE_ENV !== "production" || !process.env.DATABASE_URL) {
    // Silent no-op in dev (comment out to see telemetry events in dev logs)
    // console.log("[TELEMETRY] skipped (dev/no-db):", payload.event_type);
    return;
  }

  // Best-effort logging - never throw or block the request
  try {
    // Truncate oversized strings to prevent DB bloat
    const userAgent = truncate(payload.user_agent, 512);
    const path = truncate(payload.path, 512);
    const reason = truncate(payload.reason, 256);

    await pool.query(
      `INSERT INTO security_events (
        event_type,
        user_id,
        ip,
        user_agent,
        path,
        method,
        status_code,
        reason,
        meta,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        payload.event_type,
        payload.user_id || null,
        payload.ip || null,
        userAgent,
        path,
        payload.method || null,
        payload.status_code || null,
        reason,
        payload.meta ? JSON.stringify(payload.meta) : null,
      ]
    );
  } catch (error: any) {
    // Log to console but don't throw - telemetry must not break requests
    console.error("[TELEMETRY] Failed to log security event:", {
      event_type: payload.event_type,
      error: error.message,
    });
  }
}

/**
 * Extract IP address from Express request
 */
export function getClientIp(req: any): string {
  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown"
  );
}

/**
 * Extract user agent from Express request
 */
export function getUserAgent(req: any): string {
  return req.headers["user-agent"] || "unknown";
}

