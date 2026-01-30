# Implementation Plan: Fix 401 Auth + Add Secure Email Change + Password Reset From Settings

## Executive Summary

**Root Cause:** Dev login (`/auth/login`) returns placeholder token `"dev-jwt-token-*"` which is not a valid JWT. `requireAuth` middleware expects a real signed JWT (`verifyAppToken`), causing 401 errors.

**Solution:** Make dev login return a real signed JWT using `signAppToken()`. Then implement secure email change and password reset flows using Firebase Auth APIs.

**Architecture Decision:** Use **Option 2** (Backend issues app JWT after verifying Firebase token once). The `/api/auth/session` endpoint already exists and returns `app_session_token`; we need to ensure Firebase auth flows call it.

---

## 1. Current State Map

### Token Types in Play

**1. Dev Placeholder Token** (`"dev-jwt-token-*"`)
- **Source:** `server/src/routes/auth.ts` line 17
- **Format:** Plain string, not a JWT
- **Where set:** `web/src/pages/auth/LoginPage.tsx` line 32 → `setToken(res.token)`
- **Problem:** Not a valid JWT, fails `verifyAppToken()` → 401

**2. App JWT Token** (Real signed JWT)
- **Source:** `server/src/auth/jwtService.ts` → `signAppToken()`
- **Format:** JWT with issuer "dealflowos", signed with `JWT_SECRET`
- **Where issued:** `server/src/auth/sessionService.ts` line 183 (via `/api/auth/session`)
- **Verification:** `server/src/middleware/requireAuth.ts` line 158 → `verifyAppToken()`

**3. Firebase ID Token** (Firebase Auth)
- **Source:** Firebase Auth SDK (`signInWithGoogle`, `completeEmailLinkSignIn`)
- **Format:** Firebase JWT
- **Where used:** Exchanged for app JWT via `/api/auth/session` (line 126)
- **Verification:** `server/src/auth/firebaseAdmin.ts` → `verifyIdToken()`

### Token Flow Gaps

**Missing Link:** Firebase auth functions (`signInWithGoogle`, `completeEmailLinkSignIn`) do NOT automatically call `/api/auth/session` to exchange Firebase ID token for app JWT.

**Current Flow (Broken):**
```
LoginPage → POST /auth/login → "dev-jwt-token-*" → localStorage → API calls → 401
```

**Intended Flow (Firebase):**
```
signInWithGoogle() → Firebase User → getIdToken() → POST /auth/session → app_session_token → localStorage → API calls → 200
```

**Current Flow (Dev Bypass):**
```
No Authorization header → DEV_AUTH_BYPASS=1 → x-dev-user-id headers → req.user set → 200
```

---

## 2. 401 Root Cause (Most Probable)

### Exact Failure Point

**File:** `server/src/middleware/requireAuth.ts` line 158

**Sequence:**
1. Frontend sends: `Authorization: Bearer dev-jwt-token-1234567890`
2. Line 134: `hasBearer = true` (matches pattern)
3. Line 145: Enters `if (hasBearer)` block → **skips dev bypass**
4. Line 158: `verifyAppToken(token)` called
5. `verifyAppToken()` expects:
   - Valid JWT structure (3 dot-separated segments)
   - Signed with `JWT_SECRET`
   - Issuer "dealflowos"
6. `"dev-jwt-token-1234567890"` fails JWT parsing → `JsonWebTokenError`
7. Line 193: Returns 401 (does NOT fall back to dev bypass)

### Why Dev Bypass Doesn't Apply

**File:** `server/src/middleware/requireAuth.ts` lines 144-194

The recent refactor prioritizes real auth over dev bypass:
- If `hasBearer = true`, dev bypass is skipped entirely
- Invalid tokens return 401, never fall back to bypass
- This is correct for production security, but breaks dev UX

### Evidence

- `server/src/routes/auth.ts` line 17: Returns `"dev-jwt-token-" + Date.now()` (not a JWT)
- `server/src/auth/jwtService.ts` line 87-109: `verifyAppToken()` validates JWT structure/signature
- `server/src/middleware/requireAuth.ts` line 134-145: Checks `hasBearer` before dev bypass

