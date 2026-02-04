/**
 * Firebase Authentication Functions
 * Centralized auth logic for Google and Email Link sign-in
 */

import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth'
import { auth } from '../config/firebase'

const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn'

const DEV_DIAGNOSTICS = import.meta.env.DEV && import.meta.env.VITE_DEV_DIAGNOSTICS === '1'

/**
 * User-friendly message for Firebase auth error codes. Never logs or returns secrets.
 */
export function getFirebaseAuthErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  const c = String(code)
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c.includes('INVALID_LOGIN_CREDENTIALS')) return 'Invalid email or password.'
  if (c === 'auth/operation-not-allowed') return 'Email/password auth disabled in Firebase.'
  if (c === 'auth/email-already-in-use') return 'An account with this email already exists.'
  if (c === 'auth/weak-password') return 'Password is too weak.'
  if (c === 'auth/invalid-email') return 'Invalid email address.'
  return null
}

/**
 * User-friendly message for Firebase password-reset errors. Non-enumerating (does not reveal if email exists).
 */
export function getFirebasePasswordResetErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  const c = String(code)
  if (c === 'auth/invalid-email') return 'Invalid email address.'
  if (c === 'auth/user-not-found') return "If an account exists, you'll receive a reset email."
  if (c === 'auth/too-many-requests') return 'Too many attempts. Try again later.'
  if (c === 'auth/network-request-failed') return 'Network error. Check connection and try again.'
  if (c === 'auth/operation-not-allowed') return 'Password reset is disabled. Contact support.'
  return 'Could not send reset email. Try again.'
}

/**
 * Sign in with email and password (Firebase)
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

/**
 * Create account with email and password (Firebase)
 */
export async function createUserWithEmailPassword(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  return result.user
}

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

/**
 * Send sign-in link to email
 * @param email - Email address to send the sign-in link to
 */
export async function sendEmailLink(email: string): Promise<void> {
  const actionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: true,
  }

  await sendSignInLinkToEmail(auth, email, actionCodeSettings)
  
  // Store email in localStorage for completion
  window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email)
}

/**
 * Complete email link sign-in
 * Should be called on app load if a sign-in link is detected
 */
export async function completeEmailLinkSignIn(): Promise<User | null> {
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    return null
  }

  const email = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)
  if (!email) {
    console.error('No email found for sign-in link')
    return null
  }

  const result = await signInWithEmailLink(auth, email, window.location.href)
  
  // Clear stored email
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY)
  
  // Clean up URL
  window.history.replaceState({}, document.title, window.location.pathname)
  
  return result.user
}

/**
 * Send password reset email
 * @param email - Email address to send the password reset link to
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const resetUrl = window.location.origin + '/reset-password'
  const parsedUrl = new URL(resetUrl)
  
  // Allowlist: only send reset links to known production domains
  const allowedHosts = [
    'dealflowos.com',
    'dealflowos.net',
    'localhost',
    'dealflowos.firebaseapp.com',
    'dealflowos.web.app',
  ]
  
  if (!allowedHosts.some(host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host))) {
    throw new Error(`Reset URL hostname "${parsedUrl.hostname}" is not in the allowlist. Cannot send reset email.`)
  }

  if (DEV_DIAGNOSTICS) {
    const emailDomain = email.includes('@') ? email.split('@')[1] : 'unknown'
    console.log('[PASSWORD_RESET]', {
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      emailDomain,
    })
  }

  try {
    await sendPasswordResetEmail(auth, email, {
      url: resetUrl,
      handleCodeInApp: false,
    })
  } catch (err: unknown) {
    if (DEV_DIAGNOSTICS) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
      const message = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : undefined
      console.log('[PASSWORD_RESET_ERROR]', {
        firebaseErrorCode: code,
        firebaseErrorMessage: message,
        hostname: parsedUrl.hostname,
        origin: window.location.origin,
      })
    }
    throw err
  }
}

/**
 * Verify password reset code from email link
 * @param code - The oobCode from the reset link
 * @returns The email associated with the reset code
 */
export async function verifyPasswordReset(code: string): Promise<string> {
  return await verifyPasswordResetCode(auth, code)
}

/**
 * Confirm password reset with new password
 * @param code - The oobCode from the reset link
 * @param newPassword - The new password to set
 */
export async function confirmPasswordResetCode(code: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, code, newPassword)
}

/**
 * Sign out current user
 */
export async function logout(): Promise<void> {
  await firebaseSignOut(auth)
}

