-- P4 (016 #182): Sort My Food Hygiene — the register-only proof at scale (FHRS, OGL). Same
-- record-shaped raw-table + trivial-projection-view pattern as 0002/0003.
-- Apply: ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config wrangler.toml

CREATE TABLE IF NOT EXISTS fhrs_establishments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority TEXT NOT NULL,
  why TEXT NOT NULL,
  official_url TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

CREATE VIEW IF NOT EXISTS food_hygiene AS
  SELECT id, name, authority, why,
         official_url AS officialUrl,
         last_updated AS lastUpdated,
         lat, lng
  FROM fhrs_establishments;