---

## 3. Recommended Target Architecture

### Option 2: Backend Issues App JWT After Verifying Firebase Token Once (RECOMMENDED)

**Rationale:**
- `/api/auth/session` endpoint already exists and works correctly
- App JWTs are shorter-lived (15 min default) and can be revoked via `session_version`
- Firebase ID tokens are long-lived and harder to revoke
- Consistent token format across all API calls

**Flow:**
1. User signs in via Firebase (`signInWithGoogle` or email link)
2. Frontend gets Firebase ID token: `firebaseUser.getIdToken()`
3. Frontend calls `POST /api/auth/session` with `Authorization: Bearer <firebase_id_token>`
4. Backend verifies Firebase token, creates/updates User row, returns `app_session_token`
5. Frontend stores `app_session_token` in localStorage
6. All subsequent API calls use `Authorization: Bearer <app_session_token>`
7. `requireAuth` verifies app JWT via `verifyAppToken()`

**Dev Mode Behavior:**
- `/auth/login` returns real signed JWT (not placeholder)
- Uses `signAppToken()` with dev user data
- Same token format as production (no special-casing needed)

**Files Involved:**
- `server/src/routes/auth.ts` (fix `/auth/login` to return real JWT)
- `web/src/pages/auth/LoginPage.tsx` (ensure Firebase flows call `/auth/session`)
- `web/src/auth/firebaseAuth.ts` (add helper to exchange Firebase token for app token)

---

## 4. Endpoint/API Specifications

### Existing Endpoints

#### `GET /api/user/me`
- **Auth:** `requireAuth` middleware
- **Response:**
  ```json
  {
    "ok": true,
    "user": {
      "id": "string",
      "email": "string | null",
      "displayName": "string | null",
      "photoUrl": "string | null",
      "activeOrgId": "string | null",
      "createdAt": "string | null",
      "updatedAt": "string | null"
    }
  }
  ```
- **Email Source:** DB (`User.email` synced from Firebase during session establishment)

#### `PATCH /api/user/me`
- **Auth:** `requireAuth` middleware
- **Request:**
  ```json
  {
    "displayName": "string | null",
    "photoUrl": "string | null"
  }
  ```
- **Forbidden Fields:** `email`, `phone`, `password` → 400 with explicit codes
- **Response:** Same as GET (fresh values after update)

### New Endpoints (Email Change)

#### `POST /api/user/change-email-request`
- **Auth:** `requireAuth` middleware
- **Rate Limit:** `authRateLimiter` (3 req/hour)
- **Request:**
  ```json
  {
    "newEmail": "string"
  }
  ```
- **Validation:**
  - Email format validation
  - `newEmail !== currentEmail` (from `req.user.email`)
- **Backend Logic:**
  1. Get Firebase user: `firebaseAdmin.auth().getUser(req.user.firebase_uid)`
  2. Call Firebase: `firebaseAdmin.auth().generateEmailVerificationLink(newEmail)`
  3. Send email via Firebase (or custom SMTP)
  4. Store pending change in DB (optional): `pending_email`, `email_change_expires_at`
  5. Return generic success (prevent enumeration)
- **Response:**
  ```json
  {
    "ok": true,
    "message": "If this email is valid, a verification link has been sent."
  }
  ```
- **Error Codes:**
  - `VALIDATION_ERROR` (invalid email format)
  - `SAME_EMAIL` (newEmail === currentEmail)
  - `RATE_LIMIT_EXCEEDED` (too many requests)

#### `GET /api/user/verify-email-change?oobCode=<firebase_code>`
- **Auth:** None (public endpoint, verified via Firebase code)
- **Request:** Query param `oobCode` (Firebase out-of-band code)
- **Backend Logic:**
  1. Verify Firebase `oobCode` with Firebase Admin
  2. Extract `newEmail` from verified code
  3. Update Firebase user: `firebaseAdmin.auth().updateUser(firebaseUid, { email: newEmail })`
  4. Sync to DB: `UPDATE "User" SET email = $1, session_version = session_version + 1 WHERE firebase_uid = $2`
  5. Invalidate all sessions (session_version bump)
