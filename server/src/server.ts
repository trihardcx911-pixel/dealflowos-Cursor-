// Env loaded via tsx preload: -r ./src/env.cjs
console.log("[BOOT] NODE_ENV =", process.env.NODE_ENV);

const isDev = process.env.NODE_ENV !== "production";
const DEV_DIAGNOSTICS = isDev && process.env.DEV_DIAGNOSTICS === "1";

// ============================================================
// DEV-ONLY DIAGNOSTICS (CONTROLLED BY DEV_DIAGNOSTICS=1)
// ============================================================
let BOOT_ID: string | null = null;

if (DEV_DIAGNOSTICS) {
  BOOT_ID = "boot-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  console.log("[BOOT_ID]", BOOT_ID);
  console.log("[BOOT ENV]", { 
    NODE_ENV: process.env.NODE_ENV, 
    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
    DEV_DIAGNOSTICS: process.env.DEV_DIAGNOSTICS
  });

  // Monkey-patch process.exit to log and block exits in dev
  const originalExit = process.exit;
  process.exit = ((code?: number) => {
    console.error("[PROCESS EXIT BLOCKED] code =", code);
    console.error("Stack trace at exit attempt:");
    console.error(new Error().stack);
    // Do NOT call originalExit - keep process alive
  }) as typeof process.exit;

  // Global lifecycle event handlers
  process.on("uncaughtException", (error: Error) => {
    console.error("[FATAL][uncaughtException]");
    console.error({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  });

  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    console.error("[FATAL][unhandledRejection]");
    console.error({
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack,
      } : reason,
      promise: promise.toString(),
    });
  });

  process.on("beforeExit", (code: number) => {
    console.error("[LIFECYCLE][beforeExit] code =", code);
  });

  process.on("exit", (code: number) => {
    console.error("[LIFECYCLE][exit] code =", code);
  });
}

// ============================================================
// PRISMA CLIENT DIAGNOSTICS (DEV-ONLY)
// ============================================================
if (isDev) {
  // Use async IIFE to avoid top-level await
  (async () => {
    try {
      // Resolve which @prisma/client the runtime is using
      const prismaClientPath = require.resolve("@prisma/client");
      console.log("[PRISMA RESOLVE]", prismaClientPath);
      
      // Check if Task model contains urgency in Prisma DMMF
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const dmmf = (prisma as any).constructor?.dmmf?.datamodel?.models || [];
      const taskModel = dmmf.find((m: any) => m.name === "Task");
      const taskHasUrgency = taskModel?.fields?.some((f: any) => f.name === "urgency") || false;
      
      console.log("[PRISMA DMMF]", {
        taskModelExists: !!taskModel,
        taskHasUrgency,
        taskFieldNames: taskModel?.fields?.map((f: any) => f.name) || [],
      });
      
      // Clean up test client
      await prisma.$disconnect();
    } catch (error: any) {
      console.warn("[PRISMA DIAGNOSTICS] Failed to check Prisma client:", {
        name: error?.name,
        message: error?.message,
      });
    }
  })();
}

// Temporary: Verify DATABASE_URL loading (remove after verification)
console.log(">>> DATABASE_URL loaded:", process.env.DATABASE_URL ? "EXISTS" : "MISSING");
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  // Log first 30 chars and last 10 chars to verify without exposing full credentials
  console.log(">>> DATABASE_URL preview:", dbUrl.substring(0, 30) + "..." + dbUrl.substring(dbUrl.length - 10));
}

const isProd = process.env.NODE_ENV === "production";

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error("ERROR: JWT_SECRET environment variable is required and must be at least 32 characters long");
  process.exit(1);
} else if (!isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.warn("WARN: JWT_SECRET missing/short — using dev auth flow (do not use in production).");
}

// Fail fast in production if DATABASE_URL is missing (prevents confusing "Auth subsystem unavailable" errors)
if (isProd && !process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required in production");
  console.error("Set DATABASE_URL in Render environment to your PostgreSQL connection string");
  process.exit(1);
}

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import { leadsImportRouter } from "./routes/leads.import.js";
import { leadsDevRouter } from "./routes/leads.dev.js";
import { dealsDevRouter } from "./routes/deals.dev.js";
import { makeKpisRouter } from "./routes/kpis.js";     // This is the REAL KPI router
import { authRouter } from "./routes/auth.js";
import calendarRouter from "./routes/calendar.js";
import { billingRouter } from "./routes/billing.js";
import { stripeWebhookRouter } from "./routes/stripeWebhook.js";
import { pool } from "./db/pool.js";
import { prisma } from "./db/prisma.js";
import { isStripeConfigured } from "./billing/stripeClient.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { authRateLimiter, apiRateLimiter, billingRateLimiter } from "./middleware/rateLimit.js";
import { securityResponseLogger } from "./middleware/securityResponseLogger.js";
import { adminSecurityRouter } from "./routes/adminSecurity.js";
import { remindersRouter } from "./routes/reminders.js";
import { startReminderScheduler } from "./reminders/reminderScheduler.js";
import tasksRouter from "./routes/tasks.js";
import waitlistRouter from "./routes/waitlist.js";
import { userRouter } from "./routes/user.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

