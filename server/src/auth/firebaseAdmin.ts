/**
 * Firebase Admin SDK Initialization
 * Used for server-side token verification
 *
 * CRITICAL: This module enforces a single, properly-credentialed Firebase Admin instance.
 * In production, FIREBASE_SERVICE_ACCOUNT_JSON is REQUIRED.
 */

import { initializeApp, getApps, deleteApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const isProd = process.env.NODE_ENV === 'production';
const EXPECTED_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

// Single source of truth - set once at module load, never reassigned
let certifiedApp: any = null;
let certifiedAuth: any = null;

/**
 * Initialize Firebase Admin SDK with explicit credentials.
 *
 * INVARIANTS:
 * - In production: MUST use cert(serviceAccount) - no fallbacks
 * - Existing apps without proper credentials are DELETED
 * - Single app instance enforced
 */
function initializeFirebaseAdmin(): { app: any; auth: any } {
  // Already initialized with certified credentials
  if (certifiedApp && certifiedAuth) {
    return { app: certifiedApp, auth: certifiedAuth };
  }

  // Validate project ID
  if (!EXPECTED_PROJECT_ID) {
    const msg = '[FIREBASE] FATAL: Missing FIREBASE_PROJECT_ID environment variable';
    console.error(msg);
    throw new Error(msg);
  }

  // Get service account JSON (required in production)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  // Production MUST have explicit credentials
  if (isProd && !serviceAccountJson && !serviceAccountPath) {
    const msg = '[FIREBASE] FATAL: Production requires FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH';
    console.error(msg);
    throw new Error(msg);
  }

  // Parse service account credentials
  let serviceAccount: any = null;
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e: any) {
      const msg = `[FIREBASE] FATAL: Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON: ${e.message}`;
      console.error(msg);
      throw new Error(msg);
    }
  } else if (serviceAccountPath) {
    try {
      serviceAccount = require(serviceAccountPath);
    } catch (e: any) {
      const msg = `[FIREBASE] FATAL: Cannot load service account from path: ${e.message}`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  // Validate service account projectId matches expected
  if (serviceAccount && serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
    const msg = `[FIREBASE] FATAL: Service account project_id mismatch. Expected: ${EXPECTED_PROJECT_ID}, Got: ${serviceAccount.project_id}`;
    console.error(msg);
    throw new Error(msg);
  }

  // CRITICAL: Delete any existing apps that may be misconfigured
  // This prevents reuse of apps initialized without cert() credentials
  const existingApps = getApps();
  if (existingApps.length > 0) {
    console.warn(`[FIREBASE] Found ${existingApps.length} existing app(s). Deleting to ensure proper credentials.`);
    for (const app of existingApps) {
      try {
        deleteApp(app);
        console.log(`[FIREBASE] Deleted existing app: ${app.name}`);
      } catch (e: any) {
        console.warn(`[FIREBASE] Failed to delete app ${app.name}: ${e.message}`);
      }
    }
  }

  // Initialize with explicit credentials
  console.log('[FIREBASE] Initializing with:', {
    projectId: EXPECTED_PROJECT_ID,
    hasServiceAccount: !!serviceAccount,
    serviceAccountProjectId: serviceAccount?.project_id || null,
    isProd,
  });

  let app: any;
  if (serviceAccount) {
    // Production path: explicit cert() credentials
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: EXPECTED_PROJECT_ID,
    });
    console.log('[FIREBASE] Initialized with cert(serviceAccount)');
  } else {
    // Development-only fallback: projectId only (uses ADC or emulator)
    console.warn('[FIREBASE] DEV MODE: Initializing without explicit credentials (ADC/emulator)');
    app = initializeApp({
      projectId: EXPECTED_PROJECT_ID,
    });
  }

  const auth = getAuth(app);

  // Store as single source of truth
  certifiedApp = app;
  certifiedAuth = auth;

  console.log('[FIREBASE] Admin SDK initialized successfully');
  return { app, auth };
}

/**
 * Get Firebase Admin Auth instance.
 * Guaranteed to be from a properly-credentialed app.
 */
