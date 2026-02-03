/**
 * Establish app session from Firebase user: exchange Firebase ID token for app JWT.
 */

import type { User } from "firebase/auth";
import { post, setToken, isJwt } from "../../api";

/**
 * Exchange Firebase user for app JWT via POST /api/auth/session.
 * Stores app_session_token in localStorage for /api/* requests.
 */
export async function establishAppSession(user: User): Promise<string> {
  const idToken = await user.getIdToken();
  const data = await post<{ app_session_token?: string }>(
    "/auth/session",
    {},
    { Authorization: `Bearer ${idToken}` }
  );
  const raw = data?.app_session_token ?? "";
  const normalized = typeof raw === "string" ? raw.trim() : "";
  if (!normalized || !isJwt(normalized)) {
    throw new Error("Session failed: server did not return a valid app token.");
  }
  setToken(normalized);
  return normalized;
}
