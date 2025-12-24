import { pool } from "../src/db/pool";
import crypto from "node:crypto";

async function main() {
  await pool.query(
    `INSERT INTO leads (id, org_id, type, address, city, state, zip, address_hash)
     VALUES ($1,'org_demo','sfr','123 Main St','Newark','NJ','07102','demo_hash_1')
     ON CONFLICT DO NOTHING;`,
    [crypto.randomUUID()]
  );
  console.log("seeded");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