- **Response:**
  ```json
  {
    "ok": true,
    "message": "Email updated successfully"
  }
  ```
- **Error Codes:**
  - `INVALID_TOKEN` (invalid/expired oobCode)
  - `TOKEN_EXPIRED` (oobCode expired)

### Password Reset (Client-Side Only)

**No new backend endpoints needed.** Use existing Firebase client SDK:
- `web/src/auth/firebaseAuth.ts` → `sendPasswordReset(email)`
- `web/src/pages/auth/ForgotPasswordPage.tsx` (already implemented)
- `web/src/pages/auth/ResetPasswordPage.tsx` (already implemented)

**Enhancement:** Add entry point from Settings → navigate to `/forgot-password` OR call `sendPasswordReset()` directly.

---

## 5. Security + Abuse Controls

### Rate Limiting

| Endpoint | Rate Limiter | Limit |
|----------|--------------|-------|
| `POST /api/user/change-email-request` | `authRateLimiter` | 3 req/hour per user |
| `GET /api/user/verify-email-change` | None (public, verified via Firebase code) | N/A |
| `POST /api/auth/session` | `authRateLimiter` | Existing limit |

### Re-Auth Requirements

**Email Change:**
- Firebase requires re-authentication for email changes (built-in)
- Backend does NOT need to enforce additional re-auth (Firebase handles it)

**Password Reset:**
- Firebase handles verification via email link (no additional re-auth needed)

### Session Invalidation Strategy

**After Email Change:**
- `UPDATE "User" SET session_version = session_version + 1 WHERE firebase_uid = $1`
- All existing app JWTs become invalid (checked in `requireAuth` line 198-230)
- User must re-authenticate via Firebase and call `/api/auth/session` to get new app JWT

**After Password Reset:**
- Firebase automatically invalidates Firebase sessions
- App JWTs remain valid until they expire (15 min default) or `session_version` is bumped
- Optional: Bump `session_version` after password reset (not implemented in this plan)

### Audit Logging Events

**New Events:**
- `email_change_requested` (user_id, ip, new_email_hash, timestamp)
- `email_change_confirmed` (user_id, ip, old_email_hash, new_email_hash, timestamp)
- `password_reset_requested` (user_id, ip, timestamp) - if backend tracks it

**No PII Logged:**
- Do NOT log email addresses in audit logs
- Use email hash or omit entirely
- Log only: user_id, ip, timestamp, event type

### User Enumeration Prevention

**Email Change Request:**
- Always return generic success message: "If this email is valid, a verification link has been sent."
- Do NOT reveal whether email exists or is already in use
- Rate limit prevents brute-force enumeration

**Email Verification:**
- Firebase `oobCode` is single-use and expires (prevents enumeration)

---

## 6. Phased Implementation Plan

### Phase 1: Fix 401 - Make Dev Login Return Real JWT

**Goal:** Fix 401 errors by making `/auth/login` return a real signed JWT in dev mode.

**Files to Modify:**
- `server/src/routes/auth.ts` (lines 12-23)

**Changes:**
```typescript
// --- POST /auth/login ---
authRouter.post("/login", async (req, res) => {
  // Dev-only: return real signed JWT for dev user
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEV AUTH] Bypassing auth for /login");
    
    // Import signAppToken at top of file
    import { signAppToken } from "../auth/jwtService.js";
    
    // Create dev user object matching SessionUser interface
    const devUser = {
      id: req.body.userId || "user_dev",
      firebase_uid: "firebase_dev",
      email: req.body.email || "dev@example.com",
      plan: "gold",
      session_version: 1,
    };
    
    const appToken = signAppToken(devUser);
    
    return res.json({
      token: appToken,  // Real signed JWT
      user: {
        email: devUser.email,
        id: devUser.id
      }
    });
  }
  // ... rest of production logic unchanged
});
```

**Verification:**
1. Start backend: `cd server && npm run dev`
2. Test login: `curl -X POST http://127.0.0.1:3010/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com"}'`
3. Verify response contains real JWT (3 dot-separated segments)
4. Test API call: `curl -H "Authorization: Bearer <token>" http://127.0.0.1:3010/api/user/me`
5. Expected: 200 (not 401)

