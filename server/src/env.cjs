/**
 * CommonJS preload: load server/.env before any ESM runs.
 * Usage: tsx watch -r ./src/env.cjs src/server.ts
 */
const dotenv = require("dotenv");
const path = require("path");
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath, override: true });

if (process.env.NODE_ENV !== "production") {
  const db = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim() ? "EXISTS" : "MISSING";
  console.log("[ENV]", {
    DATABASE_URL: db,
    DEV_BILLING_BYPASS: process.env.DEV_BILLING_BYPASS || "(unset)",
    DEV_DIAGNOSTICS: process.env.DEV_DIAGNOSTICS || "(unset)",
    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS || "(unset)",
  });
}
