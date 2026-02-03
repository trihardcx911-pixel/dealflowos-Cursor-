/**
 * Firebase Authentication Functions
 * Centralized auth logic for Google and Email Link sign-in
 */

import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
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

/**
 * Sign in with email and password (Firebase)
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password)
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
  await sendPasswordResetEmail(auth, email, {
    url: window.location.origin + '/reset-password',
    handleCodeInApp: false,
  })
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

