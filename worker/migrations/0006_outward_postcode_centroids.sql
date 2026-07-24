-- P2 (018 #224): outward-only postcode centroids for the shared gazetteer, so a bare outcode
-- (SE1, E8, N1, SW1A — the app's own free-text placeholder example "food hygiene near SE1") resolves
-- without a live geocode. ADR 0002 fetch-free hot path preserved: this INSERTs pre-computed data once;
-- origin() in worker/src/corpus/source.ts still does a single indexed SELECT keyed on whatever
-- normalisePostcode returns (a full postcode OR a bare outcode — same `postcodes` table, same lookup,
-- no code change). One centroid per outward code = AVG(lat/lng) over every FULL postcode already
-- seeded in `postcodes` sharing that outward code. On the LIVE store this averages over thousands of
-- real CQC-derived London postcodes, so centroids are good.
--
-- SAFE self-referential INSERT: a newly-inserted outcode row (e.g. "SE1") has NO space, so it can never
-- satisfy `instr(postcode, ' ') > 0` and can never feed THIS statement's aggregation, however SQLite
-- interleaves the read/write. `OR IGNORE` makes a manual re-run idempotent (an outcode key can never
-- collide with a full-postcode key — the space keeps them disjoint — cheap insurance).
--
-- ONE-TIME UNBLOCK for the store as it stands today. Durability across the daily 04:47 UTC cron swap is
-- a SEPARATE fix in ingest/seed.py (the `postcodes` table is DELETE+replaced from the published
-- postcodes.json artifact each swap): seed.py now appends outcode centroids to that artifact, so the
-- swap keeps them. Without the seed.py half these rows are wiped within 24h.
-- Apply: ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config wrangler.toml

INSERT OR IGNORE INTO postcodes (postcode, lat, lng)
  SELECT
    substr(postcode, 1, instr(postcode, ' ') - 1) AS outcode,
    AVG(lat),
    AVG(lng)
  FROM postcodes
  WHERE instr(postcode, ' ') > 0
  GROUP BY outcode;