**Rollback:** Revert to `"dev-jwt-token-" + Date.now()` if issues arise.

---

### Phase 2: Wire Firebase Auth to Exchange Tokens

**Goal:** Ensure Firebase auth flows (`signInWithGoogle`, `completeEmailLinkSignIn`) exchange Firebase ID token for app JWT.

**Files to Modify:**
- `web/src/auth/firebaseAuth.ts` (add helper function)
- `web/src/pages/auth/LoginPage.tsx` (call exchange after Firebase sign-in)
- `web/src/main.tsx` (call exchange after email link sign-in)

**Changes:**

**1. Add helper in `web/src/auth/firebaseAuth.ts`:**
```typescript
import { post, setToken } from '../api';

/**
 * Exchange Firebase ID token for app session token
 */
export async function exchangeFirebaseTokenForAppToken(firebaseUser: User): Promise<void> {
  const idToken = await firebaseUser.getIdToken();
  const response = await post<{ app_session_token: string }>('/auth/session', null, {
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  });
  
  if (response.app_session_token) {
    setToken(response.app_session_token);
  } else {
    throw new Error('No app session token received');
  }
}
```

**2. Update `signInWithGoogle` in `web/src/auth/firebaseAuth.ts`:**
```typescript
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  
  // Exchange Firebase token for app token
  await exchangeFirebaseTokenForAppToken(user);
  
  return user;
}
```

**3. Update `completeEmailLinkSignIn` in `web/src/auth/firebaseAuth.ts`:**
```typescript
export async function completeEmailLinkSignIn(): Promise<User | null> {
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    return null;
  }

  const email = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  if (!email) {
    console.error('No email found for sign-in link');
    return null;
  }

  const result = await signInWithEmailLink(auth, email, window.location.href);
  const user = result.user;
  
  // Clear stored email
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  
  // Clean up URL
  window.history.replaceState({}, document.title, window.location.pathname);
  
  // Exchange Firebase token for app token
  await exchangeFirebaseTokenForAppToken(user);
  
  return user;
}
```

**4. Update `web/src/pages/auth/LoginPage.tsx`:**
```typescript
async function handleGoogleSignIn() {
  setError(null);
  try {
    const user = await signInWithGoogle();  // Now exchanges token automatically
    console.log('Google sign-in successful');
    notify('success', 'Logged in');
    navigate('/dashboard', { replace: true });
  } catch (err) {
    // ... error handling
  }
}
```

**Verification:**
1. Sign in with Google → check localStorage → should contain app JWT (not Firebase token)
2. Test API call: `GET /api/user/me` → should return 200
3. Test email link sign-in → should exchange token automatically

**Rollback:** Revert Firebase auth functions to original (no token exchange).

---

### Phase 3: Add Email Change Request Endpoint

**Goal:** Add backend endpoint to request email change via Firebase verification link.

**Files to Create/Modify:**
- `server/src/routes/user.ts` (add new handler)
- `server/src/auth/firebaseAdmin.ts` (ensure Firebase Admin is initialized)

**Changes:**