const app = express();
// Trust Render proxy (req.ip, X-Forwarded-*, secure cookies)
app.set("trust proxy", 1);
// Ensure uploads directory exists for multer disk storage
try { fs.mkdirSync('uploads', { recursive: true }); } catch {}
// credentials true required for session cookies (Vercel ↔ Render)
const frontendUrls = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter((url) => url.length > 0);
const allowedOrigins = new Set<string>([
  ...frontendUrls,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    if (origin.endsWith(".vercel.app")) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// IMPORTANT: Webhook route must be mounted BEFORE express.json() to use raw body
app.use("/stripe", stripeWebhookRouter);

// Conditional JSON parsing: 10mb for leads-import (large CSV imports), 100kb for all other routes
const json100kb = express.json({ limit: "100kb" });
const json10mb = express.json({ limit: "10mb" });
app.use((req, res, next) => {
  const url = req.originalUrl || req.url || "";
  if (url.startsWith("/api/leads-import")) {
    return json10mb(req, res, next);
  }
  return json100kb(req, res, next);
});
app.use(express.urlencoded({ limit: "100kb", extended: false }));

app.use(cookieParser());

// Security response logger (logs 401, 403, 429 if not already logged)
app.use(securityResponseLogger);

// Boot ID header middleware (only when DEV_DIAGNOSTICS is enabled)
if (DEV_DIAGNOSTICS && BOOT_ID) {
  app.use((req, res, next) => {
    res.setHeader("x-boot-id", BOOT_ID as string);
    res.setHeader("x-server-pid", String(process.pid));
    next();
  });
}

// Debug middleware - log all incoming requests (gated behind DEV_DIAGNOSTICS)
if (DEV_DIAGNOSTICS) {
  app.use((req, res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });
}

// Public health endpoint (no auth required, for proxy connectivity checks)
// Placed before auth routes to ensure it's accessible
app.get("/api/health", (req, res) => {
  const pid = process.pid;
  const port = process.env.PORT ? Number(process.env.PORT) : 3010;
  res.json({
    ok: true,
    pid,
    port,
    ts: new Date().toISOString(),
  });
});

// All routes mounted with /api prefix to match frontend expectations
app.use("/api/auth", authRouter);

// Public waitlist endpoint (no auth required)
app.use("/api/waitlist", waitlistRouter);

// Admin security routes (require both JWT + ADMIN_API_KEY)
app.use("/api/admin/security", requireAuth, adminSecurityRouter);

// =============================
// PROTECTED ROUTES
// Require authentication and valid access permissions
// Rate limiters must come AFTER requireAuth to key by req.user.id
// =============================
// LEADS ROUTES (DEV MODE) - with API rate limiting
app.use("/api/leads", requireAuth, apiRateLimiter, leadsDevRouter);

// DEALS ROUTES (DEV MODE) - with API rate limiting
app.use("/api/deals", requireAuth, apiRateLimiter, dealsDevRouter);

// ======================================
// DEV LEADS IMPORT ROUTER
// ======================================
console.log(">>> BOOT FINGERPRINT: leads-import-mount-v1");
app.use("/api/leads-import", requireAuth, apiRateLimiter, leadsImportRouter);
console.log(">>> DEV LEADS IMPORT router mounted at /api/leads-import");
console.log(">>> ROUTES: /api/leads (dev CRUD), /api/leads-import (import)");

// KPI ROUTES (DEV MODE) - with API rate limiting
// KPI VISUALIZATION DATA
// ❗ FIXED: Use the REAL KPI router instead of the dev stub
console.log(">>> Mounting REAL KPI router...");
app.use("/api/kpis", requireAuth, apiRateLimiter, makeKpisRouter(pool));
console.log(">>> REAL KPI router mounted at /api/kpis");

// REMINDERS ROUTES - conditionally apply rate limiting (skip in dev for polling)
if (process.env.NODE_ENV === "production") {
  app.use("/api/reminders", requireAuth, apiRateLimiter, remindersRouter);
  console.log(">>> Reminders router mounted at /api/reminders (with rate limiting)");
} else {
  app.use("/api/reminders", requireAuth, remindersRouter);
  console.log(">>> Reminders router mounted at /api/reminders (no rate limiting in dev)");
}

// CALENDAR ROUTES - with API rate limiting (dual-mode: DB + in-memory)
app.use("/api/calendar", requireAuth, apiRateLimiter, calendarRouter);
if (hasDatabase) {
  console.log(">>> Calendar router mounted at /api/calendar (using database)");
} else {
  console.log(">>> Calendar router mounted at /api/calendar (using in-memory store)");
}

// TASKS ROUTES - with API rate limiting (dual-mode: DB + in-memory)
app.use("/api/tasks", requireAuth, apiRateLimiter, tasksRouter);
if (hasDatabase) {
  console.log(">>> Tasks router mounted at /api/tasks (using database)");
} else {
  console.log(">>> Tasks router mounted at /api/tasks (using in-memory store)");
}

// BILLING ROUTES - with strict billing rate limiting
app.use("/api/billing", requireAuth, billingRateLimiter, billingRouter);

// USER PROFILE ROUTES - with API rate limiting
app.use("/api/user", requireAuth, apiRateLimiter, userRouter);

//------------------------------------------------------------
// 🔍 DEBUG ROUTE — Detect table mismatches (DEV ONLY)
//------------------------------------------------------------
if (isDev) {
app.get("/api/debug/db-schema", async (req, res) => {
  try {
    console.log(">>> Running DB schema diagnostics...");

    // Detect tables in the schema
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name ASC;
    `);

    const tables = tablesResult.rows.map(r => r.table_name);

    // Fetch columns for Lead and leads if they exist
    const getColumns = async (table: string) => {
      const q = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
      return q.rows.map(r => r.column_name);
    };

    const diagnostics: any = { tables };

    if (tables.includes("Lead")) {
      diagnostics["Lead_columns"] = await getColumns("Lead");
    }

    if (tables.includes("leads")) {
      diagnostics["leads_columns"] = await getColumns("leads");
    }

    // Identify mismatches
    diagnostics.mismatches = [];

    if (diagnostics["Lead_columns"] && diagnostics["leads_columns"]) {
      const leadCols = diagnostics["Lead_columns"];
      const leadsCols = diagnostics["leads_columns"];

      for (const col of leadCols) {
        if (!leadsCols.includes(col)) {
          diagnostics.mismatches.push(`Column '${col}' exists in "Lead" but NOT in leads`);
        }
      }

      for (const col of leadsCols) {
        if (!leadCols.includes(col)) {
          diagnostics.mismatches.push(`Column '${col}' exists in leads but NOT in "Lead"`);
        }
      }
    }

    return res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      diagnostics
    });

  } catch (err: any) {
    console.error(">>> DB DIAGNOSTIC ERROR:", err);
    res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown DB error"
    });
  }
});
} // end if (isDev) for debug endpoint

// Boot log: env var presence (no secret values)
const hasFrontendUrl = !!process.env.FRONTEND_URL?.trim();
const hasStripeSecretKey = !!(process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_ACTIVE_KEY?.trim());
const hasBronzePriceId = !!(process.env.STRIPE_PRICE_BRONZE_MONTHLY?.trim() || 
                             process.env.STRIPE_PRICE_ID_CREATOR_MONTHLY?.trim() || 
                             process.env.STRIPE_DEFAULT_PRICE_ID?.trim());
console.log("[BOOT ENV]", {
  hasFrontendUrl,
  hasStripeSecretKey,
  hasBronzePriceId,
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3010;

// Production: ensure ProcessedStripeEvent table exists (from prisma migrate deploy) to avoid P2021 in webhook
async function ensureProcessedStripeEventTable(): Promise<void> {
  try {
    await prisma.processedStripeEvent.findFirst({ take: 1 });
  } catch (e: any) {
    if (e?.code === "P2021") {
      console.error("ERROR: Table ProcessedStripeEvent does not exist. Run: npx prisma migrate deploy --schema prisma/schema.prisma");
      process.exit(1);
    }
    throw e;
  }
}

if (isProd && hasDatabase) {
  await ensureProcessedStripeEventTable();
}

console.log(`>>> Starting server on port ${PORT}...`);
const server = app.listen(PORT, "0.0.0.0", () => {
  const addr = server.address();
  console.log("[LISTEN ADDRESS]", addr);
  console.log(`>>> Server bound successfully`);
  console.log(`API listening on 3010`);
  console.log(`[BILLING] Stripe integration: ${
    isStripeConfigured() ? "ENABLED" : "DISABLED"
  }`);
});

// Set request timeout to 60 seconds for large imports
server.timeout = 60000;

// Start heartbeat only when DEV_DIAGNOSTICS is enabled
if (DEV_DIAGNOSTICS) {
  setInterval(() => {
    console.log("[HEARTBEAT] Server alive");
  }, 10000);
}

// Start reminder scheduler
startReminderScheduler();

// Error handler for server.listen (catches EADDRINUSE and other listen errors)
server.on('error', (err: any) => {
  console.error("[SERVER ERROR]", {
    name: err.name,
    message: err.message,
    code: err.code,
  });
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} is already in use`);
  }
  process.exit(1);
});

//------------------------------------------------------------
// 🔍 MANUAL CURL VERIFICATION CHECKLIST
//------------------------------------------------------------
// 1) Preview endpoint should respond (NOT 404):
//    curl -i -X POST http://localhost:3010/api/leads-import
//    Expected: 400/415 due to missing multipart file is OK; 404 is NOT OK.
//
// 2) Commit endpoint should respond (NOT 404) with empty payload rejection:
//    curl -i -X POST http://localhost:3010/api/leads-import/commit -H "Content-Type: application/json" -d '{"leads":[]}'
//    Expected: 400 with a JSON error; 404 is NOT OK.
