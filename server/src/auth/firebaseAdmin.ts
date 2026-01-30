/**
 * Firebase Admin SDK Initialization
 * Used for server-side token verification
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment variables
 */
function initializeFirebaseAdmin(): App {
  if (adminApp) {
    return adminApp;
  }

  // Check if already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    adminAuth = getAuth(adminApp);
    return adminApp;
  }

  // Initialize with service account credentials
  // For development, we can use the project ID and let Admin SDK use Application Default Credentials
  // For production, use a service account JSON file
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID environment variable is required');
  }

  // Try to initialize with service account credentials if available
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  
  if (serviceAccountPath) {
    // Use service account file path
    const serviceAccount = require(serviceAccountPath);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else if (serviceAccountJson) {
    // Use service account JSON string (from environment variable)
    const serviceAccount = JSON.parse(serviceAccountJson);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else {
    // Use Application Default Credentials (for local dev with gcloud auth)
    // Or use project ID only (for emulator or when using default credentials)
    adminApp = initializeApp({
      projectId,
    });
  }

  adminAuth = getAuth(adminApp);
  return adminApp;
}

/**
 * Get Firebase Admin Auth instance
 */
export function getAdminAuth(): Auth {
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

