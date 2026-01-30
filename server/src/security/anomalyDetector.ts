/**
 * Anomaly Detection (Phase 5 - Log-Only)
 * 
 * Detects suspicious patterns in authentication and authorization events.
 * All detection is log-only - no enforcement, no blocking, no user friction.
 * 
 * Must never throw.
 * Must never block request path.
 * Inline checks only (no timers, no background jobs).
 * 
 * Guardrails:
 * - Cooldowns prevent spam and DB amplification
 * - Geo detection explicitly disabled until geo library is integrated
 * - Never logs anomalies with null user_id
 */

import { pool } from "../db/pool.js";
import { logSecurityEvent } from "./securityEvents.js";

/**
 * Extract country from IP
 * 
 * For Phase 5: Returns "unknown" - detection is explicitly disabled until geo library is added.
 * 
 * To enable:
 * 1. Install: npm install geoip-lite @types/geoip-lite
 * 2. Import: import geoip from 'geoip-lite';
 * 3. Replace return with: const geo = geoip.lookup(ip); return geo?.country || "unknown";
 * 
 * Alternative: If behind proxy with geo headers (e.g., Cloudflare CF-IPCountry), use those.
 */
function getCountryFromIp(ip: string): string {
  // Phase 5: Explicitly disabled - returns "unknown" until geo library is integrated
  // Detection will short-circuit when country is "unknown" to prevent false confidence
  return "unknown";
}

/**
 * Check if recent anomaly event exists for user (cooldown check)
 * 
 * Prevents spam and DB amplification by enforcing cooldowns.
 */
async function recentAnomalyExists(
  userId: string,
  eventType: string,
  cooldownMinutes: number
): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM security_events
       WHERE user_id = $1
         AND event_type = $2
         AND created_at > NOW() - INTERVAL '${cooldownMinutes} minutes'`,
      [userId, eventType]
    );

    return parseInt(result.rows[0]?.count || "0", 10) > 0;
  } catch (error: any) {
    // Never throw - return false to allow detection to proceed
    console.error("[ANOMALY] Cooldown check failed:", error.message);
    return false;
  }
}

/**
 * Detect impossible travel (geographic jump between sessions)
 * 
 * Checks if user logged in from different country within short time window.
 * 
 * ⚠️ EXPLICITLY DISABLED until geo library is integrated.
 * Short-circuits when country is "unknown" to prevent false confidence.
 */
export async function detectImpossibleTravel(
  userId: string,
  currentIp: string,
  currentCountry: string
): Promise<void> {
  try {
    // Explicitly disable if geo is not available
    if (currentCountry === "unknown") {
      return; // Do not log anything while geo is unknown
    }

    // Look up most recent successful session for this user
    const result = await pool.query(
      `SELECT ip, created_at 
       FROM security_events 
       WHERE user_id = $1 
         AND event_type = 'auth_session_established'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // No prior session, nothing to compare
      return;
    }

    const previousSession = result.rows[0];
    const previousIp = previousSession.ip;
    const previousCountry = getCountryFromIp(previousIp || "");

    // Explicitly disable if previous country is unknown
    if (previousCountry === "unknown") {
      return; // Do not log anything while geo is unknown
    }

    const previousTime = new Date(previousSession.created_at);
    const currentTime = new Date();
    const minutesBetween = Math.floor((currentTime.getTime() - previousTime.getTime()) / (1000 * 60));

    // Threshold: 2 hours (120 minutes)
    const TRAVEL_THRESHOLD_MINUTES = 120;

    // Check if country changed and time delta is suspiciously short
    if (
      previousCountry !== currentCountry &&
      minutesBetween < TRAVEL_THRESHOLD_MINUTES
    ) {
      // Log anomaly (best-effort, non-blocking)
      logSecurityEvent({
        event_type: "anomaly_impossible_travel",
        user_id: userId,
        ip: currentIp,
        meta: {
          previous_country: previousCountry,
          current_country: currentCountry,
          previous_ip: previousIp,
          current_ip: currentIp,
          minutes_between: minutesBetween,
        },
      }).catch(() => {}); // Ignore errors
    }
  } catch (error: any) {
    // Never throw - detection must not break requests
    console.error("[ANOMALY] Impossible travel detection failed:", error.message);
  }
}

/**
 * Detect IP/User-Agent drift (sudden environment change)
 * 
 * Checks if both IP and user-agent changed from last session.
 * 
 * Guardrail: Cooldown of 30 minutes per user to prevent spam.
 */
