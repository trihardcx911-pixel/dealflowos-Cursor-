import { createClient } from "redis";

const url = process.env.REDIS_URL || "redis://localhost:6379";
const timeoutMs = Number(process.env.WAIT_TIMEOUT_MS || 30000);
const intervalMs = 1000;

async function checkOnce() {
  const client = createClient({ url });
  try {
    await client.connect();
    const pong = await client.ping();
    await client.disconnect();
    return pong === "PONG";
  } catch {
    try { await client.disconnect(); } catch {}
    return false;
  }
}

(async () => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkOnce()) {
      console.log("[wait:redis] ready");
      process.exit(0);
    }
    console.log("[wait:redis] not ready, retrying...");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.error("[wait:redis] timeout");
  process.exit(1);
})();
