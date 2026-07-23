-- P3 (016 #182): the REAL Care corpus via the keyless CQC directory (the Syndication API 403s
-- unauthenticated clients — see data/sources.json). Record-shaped raw table like 0002; the
-- EXISTING care_signposts view repoints here, so VIEW_SQL + registry d1View stay untouched.
-- The never-filled TRUD-era nhs_services table is dropped (ODS #161 would add its own table).
-- Apply: ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config wrangler.toml

CREATE TABLE IF NOT EXISTS cqc_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT NOT NULL,
  why TEXT NOT NULL,
  official_url TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

DROP VIEW IF EXISTS care_signposts;
CREATE VIEW care_signposts AS
  SELECT id, name, authority, why,
         official_url AS officialUrl,
         last_updated AS lastUpdated,
         lat, lng
  FROM cqc_locations;

DROP TABLE IF EXISTS nhs_services;
