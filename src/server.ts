// Load environment variables from .env before any other imports
import * as dotenv from "dotenv";
dotenv.config();
console.log(">>> BOOT FINGERPRINT: leads-import-mount-v1");

console.log(">>> SERVER BOOTED", new Date().toISOString());

import express from "express";
import cors from "cors";
import fs from "fs";
import { z } from "zod";
import calendarRouter from "./routes/calendar";
// ❌ Remove production KPI router (needs auth + Prisma, breaks dev)
// import kpiRoutes from "./routes/kpis-v2";
// ✅ Use the DEV KPI router (in-memory analytics)
import { makeKpisRouter } from "./routes/kpis";
import { leadsDevRouter } from "./routes/leads.dev";  // ✅ Add this
import { pool } from "./db/pool";

const app = express();
app.use("/api/leads-import", leadsImportRouter);
console.log(">>> DEV LEADS IMPORT router mounted at /api/leads-import");

// Ensure uploads directory exists for multer disk storage
try { 
  fs.mkdirSync('uploads', { recursive: true }); 
} catch {}

// CORS tightened: allow only local Vite app and disable credentials
app.use(cors({ origin: "http://localhost:5173", credentials: false }));
app.use(express.json());

// Debug middleware - log all incoming requests
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});


// ===========================================
// DEV AUTH ROUTES - NO DATABASE DEPENDENCY
// ===========================================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login - Dev mode login (always works, no Postgres)
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    // Dev mode: always return a token (no database check)
    const token = `dev_token_${Buffer.from(email).toString("base64")}_${Date.now()}`;
    
    return res.json({
      token,
      user: {
        email,
        id: `user_${Buffer.from(email).toString("base64").substring(0, 8)}`,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: err.errors[0]?.message || "Invalid request",
      });
    }
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  }
});

// POST /api/auth/signup - Dev mode signup (always works, no Postgres)
app.post("/api/auth/signup", (req, res) => {
  try {
    const { email, password } = signupSchema.parse(req.body);
    
    // Dev mode: always return success (no database write)
    return res.json({
      message: "User created successfully",
      user: {
        email,
        id: `user_${Buffer.from(email).toString("base64").substring(0, 8)}`,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: err.errors[0]?.message || "Invalid request",
      });
    }
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  }
});

console.log(">>> DEV AUTH ROUTES ACTIVE ON /api/auth/*");

// Calendar routes
app.use("/api/calendar", calendarRouter);

// ======================================
// DEV LEADS ROUTER — REQUIRED FOR CREATE
// ======================================
app.use("/api/leads", leadsDevRouter);  // ✅ This enables POST /api/leads
console.log(">>> DEV LEADS router mounted at /api/leads");

// =======================================
// DEV KPI ROUTES — IN-MEMORY ANALYTICS
// =======================================
console.log(">>> Mounting DEV KPI router (in-memory)...");
app.use("/api/kpis", makeKpisRouter(pool));
console.log(">>> DEV KPI router mounted at /api/kpis");

// Error handler middleware - must be last
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("========================================");
  console.error("[ERROR HANDLER] Unhandled error caught");
  console.error("========================================");
  console.error("Path:", req.path);
  console.error("Method:", req.method);
  console.error("Error:", err);
  console.error("Error message:", err?.message);
  console.error("Stack:", err?.stack);
  console.error("========================================");
  
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || "InternalServerError",
    message: err.message || "An unexpected error occurred",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT ?? 3010;
app.listen(PORT, () => {
  console.log("API listening on", PORT);
  console.log(">>> KPI routes available at /api/kpis");
});

/**
 * TEST INSTRUCTIONS:
 * 
 * Test login endpoint:
 * curl -X POST http://localhost:3010/api/auth/login \
 *   -d '{"email":"test@example.com","password":"123"}' \
 *   -H "Content-Type: application/json"
 * 
 * Expected response (DEV_AUTH_BYPASS=true):
 * {"token":"dev_token_...","user":{"email":"test@example.com","id":"user_..."}}
 * 
 * Test signup endpoint:
 * curl -X POST http://localhost:3010/api/auth/signup \
 *   -d '{"email":"test@example.com","password":"123"}' \
 *   -H "Content-Type: application/json"
 * 
 * Expected response (DEV_AUTH_BYPASS=true):
 * {"message":"User created successfully","user":{"email":"test@example.com","id":"user_..."}}
 * 
 * Test KPI lead-sources endpoint:
 * curl http://localhost:3010/api/kpis/lead-sources?orgId=default-org
 * 
 * Expected response:
 * [{"source":"cold_call","count":3},{"source":"sms","count":1},...]
 */
