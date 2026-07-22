-- W6 (#13, ADR 0002): the read-through corpus store. Raw ingested tables are SOURCE-shaped and may
-- grow columns with the source; one VIEW per corpus projects onto the frozen CorpusRecord columns —
-- the view is the corpus contract in SQL, so ingest-schema churn updates the view, not query code.
-- Apply (user-run, creds-gated): npx wrangler d1 migrations apply DB --remote

-- Raw NHS-ODS-shaped table (W4/#161 fills it via the ingester; empty until then).
CREATE TABLE IF NOT EXISTS nhs_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT NOT NULL,
  why TEXT NOT NULL,
  official_url TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

-- The Care corpus contract in SQL: exactly the CorpusRecord columns the Worker reads (registry.ts
-- care.d1View = "care_signposts").
CREATE VIEW IF NOT EXISTS care_signposts AS
  SELECT id, name, authority, why,
         official_url AS officialUrl,
         last_updated AS lastUpdated,
         lat, lng
  FROM nhs_services;

-- Shared postcode gazetteer: user-input origin resolution (the hot path can't call a geocoder
-- live). Populated at ingest via postcodes.io (OGL; GB only — never NI/BT rows, per licence).
CREATE TABLE IF NOT EXISTS postcodes (
  postcode TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

-- Freshness + rollout bookkeeping: the cron's shadow -> validate -> swap stamps (W5) and a status
-- surface (asOf itself is still derived from row lastUpdated at query time, H5-validated).
CREATE TABLE IF NOT EXISTS corpus_meta (
  corpus TEXT PRIMARY KEY,
  as_of TEXT,
  ingested_at TEXT,
  row_count INTEGER
);
