-- leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY,
  org_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sfr',
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  rural_flag BOOLEAN DEFAULT NULL,
  population_ok BOOLEAN DEFAULT NULL,
  address_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- de-dupe within org
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_org_addrhash
  ON leads(org_id, address_hash);
