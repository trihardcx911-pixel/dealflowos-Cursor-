/**
 * Request Tracing & Structured Logging Middleware
 * Adds request IDs and structured logging for observability
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

/**
 * Structured log entry
 */
interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  event: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  orgId?: string;
  error?: string;
  [key: string]: any;
}

/**
 * Structured logger
 */
export const logger = {
  info: (entry: Omit<LogEntry, "timestamp" | "level">) => 
    console.log(JSON.stringify({ ...entry, timestamp: new Date().toISOString(), level: "info" })),
  
  warn: (entry: Omit<LogEntry, "timestamp" | "level">) => 
    console.warn(JSON.stringify({ ...entry, timestamp: new Date().toISOString(), level: "warn" })),
  
  error: (entry: Omit<LogEntry, "timestamp" | "level">) => 
    console.error(JSON.stringify({ ...entry, timestamp: new Date().toISOString(), level: "error" })),
  
  debug: (entry: Omit<LogEntry, "timestamp" | "level">) => {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(JSON.stringify({ ...entry, timestamp: new Date().toISOString(), level: "debug" }));
    }
  },
};

/**
 * Request tracing middleware
 * Adds request ID and logs request/response
 */
export function requestTracing(req: Request, res: Response, next: NextFunction) {
  // Generate or use existing request ID
  const requestId = req.headers["x-request-id"] as string || randomUUID();
  req.requestId = requestId;
  
  // Add to response headers
  res.setHeader("X-Request-ID", requestId);

  // Capture start time
  const startTime = Date.now();

  // Log incoming request
  logger.info({
    event: "request_start",
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.socket.remoteAddress,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;

    // Log response
    logger.info({
      event: "request_end",
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.auth?.userId,
      orgId: req.auth?.orgId,
    });

    // Warn on slow requests
    if (duration > 1000) {
      logger.warn({
        event: "slow_request",
        requestId,
        method: req.method,
        path: req.path,
        duration,
      });
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Error logging helper
 */
export function logError(error: Error, req?: Request) {
  logger.error({
    event: "error",
    requestId: req?.requestId,
    error: error.message,
    stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    method: req?.method,
    path: req?.path,
    userId: req?.auth?.userId,
    orgId: req?.auth?.orgId,
  });
}

/**
 * Log a custom event
 */
export function logEvent(
  event: string,
  data: Record<string, any> = {},
  req?: Request
) {
  logger.info({
    event,
    requestId: req?.requestId,
    userId: req?.auth?.userId,
    orgId: req?.auth?.orgId,
    ...data,
  });
}

/**
 * Performance tracking helper
 */
export function trackPerformance(name: string): () => void {
  const start = Date.now();
  
  return () => {
    const duration = Date.now() - start;
    logger.debug({
      event: "performance",
      name,
      duration,
    });
    
    if (duration > 500) {
      logger.warn({
        event: "slow_operation",
        name,
        duration,
      });
    }
  };
}










