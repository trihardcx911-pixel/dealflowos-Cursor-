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
import { randomUUID } from "crypto";

export type SecurityEventType =
  | "login_success"
  | "login_fail"
  | "session_created"
  | "session_refreshed"
  | "access_denied"
  | "trial_expired"
  | "account_disabled"
  | "invalid_plan"
  | "rate_limit_exceeded"
  | "billing_customer_created"
  | "billing_webhook_received";

export interface SecurityEventMetadata {
  [key: string]: any;
}

/**
 * Log a security event (best-effort, non-blocking)
 * 
 * @param eventType - Type of security event
 * @param options - Event details
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  options: {
    userId?: string;
    firebaseUid?: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    metadata?: SecurityEventMetadata;
  }
): Promise<void> {
  // Best-effort logging - never throw or block the request
  try {
    const requestId = options.requestId || randomUUID();

    await pool.query(
      `INSERT INTO "SecurityEvent" (
        event_type,
        user_id,
        firebase_uid,
        ip,
        user_agent,
        request_id,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        eventType,
        options.userId || null,
        options.firebaseUid || null,
        options.ip || null,
        options.userAgent || null,
        requestId,
        options.metadata ? JSON.stringify(options.metadata) : null,
      ]
    );
  } catch (error: any) {
    // Log to console but don't throw - telemetry must not break requests
    console.error("[TELEMETRY] Failed to log security event:", {
      eventType,
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










