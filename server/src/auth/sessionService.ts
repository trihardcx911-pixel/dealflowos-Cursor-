/**
 * Session Service
 * 
 * Reusable logic for verifying Firebase tokens and establishing application sessions.
 * Used by both the /api/auth/session endpoint and the requireAuth middleware.
 */

import { verifyIdToken } from "./firebaseAdmin.js";
import { pool } from "../db/pool.js";
import { signAppToken } from "./jwtService.js";

export interface SessionUser {
  id: string;
  orgId?: string;
  firebase_uid: string;
  email: string;
  plan: string;
  status: string;
  onboarding_complete: boolean;
  session_version?: number;
}

export interface SessionAccess {
  allowed: boolean;
  reason?: string;
}

export interface SessionResult {
  user: SessionUser;
  access: SessionAccess;
  app_session_token?: string; // JWT token for subsequent requests
}

/**
 * Establish a session from a Firebase ID token
 * 
 * @param idToken - Firebase ID token from client
 * @returns Session result with user and access information
 * @throws Error if token is invalid or user creation fails
 */
export async function establishSession(idToken: string): Promise<SessionResult> {
  // Step 1: Verify Firebase token
  let decodedToken;
  try {
    decodedToken = await verifyIdToken(idToken);
  } catch (error: any) {
    throw new Error(`Firebase token verification failed: ${error.message}`);
  }

  // Extract user information from decoded token
  const firebaseUid = decodedToken.uid;
  const email = decodedToken.email;
  const name = decodedToken.name || null;
  const photoUrl = decodedToken.picture || null;

  if (!email) {
    throw new Error('Email is required but not provided by Firebase');
  }

  // Step 2: Lookup user in database
  const userLookupResult = await pool.query(
    `SELECT * FROM "User" WHERE firebase_uid = $1`,
    [firebaseUid]
  );

  let user;
  const now = new Date();

  if (userLookupResult.rows.length === 0) {
    // Step 3: Create new user if doesn't exist
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

    // Generate a unique ID compatible with Prisma's cuid() format
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    const userId = `c${timestamp}${random}`.substring(0, 25);

    const insertResult = await pool.query(
      `INSERT INTO "User" (
        id, email, firebase_uid, display_name, photo_url,
        plan, status, trial_started_at, trial_ends_at, onboarding_complete,
        session_version, lock_state,
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12,
        $13, $13
      ) RETURNING 
        id, email, firebase_uid, display_name, photo_url,
        plan, status, trial_started_at, trial_ends_at, onboarding_complete,
        session_version, disabled_at, lock_state, lock_reason, lock_expires_at,
        "createdAt", "updatedAt"`,
      [
        userId,
        email,
        firebaseUid,
        name,
        photoUrl,
        'trial', // plan
        'active', // status
        now, // trial_started_at
        trialEndsAt, // trial_ends_at
        false, // onboarding_complete
        1, // session_version (default)
        'none', // lock_state (default)
        now, // createdAt/updatedAt
      ]
    );

    user = insertResult.rows[0];
    console.log('[AUTH] Created new user:', user.id);
  } else {
    // Step 4: Update existing user metadata (safe fields only)
    user = userLookupResult.rows[0];

    // Update display_name and photo_url if they've changed
    if (user.display_name !== name || user.photo_url !== photoUrl) {
      const updateResult = await pool.query(
        `UPDATE "User" 
         SET display_name = $1, photo_url = $2, "updatedAt" = $3
         WHERE id = $4
         RETURNING 
           id, email, firebase_uid, display_name, photo_url,
           plan, status, trial_started_at, trial_ends_at, onboarding_complete,
           session_version, disabled_at, lock_state, lock_reason, lock_expires_at,
           "createdAt", "updatedAt"`,
        [name, photoUrl, now, user.id]
      );
      user = updateResult.rows[0];
      console.log('[AUTH] Updated user metadata:', user.id);
    }
  }

  // Step 5: Compute access permissions
  let allowed = false;
  let reason: string | null = null;

  if (user.status !== 'active') {
    allowed = false;
    reason = 'account_disabled';
  } else if (user.plan === 'trial') {
    // Check if trial has expired
    if (user.trial_ends_at) {
      const trialEndDate = new Date(user.trial_ends_at);
      allowed = now < trialEndDate;
      if (!allowed) {
        reason = 'trial_expired';
      }
    } else {
      // No trial end date set, allow access
      allowed = true;
    }
  } else if (['bronze', 'silver', 'gold'].includes(user.plan)) {
    allowed = true;
  } else {
    allowed = false;
    reason = 'invalid_plan';
  }

  const sessionResult: SessionResult = {
    user: {
      id: user.id,
      orgId: user.id, // MVP: 1:1 mapping (userId = orgId for single-user orgs)
      firebase_uid: user.firebase_uid,
      email: user.email,
      plan: user.plan,
      status: user.status,
      onboarding_complete: user.onboarding_complete || false,
      session_version: user.session_version || 1,
    },
    access: {
      allowed,
      ...(reason && { reason }),
    },
  };

  // Generate JWT app session token if access is allowed
  if (allowed) {
    // Read session_version from user row (defaults to 1 if not set)
    const sessionVersion = user.session_version || 1;
    
    sessionResult.app_session_token = signAppToken({
      id: user.id,
      firebase_uid: user.firebase_uid,
      email: user.email,
      plan: user.plan,
      session_version: sessionVersion,
      orgId: sessionResult.user.orgId, // MVP: 1:1 until real org membership exists
    });
  }

  return sessionResult;
}