export function getAdminAuth(): any {
  const { auth } = initializeFirebaseAdmin();
  return auth;
}

/**
 * Verify Firebase ID token.
 * Includes diagnostic logging on failure (no secrets).
 */
export async function verifyIdToken(idToken: string): Promise<any> {
  const auth = getAdminAuth();

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    // Diagnostic logging on failure (production-safe, no secrets)
    console.error('[FIREBASE] Token verification FAILED:', {
      errorCode: error.code || 'unknown',
      errorMessage: error.message || 'unknown',
      expectedProjectId: EXPECTED_PROJECT_ID,
      // Log app config for diagnosis (no secrets)
      appProjectId: certifiedApp?.options?.projectId || 'not-set',
      hasCredential: !!certifiedApp?.options?.credential,
    });

    // Extract token claims for diagnosis (no full token logged)
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.error('[FIREBASE] Token claims (for diagnosis):', {
          aud: payload.aud,
          iss: payload.iss,
          exp: payload.exp,
          iat: payload.iat,
          expiredAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown',
          issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'unknown',
          nowUtc: new Date().toISOString(),
        });

        // Check for common mismatches
        if (payload.aud !== EXPECTED_PROJECT_ID) {
          console.error(`[FIREBASE] MISMATCH: token.aud (${payload.aud}) !== FIREBASE_PROJECT_ID (${EXPECTED_PROJECT_ID})`);
        }
        const expectedIss = `https://securetoken.google.com/${EXPECTED_PROJECT_ID}`;
        if (payload.iss !== expectedIss) {
          console.error(`[FIREBASE] MISMATCH: token.iss (${payload.iss}) !== expected (${expectedIss})`);
        }
      }
    } catch (parseErr) {
      console.error('[FIREBASE] Could not parse token for diagnosis');
    }

    // Re-throw with original error details preserved
    throw new Error(`Firebase token verification failed: ${error.code || 'UNKNOWN'} - ${error.message}`);
  }
}

/**
 * Create a Firebase session cookie from an ID token.
 * Used for HttpOnly session cookies (Vercel ↔ Render).
 *
 * @param idToken - Firebase ID token from client
 * @param expiresInMs - Session duration in milliseconds (max 14 days)
 * @returns Session cookie string
 */
export async function createSessionCookie(idToken: string, expiresInMs: number): Promise<string> {
  const auth = getAdminAuth();
  const expiresInSeconds = Math.floor(expiresInMs / 1000);
  try {
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: expiresInSeconds });
    return sessionCookie;
  } catch (error: any) {
    console.error('[FIREBASE] Session cookie creation FAILED:', {
      errorCode: error.code || 'unknown',
      errorMessage: error.message || 'unknown',
    });
    throw new Error(`Session cookie creation failed: ${error.code || 'UNKNOWN'} - ${error.message}`);
  }
}

/**
 * Verify a Firebase session cookie.
 *
 * @param sessionCookie - Session cookie from request (never log contents)
 * @param checkRevoked - Whether to check if the session has been revoked
 * @returns Decoded claims (e.g. uid, email)
 */
export async function verifySessionCookie(sessionCookie: string, checkRevoked: boolean = true): Promise<any> {
  const auth = getAdminAuth();
  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, checkRevoked);
    return decodedClaims;
  } catch (error: any) {
    console.error("[FIREBASE] Session cookie verification FAILED:", {
      errorCode: error.code || "unknown",
      errorMessage: error.message || "unknown",
      checkRevoked,
    });
    throw new Error(`Session cookie verification failed: ${error.code || "UNKNOWN"} - ${error.message}`);
  }
}

// STARTUP VALIDATION: In production, initialize immediately to fail fast
if (isProd) {
  try {
    console.log('[FIREBASE] Production startup validation...');
    initializeFirebaseAdmin();
    console.log('[FIREBASE] Startup validation PASSED');
  } catch (e: any) {
    console.error('[FIREBASE] Startup validation FAILED:', e.message);
    // In production, a misconfigured Firebase Admin is fatal
    process.exit(1);
  }
}

// Export for testing/debugging only
export { certifiedApp as adminApp };
