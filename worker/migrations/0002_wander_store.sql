-- P2 (016 #182): the REAL Wander corpus — NHLE listed buildings + OS Open Greenspace sites.
-- Raw tables are record-shaped on purpose (the P1 parsers already normalise to the frozen
-- CorpusRecord), so each view is a trivial projection and ingest-schema churn stays in ingest/.
-- Apply: ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config wrangler.toml

CREATE TABLE IF NOT EXISTS nhle_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT NOT NULL,
  why TEXT NOT NULL,
  official_url TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS greenspace_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT NOT NULL,
  why TEXT NOT NULL,
  official_url TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

-- The Wander corpus contract in SQL (registry.ts wander.d1View = "wander_places"): one corpus,
-- two sources — UNION ALL is safe because ids are namespace-prefixed (nhle-*/osgs-*).
CREATE VIEW IF NOT EXISTS wander_places AS
  SELECT id, name, authority, why,
         official_url AS officialUrl,
         last_updated AS lastUpdated,
         lat, lng
  FROM nhle_places
  UNION ALL
  SELECT id, name, authority, why,
         official_url AS officialUrl,
         last_updated AS lastUpdated,
         lat, lng
  FROM greenspace_places;
