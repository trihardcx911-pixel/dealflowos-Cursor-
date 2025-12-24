/**
 * Role-Based Access Control System
 * Supports: owner, admin, user, readonly
 */

import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

export type UserRole = "owner" | "admin" | "user" | "readonly";

/**
 * Role hierarchy - higher index = more permissions
 */
const ROLE_HIERARCHY: UserRole[] = ["readonly", "user", "admin", "owner"];

/**
 * Get role level (higher = more permissions)
 */
function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Check if user has at least the required role
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * Middleware to require a specific role
 */
export function requireRole(role: UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, orgId } = req.auth || {};

      if (!userId || !orgId) {
        return res.status(401).json({ 
          error: "Authentication required",
          code: "UNAUTHENTICATED",
        });
      }

      // Get user's membership for this org
      const membership = await prisma.userOrgMembership.findUnique({
        where: { userId_orgId: { userId, orgId } },
      });

      if (!membership) {
        return res.status(403).json({ 
          error: "Not a member of this organization",
          code: "NOT_MEMBER",
        });
      }

      const userRole = membership.role as UserRole;

      if (!hasRole(userRole, role)) {
        return res.status(403).json({ 
          error: `Requires ${role} role or higher`,
          code: "INSUFFICIENT_ROLE",
          details: { required: role, current: userRole },
        });
      }

      // Attach role to request for downstream use
      req.userRole = userRole;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require owner role
 */
export const requireOwner = requireRole("owner");

/**
 * Require admin role or higher
 */
export const requireAdmin = requireRole("admin");

/**
 * Require user role or higher (excludes readonly)
 */
export const requireUser = requireRole("user");

/**
 * Check if user can perform action on resource
 */
export function canPerformAction(
  userRole: UserRole, 
  action: "create" | "read" | "update" | "delete"
): boolean {
  const permissions: Record<UserRole, string[]> = {
    readonly: ["read"],
    user: ["read", "create", "update"],
    admin: ["read", "create", "update", "delete"],
    owner: ["read", "create", "update", "delete"],
  };

  return permissions[userRole]?.includes(action) ?? false;
}

/**
 * Middleware to check specific action permission
 */
export function requireAction(action: "create" | "read" | "update" | "delete") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.userRole as UserRole;

    if (!userRole) {
      return res.status(401).json({ 
        error: "Role not determined",
        code: "ROLE_UNKNOWN",
      });
    }

    if (!canPerformAction(userRole, action)) {
      return res.status(403).json({ 
        error: `Cannot perform ${action} action`,
        code: "ACTION_FORBIDDEN",
        details: { action, role: userRole },
      });
    }

    next();
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole;
    }
  }
}