**1. Add handler in `server/src/routes/user.ts`:**
```typescript
import { authRateLimiter } from "../middleware/rateLimit.js";
import { getAuth } from "firebase-admin/auth";

// ... existing code ...

userRouter.post("/change-email-request", authRateLimiter, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ ok: false, code: "UNAUTHENTICATED", error: "Unauthorized" });
  }

  const { newEmail } = req.body;
  
  // Validation
  if (!newEmail || typeof newEmail !== "string") {
    return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", error: "newEmail is required" });
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", error: "Invalid email format" });
  }
  
  // Get current email from DB
  const userResult = await pool.query('SELECT email, firebase_uid FROM "User" WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", error: "User not found" });
  }
  
  const currentEmail = userResult.rows[0].email;
  const firebaseUid = userResult.rows[0].firebase_uid;
  
  // Check if email is different
  if (newEmail.toLowerCase() === currentEmail?.toLowerCase()) {
    return res.status(400).json({ ok: false, code: "SAME_EMAIL", error: "New email must be different from current email" });
  }
  
  try {
    // Generate Firebase email verification link
    const firebaseAuth = getAuth();
    const actionCodeSettings = {
      url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings?emailChange=success`,
      handleCodeInApp: false,
    };
    
    const link = await firebaseAuth.generateEmailVerificationLink(newEmail, actionCodeSettings);
    
    // TODO: Send email via SMTP or Firebase (not implemented in this phase)
    // For now, log the link (dev only)
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Email change link:", link);
    }
    
    // Store pending change (optional, for tracking)
    await pool.query(
      `UPDATE "User" SET pending_email = $1, email_change_expires_at = NOW() + INTERVAL '15 minutes' WHERE id = $2`,
      [newEmail, userId]
    );
    
    // Return generic success (prevent enumeration)
    return res.json({
      ok: true,
      message: "If this email is valid, a verification link has been sent.",
    });
  } catch (error: any) {
    console.error("[USER API] Error requesting email change:", error);
    return res.status(500).json({
      ok: false,
      code: "EMAIL_CHANGE_FAILED",
      error: "Failed to request email change",
    });
  }
});
```

**Verification:**
1. Test with valid token: `POST /api/user/change-email-request` with `{"newEmail":"new@example.com"}`
2. Expected: 200 with generic success message
3. Check DB: `pending_email` should be set
4. Test validation: invalid email → 400 VALIDATION_ERROR
5. Test same email → 400 SAME_EMAIL

**Rollback:** Remove handler from `user.ts`.

---

### Phase 4: Add Email Change Verification Endpoint

**Goal:** Add endpoint to verify Firebase `oobCode` and update email.

**Files to Modify:**
- `server/src/routes/user.ts` (add new handler)

**Changes:**

**1. Add handler in `server/src/routes/user.ts`:**
```typescript
userRouter.get("/verify-email-change", async (req, res) => {
  const { oobCode } = req.query;
  
  if (!oobCode || typeof oobCode !== "string") {
    return res.status(400).json({ ok: false, code: "INVALID_TOKEN", error: "Missing oobCode" });
  }
  
  try {
    const firebaseAuth = getAuth();
    
    // Verify oobCode and extract email
    // Note: Firebase Admin doesn't have a direct verifyEmailChangeCode method
    // We need to use the action code settings and verify the code manually
    // For now, use a workaround: verify the code and extract email from it
    
    // TODO: Implement proper Firebase oobCode verification
    // This is a placeholder - actual implementation requires Firebase Admin SDK methods
    
    // For MVP: Assume oobCode is valid and extract email from it (not secure, needs proper implementation)
    // In production, use Firebase Admin to verify the code
    
    return res.status(501).json({
      ok: false,
      code: "NOT_IMPLEMENTED",
      error: "Email verification endpoint not yet implemented",
    });
  } catch (error: any) {
    console.error("[USER API] Error verifying email change:", error);
    return res.status(500).json({
      ok: false,
      code: "EMAIL_VERIFICATION_FAILED",
      error: "Failed to verify email change",
    });
  }
});
```

**Note:** Firebase Admin SDK doesn't have a direct `verifyEmailChangeCode` method. This phase requires research into Firebase Admin SDK capabilities or using Firebase client SDK on a trusted server endpoint.

**Alternative Approach:** Use Firebase client SDK on frontend to handle email verification, then call backend to sync email to DB.

**Verification:** Deferred until Firebase Admin SDK method is identified.

**Rollback:** Remove handler from `user.ts`.

---

### Phase 5: Add "Change Email" UI in Settings

**Goal:** Add UI in Settings to request email change.

**Files to Create/Modify:**
- `web/src/components/ChangeEmailModal.tsx` (new)
- `web/src/components/AccountPanel.tsx` (add button)
- `web/src/pages/SettingsPage.tsx` (wire modal)

**Changes:**

**1. Create `web/src/components/ChangeEmailModal.tsx`:**
```typescript
import { useState } from 'react';
import { post } from '../api';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
}

