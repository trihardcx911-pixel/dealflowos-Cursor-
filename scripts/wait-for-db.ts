import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/whcrm";
const timeoutMs = Number(process.env.WAIT_TIMEOUT_MS || 30000);
const intervalMs = 1000;

async function checkOnce() {
  const pool = new Pool({ connectionString });
  try {
    await pool.query("SELECT 1");
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => {});
    return false;
  }
}

(async () => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkOnce()) {
      console.log("[wait:db] ready");
      process.exit(0);
    }
    console.log("[wait:db] not ready, retrying...");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.error("[wait:db] timeout");
  process.exit(1);
})();
