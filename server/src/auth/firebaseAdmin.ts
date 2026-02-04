/**
 * Firebase Admin SDK Initialization
 * Used for server-side token verification
 */

import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: any = null;
let adminAuth: any = null;

const isProd = process.env.NODE_ENV === 'production';

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment variables
 */
function initializeFirebaseAdmin(): any {
  if (adminApp) {
    return adminApp;
  }

  // Check if already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    adminAuth = getAuth(adminApp);
    console.log('[FIREBASE] Using existing app instance');
    return adminApp;
  }

  // Initialize with service account credentials
  // For development, we can use the project ID and let Admin SDK use Application Default Credentials
  // For production, use a service account JSON file
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    console.error('[FIREBASE] FATAL: Missing FIREBASE_PROJECT_ID');
    throw new Error('FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID environment variable is required');
  }

  // Try to initialize with service account credentials if available
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  // Diagnostic logging (safe - no secrets)
  console.log('[FIREBASE] Initialization:', {
    projectId,
    hasServiceAccountPath: !!serviceAccountPath,
    hasServiceAccountJson: !!serviceAccountJson,
    hasGoogleAppCreds: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    isProd,
  });

  if (serviceAccountPath) {
    // Use service account file path
    console.log('[FIREBASE] Using service account from file path');
    const serviceAccount = require(serviceAccountPath);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else if (serviceAccountJson) {
    // Use service account JSON string (from environment variable)
    console.log('[FIREBASE] Using service account from JSON env var');
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (parseError: any) {
      console.error('[FIREBASE] FATAL: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseError.message);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON - JSON parse failed');
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use Application Default Credentials (ADC) - works on GCP or with GOOGLE_APPLICATION_CREDENTIALS
    console.log('[FIREBASE] Using Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)');
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  } else if (!isProd) {
    // Development fallback: project ID only (for emulator or gcloud CLI auth)
    console.log('[FIREBASE] DEV MODE: Using project ID only (no explicit credentials)');
    adminApp = initializeApp({
      projectId,
    });
  } else {
    // Production without credentials - this will fail token verification
    console.error('[FIREBASE] FATAL: Production requires service account credentials');
    console.error('[FIREBASE] Set one of: FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS');
    throw new Error(
      'Firebase Admin SDK requires credentials in production. ' +
      'Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH environment variable.'
    );
  }

  adminAuth = getAuth(adminApp);
  console.log('[FIREBASE] Admin SDK initialized successfully');
  return adminApp;
}

/**
 * Get Firebase Admin Auth instance
 */
export function getAdminAuth(): any {
  if (!adminAuth) {
    initializeFirebaseAdmin();
  }
  return adminAuth!;
}

/**
 * Verify Firebase ID token
 * @param idToken - Firebase ID token from client
 * @returns Decoded token with user information
 */
export async function verifyIdToken(idToken: string) {
  const auth = getAdminAuth();
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    throw new Error(`Firebase token verification failed: ${error.message}`);
  }
}

export { adminApp };

