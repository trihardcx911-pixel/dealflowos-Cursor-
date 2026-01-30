/**
 * Rate Limiting Middleware
 * 
 * Prevents abuse and DoS attacks by limiting request frequency.
 * Uses in-memory store (no Redis required for Phase 3).
 */

import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { logSecurityEvent, getClientIp, getUserAgent } from "../security/securityEvents.js";

/**
 * Auth Rate Limiter (Strict)
 * 
 * Applied to: POST /api/auth/session
 * Purpose: Stop Firebase token spam, brute force, protect CPU-bound verification
 * 
 * Rules: 5 requests / minute / IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window
  message: { error: "Too many requests" },
  standardHeaders: false, // Disable `X-RateLimit-*` headers
  legacyHeaders: false, // Disable `RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Key by IP address
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  handler: async (req: Request, res: Response) => {
    // Log rate limit event (best-effort, non-blocking)
    logSecurityEvent({
      event_type: "rate_limited",
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 429,
      meta: {
        limiter_name: "auth",
        key_basis: "ip",
      },
    }).catch(() => {}); // Ignore errors
    (req as any)._securityLogged = true; // Prevent double-logging

    res.status(429).json({ error: "Too many requests" });
  },
});

/**
 * API Rate Limiter (Standard)
 * 
 * Applied to: /api/* (except /api/auth/session)
 * Purpose: Prevent scraping, infinite frontend loops, protect DB & Stripe
 * 
 * Rules: 120 requests / minute
 * Keyed by: req.user.id if authenticated, fallback to req.ip
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per window
  message: { error: "Too many requests" },
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Prefer authenticated user ID, fallback to IP
    if ((req as any).user?.id) {
      return `user:${(req as any).user.id}`;
    }
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  handler: async (req: Request, res: Response) => {
    // Log rate limit event (best-effort, non-blocking)
    const user = (req as any).user;
    const keyBasis = user?.id ? "user_id" : "ip";
    logSecurityEvent({
      event_type: "rate_limited",
      user_id: user?.id || null,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 429,
      meta: {
        limiter_name: "api",
        key_basis: keyBasis,
      },
    }).catch(() => {}); // Ignore errors
    (req as any)._securityLogged = true; // Prevent double-logging

    res.status(429).json({ error: "Too many requests" });
  },
});

/**
 * Billing Rate Limiter (Extra Tight)
 * 
 * Applied to: /api/billing/*
 * Purpose: Protect Stripe API, prevent accidental charge loops
 * 
 * Rules: 20 requests / minute / user
 * Requires: Authentication (req.user.id must exist)
 */
export const billingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per window
  message: { error: "Too many requests" },
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Must be authenticated (requireAuth runs before this)
    if (!(req as any).user?.id) {
      // Fallback to IP if somehow unauthenticated (shouldn't happen)
      return req.ip || req.socket.remoteAddress || "unknown";
    }
    return `billing:${(req as any).user.id}`;
  },
  handler: async (req: Request, res: Response) => {
    // Log rate limit event (best-effort, non-blocking)
    const user = (req as any).user;
    logSecurityEvent({
      event_type: "rate_limited",
      user_id: user?.id || null,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      path: req.path,
      method: req.method,
      status_code: 429,
      meta: {
        limiter_name: "billing",
        key_basis: user?.id ? "user_id" : "ip",
      },
    }).catch(() => {}); // Ignore errors

    res.status(429).json({ error: "Too many requests" });
  },
});

