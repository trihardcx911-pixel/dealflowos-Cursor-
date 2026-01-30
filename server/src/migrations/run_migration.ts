/**
 * Run migration: Add Firebase authentication fields to User table
 * 
 * Usage: tsx src/migrations/run_migration.ts
 */

import { pool } from "../db/pool.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    const migrationSQL = readFileSync(
      join(__dirname, "add_firebase_user_fields.sql"),
      "utf-8"
    );

    console.log("[MIGRATION] Running Firebase user fields migration...");
    await pool.query(migrationSQL);
    console.log("[MIGRATION] Migration completed successfully");

    await pool.end();
  } catch (error: any) {
    console.error("[MIGRATION] Error:", error);
    process.exit(1);
  }
}

runMigration();










