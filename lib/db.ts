import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Use the Supabase "Transaction pooler" connection string.',
    );
  }
  return url;
}

export function sql() {
  if (_sql) return _sql;
  _sql = postgres(connectionString(), {
    ssl: 'require',
    prepare: false, // Supabase pgbouncer-style poolers require non-prepared statements
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return _sql;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS scans (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'running',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS brands (
  id BIGSERIAL PRIMARY KEY,
  scan_id BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  homepage_title TEXT,
  meta_description TEXT,
  product_category TEXT,
  amazon_url TEXT,
  shopify_detected INTEGER DEFAULT 0,
  socials_json TEXT,
  raw_sources_json TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  category_fit INTEGER DEFAULT 0,
  semrush_organic_traffic BIGINT,
  semrush_paid_traffic BIGINT,
  semrush_keywords INTEGER,
  traffic_score INTEGER,
  meta_ads_found INTEGER,
  meta_active_ad_count INTEGER,
  meta_confidence INTEGER,
  meta_main_offer TEXT,
  meta_creative_types TEXT,
  meta_top_hooks TEXT,
  meta_ads_score INTEGER,
  meta_ad_library_url TEXT,
  best_email TEXT,
  email_confidence INTEGER,
  hunter_emails_json TEXT,
  hunter_company_json TEXT,
  contact_score INTEGER,
  amazon_dtc_score INTEGER,
  lead_score INTEGER,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scan_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_brands_scan ON brands(scan_id);
CREATE INDEX IF NOT EXISTS idx_brands_score ON brands(lead_score DESC);

CREATE TABLE IF NOT EXISTS schedules (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  cadence_days INTEGER NOT NULL DEFAULT 7,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operator workflow columns (added in v0.2). Idempotent.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS user_status TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS user_notes TEXT;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS user_updated_at TIMESTAMPTZ;

-- Outreach draft history (v0.3).
CREATE TABLE IF NOT EXISTS drafts (
  id BIGSERIAL PRIMARY KEY,
  brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  notes TEXT,
  tone TEXT,
  sender_pitch TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_drafts_brand ON drafts(brand_id);

-- Saved categories from brainstorm output (v0.4).
CREATE TABLE IF NOT EXISTS saved_categories (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  rationale TEXT,
  amazon_fit INTEGER,
  dtc_potential INTEGER,
  meta_ad_likelihood INTEGER,
  brand_density INTEGER,
  example_brands TEXT,
  last_scan_id BIGINT REFERENCES scans(id) ON DELETE SET NULL,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category)
);
`;

export async function migrate() {
  await sql().unsafe(SCHEMA_SQL);
}
