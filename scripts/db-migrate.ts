import { pool } from "../src/db/pool";

async function main() {
  // Ensure UUID generation is available (for DB-side defaults if ever used)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // Organizations (aligns with Prisma schema mappings)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id              text primary key,
      name            text not null,
      timezone        text not null default 'America/New_York',
      market_profile  text not null default 'metro_sfr',
      created_at      timestamptz default now()
    );
  `);

  // Lead type enum (idempotent)
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE lead_type AS ENUM ('sfr','land','multi','other');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Leads table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id             uuid primary key default gen_random_uuid(),
      org_id         text not null references organizations(id) on delete cascade,
      type           lead_type not null default 'sfr',
      address        text not null,
      city           text not null,
      state          text not null,
      zip            text not null,
      address_hash   text not null,
      notes          text,
      rural_flag     boolean not null default false,
      population_ok  boolean not null default true,
      land_signals   jsonb,
      legal_flag     boolean not null default false,
      created_at     timestamptz default now()
    );
    -- Composite unique to prevent duplicates per-org per-address hash
    CREATE UNIQUE INDEX IF NOT EXISTS "orgId_addressHash" ON leads(org_id, address_hash);
    CREATE INDEX IF NOT EXISTS leads_org_type_rural_idx ON leads(org_id, type, rural_flag);
  `);

  // Lead contacts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_contacts (
      id             uuid primary key default gen_random_uuid(),
      lead_id        uuid not null references leads(id) on delete cascade,
      type           text not null,
      value          text not null,
      source         text,
      verified_at    timestamptz,
      dnc_status     text,
      dnc_checked_at timestamptz,
      created_at     timestamptz default now(),
      updated_at     timestamptz default now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS lead_contacts_unique ON lead_contacts(lead_id, type, value);
    CREATE INDEX IF NOT EXISTS lead_contacts_lead_type_idx ON lead_contacts(lead_id, type);
  `);

  // Demo org (idempotent)
  await pool.query(`
    INSERT INTO organizations (id, name)
    VALUES ('org_demo','Demo Org')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  `);

  console.log("Migration complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
