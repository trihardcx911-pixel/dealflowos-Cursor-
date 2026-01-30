import { Pool } from "pg";

// Ensure DATABASE_URL is present - throw if missing instead of using fallback
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("[DB] DATABASE_URL is required but not set in server/.env");
}

// Dev-only: Parse and log connection details (no secrets)
if (process.env.NODE_ENV !== "production") {
  try {
    // Parse connection string URL to extract user, host, port, database (not password)
    const url = new URL(databaseUrl);
    const dbUser = url.username || "not_specified";
    const dbHost = url.hostname || "not_specified";
    const dbPort = url.port || "5432";
    const dbName = url.pathname?.replace(/^\//, "") || "not_specified";
    console.log("[DB POOL] Connection config:", {
      dbUser,
      dbHost,
      dbPort,
      dbName,
      hasPassword: !!url.password,
    });
  } catch (parseError) {
    // If URL parsing fails, log a warning but continue (connection string might still work)
    console.warn("[DB POOL] Could not parse DATABASE_URL for logging:", parseError instanceof Error ? parseError.message : String(parseError));
  }
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

// Dev-only: Test connection and log current_user on boot
if (process.env.NODE_ENV !== "production") {
  pool.query('SELECT current_user, current_database()')
    .then((result) => {
      const row = result.rows[0];
      console.log("[DB] current_user=" + row.current_user + ", current_database=" + row.current_database);
    })
    .catch((error: any) => {
      console.error("[DB] Cannot connect to database:", {
        code: error.code,
        message: error.message,
        severity: error.severity,
      });
      throw new Error(`[DB] Cannot connect with pg error code ${error.code || 'unknown'}: ${error.message}`);
    });
}