export function ChangeEmailModal({ isOpen, onClose, currentEmail }: ChangeEmailModalProps) {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await post('/user/change-email-request', { newEmail });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to request email change');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Change Email</h2>
        
        {success ? (
          <div>
            <p className="text-green-600 mb-4">
              If this email is valid, a verification link has been sent.
            </p>
            <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 rounded">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Current Email</label>
              <input
                type="email"
                value={currentEmail}
                disabled
                className="w-full px-3 py-2 border rounded bg-gray-100"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">New Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Verification Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

**2. Update `web/src/components/AccountPanel.tsx`:**
```typescript
import { ChangeEmailModal } from './ChangeEmailModal';

// Add state for modal
const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);

// Add button near email field
<button
  type="button"
  onClick={() => setIsChangeEmailModalOpen(true)}
  className="text-sm text-blue-600 hover:text-blue-800"
>
  Change Email
</button>

// Add modal
<ChangeEmailModal
  isOpen={isChangeEmailModalOpen}
  onClose={() => setIsChangeEmailModalOpen(false)}
  currentEmail={email || ''}
/>
```

**Verification:**
1. Open Settings → Account section
2. Click "Change Email" → modal opens
3. Enter new email → click "Send Verification Link"
4. Expected: Success message displayed
5. Check backend logs: Email change request logged

**Rollback:** Remove `ChangeEmailModal.tsx` and revert `AccountPanel.tsx`.

---

### Phase 6: Add "Reset Password" Entry Point from Settings

**Goal:** Add "Reset Password" button/link in Settings that triggers password reset flow.

**Files to Modify:**
- `web/src/components/AccountPanel.tsx` (add button)

**Changes:**

**1. Update `web/src/components/AccountPanel.tsx`:**
```typescript
import { sendPasswordReset } from '../auth/firebaseAuth';
import { useNavigate } from 'react-router-dom';

// Add handler
const navigate = useNavigate();

const handleResetPassword = async () => {
  if (!email) {
    // Show error: email required
    return;
  }
  
  try {
    await sendPasswordReset(email);
    // Show success message or navigate to confirmation page
    navigate('/forgot-password?sent=true');
  } catch (err) {
    // Show error
  }
};

// Add button near password field (if password field exists) or in account section
<button
  type="button"
  onClick={handleResetPassword}
  className="text-sm text-blue-600 hover:text-blue-800"
>
  Reset Password
</button>
```

**Alternative:** Navigate directly to `/forgot-password` page (simpler, reuses existing UI).

**Verification:**
1. Open Settings → Account section
2. Click "Reset Password"
3. Expected: Password reset email sent (or navigate to `/forgot-password`)
4. Check email inbox: Reset link received

**Rollback:** Remove button from `AccountPanel.tsx`.

---

## 7. Second-Order Risks

### Token Drift

**Risk:** Frontend stores Firebase token instead of app token, causing inconsistent auth.

**Mitigation:**
- Phase 2 ensures Firebase flows exchange tokens automatically
- Add validation in `ProtectedRoute`: Check token format (should be app JWT, not Firebase token)
- Add migration helper: If Firebase token detected, exchange it automatically

### Bypass Masking Real Auth Issues

**Risk:** Dev bypass hides real auth problems (like missing Firebase config).

**Mitigation:**
- Keep dev bypass only when `hasBearer = false`
- Add `DEV_DIAGNOSTICS=1` logging to show which path is taken
- Require explicit dev headers (`x-dev-user-id`) - no silent defaults

### Multi-Tenant Billing Ownership

**Risk:** Email change affects billing email, but billing is org-scoped (future).

**Mitigation:**
- Email change is user-scoped (not org-scoped)
- Billing email can be separate from user email (future: `org.billing_email`)
- Do NOT add `orgId` to email change tokens or endpoints

### User Enumeration

**Risk:** Email change endpoint reveals whether email exists.

**Mitigation:**
- Always return generic success message
- Rate limit prevents brute-force enumeration
- Do NOT log email addresses in audit logs (use hash or omit)

### Lockouts

**Risk:** User changes email, doesn't receive verification link, gets locked out.

**Mitigation:**
- Keep old email valid until verification completes
- Allow reverting email change if not verified within 15 minutes
- Provide support contact for lockout recovery

### Session Invalidation Edge Cases

**Risk:** User changes email, but old sessions remain valid until expiration.

**Mitigation:**
- `session_version++` invalidates all app JWTs immediately
- Firebase sessions are invalidated by Firebase (handled automatically)
- Add monitoring: Alert if `session_version` changes unexpectedly

---

## 8. Implementation Checklist

### Phase 1: Fix 401
- [ ] Modify `server/src/routes/auth.ts` to return real JWT
- [ ] Import `signAppToken` in `auth.ts`
- [ ] Test dev login → verify JWT format
- [ ] Test API call with dev token → verify 200 (not 401)

### Phase 2: Wire Firebase Auth
- [ ] Add `exchangeFirebaseTokenForAppToken` helper
- [ ] Update `signInWithGoogle` to exchange token
- [ ] Update `completeEmailLinkSignIn` to exchange token
- [ ] Test Google sign-in → verify app token in localStorage
- [ ] Test email link sign-in → verify app token in localStorage

### Phase 3: Email Change Request
- [ ] Add `POST /api/user/change-email-request` handler
- [ ] Add validation (email format, same email check)
- [ ] Integrate Firebase Admin `generateEmailVerificationLink`
- [ ] Add rate limiting (`authRateLimiter`)
- [ ] Test endpoint → verify generic success message

### Phase 4: Email Change Verification
- [ ] Research Firebase Admin SDK for `oobCode` verification
- [ ] Add `GET /api/user/verify-email-change` handler
- [ ] Implement email update in Firebase + DB
- [ ] Implement `session_version++` bump
- [ ] Test verification flow → verify email updated

### Phase 5: Change Email UI
- [ ] Create `ChangeEmailModal.tsx`
- [ ] Add "Change Email" button in `AccountPanel.tsx`
- [ ] Wire modal to call `/api/user/change-email-request`
- [ ] Test UI flow → verify email sent

### Phase 6: Reset Password Entry Point
- [ ] Add "Reset Password" button in `AccountPanel.tsx`
- [ ] Wire to `sendPasswordReset()` or navigate to `/forgot-password`
- [ ] Test UI flow → verify reset email sent

---

## 9. Testing Strategy

### Unit Tests (Optional)

- `signAppToken()` generates valid JWT
- `verifyAppToken()` rejects invalid tokens
- Email validation regex works correctly

### Integration Tests

- Dev login → app JWT → API call → 200
- Firebase sign-in → token exchange → API call → 200
- Email change request → rate limit → 429
- Email change verification → email updated → session invalidated

### Manual Testing

1. **Dev Login Flow:**
   - POST `/auth/login` → get token
   - GET `/api/user/me` with token → 200

2. **Firebase Sign-In Flow:**
   - Sign in with Google → check localStorage → app token present
   - GET `/api/user/me` → 200

3. **Email Change Flow:**
   - POST `/api/user/change-email-request` → generic success
   - Click verification link → email updated
   - Old app token → 401 (session invalidated)

4. **Password Reset Flow:**
   - Click "Reset Password" → email sent
   - Click reset link → password updated

---

## 10. Rollback Plan

If any phase causes issues:

1. **Phase 1:** Revert `auth.ts` to return `"dev-jwt-token-" + Date.now()`
2. **Phase 2:** Revert Firebase auth functions to original (no token exchange)
3. **Phase 3:** Remove email change request handler from `user.ts`
4. **Phase 4:** Remove email verification handler from `user.ts`
5. **Phase 5:** Remove `ChangeEmailModal.tsx` and revert `AccountPanel.tsx`
6. **Phase 6:** Remove "Reset Password" button from `AccountPanel.tsx`

Each phase is independent and can be rolled back without affecting others.

---

## Conclusion

**Priority:** Phase 1 (Fix 401) is critical and should be implemented first.

**Architecture:** Option 2 (Backend issues app JWT) is recommended and aligns with existing codebase.

**Security:** Email/password changes use Firebase verification links (secure, no direct DB mutations).

**Future-Proofing:** Email change is user-scoped, does not block multi-tenant features.

**Timeline:** Phases 1-2 can be completed in 1-2 hours. Phases 3-6 require additional research (Firebase Admin SDK) and UI work (4-8 hours total).







