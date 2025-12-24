import http from "http";
import express from "express";
import cors from "cors";
import pino from "pino";
import * as Sentry from "@sentry/node";
import { z } from "zod";
import { env } from "./env";
import { prisma } from "./db/prisma";
import { createClient } from "redis";
import { Pool } from "pg";
import { randomUUID, createHash } from "node:crypto";

// Routes
import contactsRouter from "./routes/contacts";
import calendarRouter from "./routes/calendar";
import leadsRoutes from "./routes/leads";
import dealsRoutes from "./routes/deals";
import legalRoutes from "./routes/legal";
import kpiRoutes from "./routes/kpis-v2";
import userSettingsRoutes from "./routes/userSettings";
import leadEventsRoutes from "./routes/leadEvents";
import activityFeedRoutes from "./routes/activityFeed";
import systemRoutes from "./routes/system";
import dashboardRoutes from "./routes/dashboard";

// Middleware
import { errorHandler } from "./middleware/errorHandler";
import { errorNormalizer } from "./middleware/errorNormalizer";
import { requestTracing, logger as structuredLogger } from "./middleware/requestTracing";
import { auth } from "./auth/auth";

// Services & Workers
import { startEventQueue, stopEventQueue, flushQueue } from "./queue/eventQueue";
import { startWorkers, stopWorkers } from "./workers";

// Real-time
import { createWebSocketServer, closeWebSocketServer, getConnectionStats } from "./realtime/gateway";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/whcrm",
});

const logger = pino({ level: "info" });
const app = express();

// CORS - allow Vite dev server
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

// Request tracing & structured logging
app.use(requestTracing);

const redis = createClient({ url: env.REDIS_URL });

Sentry.init({
  dsn: env.SENTRY_DSN,
  tracesSampleRate: 0.0,
  enabled: !!env.SENTRY_DSN,
});

// Health checks
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await pool.query("SELECT 1");
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error("Redis not ready");
    res.status(200).send("ready");
  } catch (err) {
    logger.error({ err }, "readiness failed");
    res.status(503).send("not ready");
  }
});

// Test route for proxy verification (PATCH 9D)
app.get("/api/test-proxy", (_req, res) => {
  res.json({ 
    ok: true, 
    message: "Proxy is working! Backend received request at /api/test-proxy",
    timestamp: new Date().toISOString()
  });
});

// Legacy validation schemas (for backwards compatibility)
const leadQuerySchema = z.object({ orgId: z.string().min(1) });
const leadCreateSchema = z.object({
  orgId: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  zip: z.string().min(3),
  type: z.enum(["sfr", "land", "multi", "other"]).default("sfr"),
});

// Legacy GET /api/leads — latest 50 by org
app.get("/api/leads-legacy", async (req, res, next) => {
  try {
    const { orgId } = leadQuerySchema.parse(req.query);
    const items = await prisma.lead.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        ruralFlag: true,
        populationOk: true,
        createdAt: true,
      },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// Legacy POST /api/leads — create with address hash de-dupe
app.post("/api/leads-legacy", async (req, res, next) => {
  try {
    const { orgId, address, city, state, zip, type } = leadCreateSchema.parse(req.body ?? {});
    const canonical = `${String(address).trim()}, ${String(city).trim()}, ${String(state).trim()} ${String(zip).trim()}`.toUpperCase();
    const addressHash = createHash("sha256").update(`${canonical}|${orgId}`).digest("hex");
    const lead = await prisma.lead.create({
      data: { id: randomUUID(), orgId, type, address, city, state, zip, addressHash },
      select: { id: true },
    });
    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

// Contacts sub-routes
app.use("/api/leads/:leadId/contacts", contactsRouter);

// Calendar routes
app.use("/api/calendar", calendarRouter);

// ============================================
// System routes (health, metrics, version)
// ============================================
app.use("/api/system", systemRoutes);

// ============================================
// API v1 routes (analytics expansion) - protected by auth
// ============================================
app.use("/api/leads", auth, leadsRoutes);
app.use("/api/deals", auth, dealsRoutes);
app.use("/api/deals/:dealId/legal", auth, legalRoutes);
app.use("/api/kpis", auth, kpiRoutes);
app.use("/api/user-settings", auth, userSettingsRoutes);
app.use("/api/lead-events", auth, leadEventsRoutes);
app.use("/api/activity", auth, activityFeedRoutes);
app.use("/api/dashboard", auth, dashboardRoutes);

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);

// Initialize WebSocket server
createWebSocketServer(server);

async function start() {
  try {
    await redis.connect();
    await prisma.$connect();
    
    // Start event queue processor
    startEventQueue(500);
    
    // Start background workers
    if (process.env.DISABLE_WORKERS !== "true") {
      startWorkers();
    }
    
    server.listen(port, () => {
      logger.info(`listening on http://localhost:${port} (WebSocket on /ws)`);
      structuredLogger.info({
        event: "server_started",
        port,
        environment: process.env.NODE_ENV || "development",
      });
    });
  } catch (err) {
    logger.error({ err }, "startup failed");
    structuredLogger.error({
      event: "startup_failed",
      error: (err as Error).message,
    });
    process.exit(1);
  }
}
start();

// Centralized error handling (after routes)
app.use(errorNormalizer);
app.use(errorHandler);

// Graceful shutdown
async function gracefulShutdown() {
  logger.info("Shutting down gracefully...");
  structuredLogger.info({ event: "shutdown_started" });
  
  // Stop accepting new requests
  server.close();
  
  // Stop background workers
  stopWorkers();
  
  // Flush event queue before closing
  stopEventQueue();
  await flushQueue();
  
  // Close WebSocket server
  await closeWebSocketServer();
  
  // Close connections
  await redis.disconnect();
  await prisma.$disconnect();
  await pool.end();
  
  logger.info("Shutdown complete");
  structuredLogger.info({ event: "shutdown_complete" });
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
app.get("/api/test", (req, res) => {
  res.json({ ok: true });
});
