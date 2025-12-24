console.log(">>> ACTIVE BACKEND:", __filename);

import * as dotenv from "dotenv";
dotenv.config();

// Temporary: Verify DATABASE_URL loading (remove after verification)
console.log(">>> DATABASE_URL loaded:", process.env.DATABASE_URL ? "EXISTS" : "MISSING");
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  // Log first 30 chars and last 10 chars to verify without exposing full credentials
  console.log(">>> DATABASE_URL preview:", dbUrl.substring(0, 30) + "..." + dbUrl.substring(dbUrl.length - 10));
}

import express from "express";
import cors from "cors";
import fs from "fs";
import { leadsImportRouter } from "./routes/leads.import.js";
import { leadsDevRouter } from "./routes/leads.dev.js";
import { kpisDevRouter } from "./routes/kpis.dev.js";  // KEEP import for now (not used)
import { makeKpisRouter } from "./routes/kpis.js";     // This is the REAL KPI router
import { authRouter } from "./routes/auth.js";
import calendarRouter from "./routes/calendar.js";
import { billingRouter } from "./routes/billing.js";
import { stripeWebhookRouter } from "./routes/stripeWebhook.js";
import { pool } from "./db/pool.js";
import { isStripeConfigured } from "./billing/stripeClient.js";

const app = express();
// Ensure uploads directory exists for multer disk storage
try { fs.mkdirSync('uploads', { recursive: true }); } catch {}
// CORS tightened: allow only local Vite app and disable credentials
app.use(cors({ origin: "http://localhost:5173", credentials: false }));

// IMPORTANT: Webhook route must be mounted BEFORE express.json() to use raw body
app.use("/stripe", stripeWebhookRouter);

// Now apply JSON parsing for all other routes
app.use(express.json());

// Debug middleware - log all incoming requests
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});

// All routes mounted with /api prefix to match frontend expectations
app.use("/api/auth", authRouter);

// =============================
// LEADS ROUTES (DEV MODE)
// =============================
app.use("/api/leads", leadsDevRouter);

// =============================
// KPI ROUTES (DEV MODE)
// KPI VISUALIZATION DATA
// =============================
// ❗ FIXED: Use the REAL KPI router instead of the dev stub
console.log(">>> Mounting REAL KPI router...");
app.use("/api/kpis", makeKpisRouter(pool));
console.log(">>> REAL KPI router mounted at /api/kpis");
app.use("/api/calendar", calendarRouter);
app.use("/api/billing", billingRouter);

//------------------------------------------------------------
// 🔍 DEBUG ROUTE — Detect table mismatches (SAFE TO ADD)
//------------------------------------------------------------
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

const PORT = process.env.PORT ? Number(process.env.PORT) : 3010;
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
  console.log(`[BILLING] Stripe integration: ${
    isStripeConfigured() ? "ENABLED" : "DISABLED"
  }`);
});