export async function detectIdentityShift(
  userId: string,
  currentIp: string,
  currentUserAgent: string
): Promise<void> {
  try {
    // Cooldown: Only log once per user per 30 minutes
    const COOLDOWN_MINUTES = 30;
    if (await recentAnomalyExists(userId, "anomaly_identity_shift", COOLDOWN_MINUTES)) {
      return; // Skip detection during cooldown
    }

    // Look up most recent successful session for this user
    const result = await pool.query(
      `SELECT ip, user_agent 
       FROM security_events 
       WHERE user_id = $1 
         AND event_type = 'auth_session_established'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // No prior session, nothing to compare
      return;
    }

    const previousSession = result.rows[0];
    const previousIp = previousSession.ip;
    const previousUserAgent = previousSession.user_agent;

    // Check if both IP and user-agent changed
    const ipChanged = previousIp && previousIp !== currentIp;
    const uaChanged = previousUserAgent && previousUserAgent !== currentUserAgent;

    if (ipChanged && uaChanged) {
      // Log anomaly (best-effort, non-blocking)
      logSecurityEvent({
        event_type: "anomaly_identity_shift",
        user_id: userId,
        ip: currentIp,
        user_agent: currentUserAgent,
        meta: {
          ip_changed: true,
          ua_changed: true,
          previous_ip: previousIp,
          previous_user_agent: previousUserAgent,
        },
      }).catch(() => {}); // Ignore errors
    }
  } catch (error: any) {
    // Never throw - detection must not break requests
    console.error("[ANOMALY] Identity shift detection failed:", error.message);
  }
}

/**
 * Detect JWT abuse pattern (multiple invalid tokens from different IPs)
 * 
 * Checks if same user has multiple jwt_invalid events from different IPs in short window.
 * 
 * Guardrail: Cooldown of 15 minutes per user. Never logs if userId is null.
 */
export async function detectTokenAbuse(
  userId: string | null,
  currentIp: string
): Promise<void> {
  try {
    // Critical: Never log anomalies with null user_id
    if (!userId) {
      return;
    }

    // Cooldown: Only log once per user per 15 minutes
    const COOLDOWN_MINUTES = 15;
    if (await recentAnomalyExists(userId, "anomaly_token_abuse", COOLDOWN_MINUTES)) {
      return; // Skip detection during cooldown
    }

    // Count recent jwt_invalid events for this user from different IPs
    const WINDOW_MINUTES = 10;
    const THRESHOLD_ATTEMPTS = 5;
    const THRESHOLD_DISTINCT_IPS = 3;

    const result = await pool.query(
      `SELECT COUNT(DISTINCT ip) as distinct_ips, COUNT(*) as total_attempts
       FROM security_events
       WHERE user_id = $1
         AND event_type = 'jwt_invalid'
         AND created_at > NOW() - INTERVAL '${WINDOW_MINUTES} minutes'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const stats = result.rows[0];
    const distinctIps = parseInt(stats.distinct_ips || "0", 10);
    const totalAttempts = parseInt(stats.total_attempts || "0", 10);

    // If threshold exceeded (multiple IPs or high attempt count)
    if (distinctIps >= THRESHOLD_DISTINCT_IPS || totalAttempts >= THRESHOLD_ATTEMPTS) {
      // Log anomaly (best-effort, non-blocking)
      logSecurityEvent({
        event_type: "anomaly_token_abuse",
        user_id: userId,
        ip: currentIp,
        meta: {
          invalid_attempts: totalAttempts,
          distinct_ips: distinctIps,
          window_minutes: WINDOW_MINUTES,
        },
      }).catch(() => {}); // Ignore errors
    }
  } catch (error: any) {
    // Never throw - detection must not break requests
    console.error("[ANOMALY] Token abuse detection failed:", error.message);
  }
}

/**
 * Detect resource probing (repeated BOLA violations across resource types)
 * 
 * Checks if same user generates repeated bola_forbidden across multiple resource types.
 * 
 * Guardrail: Cooldown of 5 minutes per user to prevent DB amplification under attack.
 * Detection is NOT run on every 403 - only evaluates once per cooldown window.
 */
export async function detectResourceProbing(
  userId: string
): Promise<void> {
  try {
    // Cooldown: Only evaluate once per user per 5 minutes
    // This prevents DB amplification when attacker spams 403s
    const COOLDOWN_MINUTES = 5;
    if (await recentAnomalyExists(userId, "anomaly_resource_probing", COOLDOWN_MINUTES)) {
      return; // Skip detection during cooldown
    }

    // Count recent bola_forbidden events for this user, grouped by resource type
    const WINDOW_MINUTES = 30;
    const THRESHOLD_RESOURCE_TYPES = 2; // Must probe at least 2 different resource types
    const THRESHOLD_TOTAL_ATTEMPTS = 5; // Must have at least 5 total attempts

    const result = await pool.query(
      `SELECT 
         COUNT(DISTINCT meta->>'resource_type') as distinct_resource_types,
         COUNT(*) as total_attempts,
         array_agg(DISTINCT meta->>'resource_type') FILTER (WHERE meta->>'resource_type' IS NOT NULL) as resource_types
       FROM security_events
       WHERE user_id = $1
         AND event_type = 'bola_forbidden'
         AND created_at > NOW() - INTERVAL '${WINDOW_MINUTES} minutes'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const stats = result.rows[0];
    const distinctResourceTypes = parseInt(stats.distinct_resource_types || "0", 10);
    const totalAttempts = parseInt(stats.total_attempts || "0", 10);
    const resourceTypes = stats.resource_types || [];

    // If probing multiple resource types with high attempt count
    if (distinctResourceTypes >= THRESHOLD_RESOURCE_TYPES && totalAttempts >= THRESHOLD_TOTAL_ATTEMPTS) {
      // Log anomaly (best-effort, non-blocking)
      logSecurityEvent({
        event_type: "anomaly_resource_probing",
        user_id: userId,
        meta: {
          resource_types: resourceTypes,
          distinct_resource_types: distinctResourceTypes,
          attempts: totalAttempts,
          window_minutes: WINDOW_MINUTES,
        },
      }).catch(() => {}); // Ignore errors
    }
  } catch (error: any) {
    // Never throw - detection must not break requests
    console.error("[ANOMALY] Resource probing detection failed:", error.message);
  }
}

