/**
 * User Scope Assertion Helper
 * 
 * Prevents BOLA (Broken Object Level Authorization) by ensuring
 * resources belong to the authenticated user.
 */

import { Response } from "express";

/**
 * Assert that a resource belongs to the authenticated user
 * 
 * @param resourceUserId - The user ID that owns the resource
 * @param authenticatedUserId - The authenticated user's ID from req.user.id
 * @param res - Express response object (for error responses)
 * @returns true if ownership is valid, false if not (and response is sent)
 */
export function assertUserScope(
  resourceUserId: string | number,
  authenticatedUserId: string,
  res: Response
): boolean {
  // Convert both to strings for comparison (handles type mismatches)
  const resourceUserIdStr = String(resourceUserId);
  const authenticatedUserIdStr = String(authenticatedUserId);

  if (resourceUserIdStr !== authenticatedUserIdStr) {
    // Return 403 instead of 404 to prevent information leakage
    // (Don't reveal whether resource exists if it doesn't belong to user)
    res.status(403).json({ error: "Forbidden" });
    return false;
  }

  return true;
}

/**
 * Assert that the authenticated user exists
 * 
 * @param userId - The user ID from req.user?.id
 * @param res - Express response object (for error responses)
 * @returns true if user is authenticated, false if not (and response is sent)
 */
export function assertAuthenticated(
  userId: string | undefined,
  res: Response
): boolean {
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}










