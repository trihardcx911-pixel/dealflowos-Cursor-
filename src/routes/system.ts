/**
 * System Health, Metrics & Observability Endpoints
 * Provides operational visibility into the system
 */

import express, { Request, Response } from "express";
import os from "os";
import { asyncHandler } from "../middleware/errorNormalizer";
import prisma from "../lib/prisma";
import { getQueueStats } from "../queue/eventQueue";
import { getWorkerStatus, runJobNow } from "../workers";
import { getConnectionStats } from "../realtime/gateway";

const router = express.Router();

// Package version
const VERSION = process.env.npm_package_version || "1.0.0";
const START_TIME = Date.now();

/**
 * GET /api/system/health
 * Basic health check with component status
 */
router.get("/health", asyncHandler(async (req: Request, res: Response) => {
  const checks = await runHealthChecks();
  
  const allHealthy = Object.values(checks).every(c => c.status === "healthy");
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  });
}));

/**
 * GET /api/system/metrics
 * Prometheus-style metrics for monitoring
 */
router.get("/metrics", asyncHandler(async (req: Request, res: Response) => {
  const queueStats = getQueueStats();
  
  const metrics = {
    // System metrics
    system: {
      cpuLoad: os.loadavg(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      memoryUsagePercent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
      platform: os.platform(),
      hostname: os.hostname(),
    },
    
    // Process metrics
    process: {
      memory: process.memoryUsage(),
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      uptime: process.uptime(),
      uptimeHours: Math.round(process.uptime() / 3600 * 10) / 10,
      pid: process.pid,
      nodeVersion: process.version,
    },
    
    // Application metrics
    app: {
      version: VERSION,
      startTime: new Date(START_TIME).toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
    
    // Queue metrics
    queue: {
      eventsPending: queueStats.pending,
      isProcessing: queueStats.isProcessing,
    },
    
    // Timestamp
    timestamp: new Date().toISOString(),
  };

  // Return as JSON or Prometheus format based on Accept header
  if (req.accepts("text/plain")) {
    res.contentType("text/plain").send(formatPrometheusMetrics(metrics));
  } else {
    res.json(metrics);
  }
}));

/**
 * GET /api/system/version
 * Version and build info
 */
router.get("/version", (req: Request, res: Response) => {
  res.json({
    version: VERSION,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
    buildTime: process.env.BUILD_TIME || null,
    gitCommit: process.env.GIT_COMMIT || null,
  });
});

/**
 * GET /api/system/dependencies
 * Check status of external dependencies
 */
router.get("/dependencies", asyncHandler(async (req: Request, res: Response) => {
  const deps = await checkDependencies();
  
  const allHealthy = Object.values(deps).every(d => d.connected);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "all_connected" : "some_unavailable",
    dependencies: deps,
    timestamp: new Date().toISOString(),
  });
}));

/**
 * GET /api/system/stats
 * Application-level statistics
 */
router.get("/stats", asyncHandler(async (req: Request, res: Response) => {
  const [leadCount, dealCount, eventCount, userCount, orgCount] = await Promise.all([
    prisma.lead.count(),
    prisma.deal.count(),
    prisma.leadEvent.count(),
    prisma.user.count(),
    prisma.organization.count(),
  ]);

  res.json({
    entities: {
      leads: leadCount,
      deals: dealCount,
      events: eventCount,
      users: userCount,
      organizations: orgCount,
    },
    timestamp: new Date().toISOString(),
  });
}));

/**
 * GET /api/system/workers/status
 * Get status of all background workers
 */
router.get("/workers/status", asyncHandler(async (req: Request, res: Response) => {
  const workers = getWorkerStatus();
  
  res.json({
    workers,
    summary: {
      total: workers.length,
      running: workers.filter(w => w.isRunning).length,
      healthy: workers.filter(w => w.errorCount === 0).length,
      withErrors: workers.filter(w => w.errorCount > 0).length,
    },
    timestamp: new Date().toISOString(),
  });
}));

/**
 * POST /api/system/workers/:name/run
 * Manually trigger a worker job
 */
router.post("/workers/:name/run", asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  
  try {
    await runJobNow(name);
    res.json({ message: `Worker "${name}" triggered successfully` });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
}));

/**
 * GET /api/system/websocket/stats
 * Get WebSocket connection statistics
 */
router.get("/websocket/stats", (req: Request, res: Response) => {
  const stats = getConnectionStats();
  res.json({
    ...stats,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Helper Functions
// ============================================

async function runHealthChecks() {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Database check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "healthy", latency: Date.now() - start };
  } catch (err) {
    checks.database = { status: "unhealthy", error: (err as Error).message };
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  checks.memory = {
    status: heapUsedPercent < 90 ? "healthy" : "warning",
    latency: Math.round(heapUsedPercent),
  };

  // Event queue check
  const queueStats = getQueueStats();
  checks.eventQueue = {
    status: queueStats.pending < 1000 ? "healthy" : "backlogged",
    latency: queueStats.pending,
  };

  return checks;
}

async function checkDependencies() {
  const deps: Record<string, { connected: boolean; latency?: number; error?: string }> = {};

  // PostgreSQL
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    deps.postgresql = { connected: true, latency: Date.now() - start };
  } catch (err) {
    deps.postgresql = { connected: false, error: (err as Error).message };
  }

  return deps;
}

function formatPrometheusMetrics(metrics: any): string {
  const lines: string[] = [];
  
  // System metrics
  lines.push(`# HELP system_cpu_load_1m CPU load average (1 min)`);
  lines.push(`system_cpu_load_1m ${metrics.system.cpuLoad[0]}`);
  
  lines.push(`# HELP system_memory_free_bytes Free memory in bytes`);
  lines.push(`system_memory_free_bytes ${metrics.system.freeMemory}`);
  
  lines.push(`# HELP system_memory_usage_percent Memory usage percentage`);
  lines.push(`system_memory_usage_percent ${metrics.system.memoryUsagePercent}`);
  
  lines.push(`# HELP process_uptime_seconds Process uptime in seconds`);
  lines.push(`process_uptime_seconds ${metrics.process.uptime}`);
  
  lines.push(`# HELP process_heap_used_bytes Heap memory used`);
  lines.push(`process_heap_used_bytes ${metrics.process.memory.heapUsed}`);
  
  lines.push(`# HELP queue_events_pending Events pending in queue`);
  lines.push(`queue_events_pending ${metrics.queue.eventsPending}`);
  
  return lines.join("\n");
}

export default router;
