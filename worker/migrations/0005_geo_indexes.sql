-- P2b (017 #201): geo indexes for the bbox prefilter. Without these a `WHERE lat BETWEEN … AND lng
-- BETWEEN …` on a corpus view still SCANS every row of the underlying raw table — D1 bills rows
-- SCANNED, not returned, so the prefilter would be a measured-green production no-op (see PR #206).
-- A composite (lat, lng) index lets SQLite seek the latitude band and filter longitude from the
-- index, cutting rows scanned from the whole table to the band around the origin.
--
-- One index per RAW corpus table (the views are trivial projections; the wander view UNIONs two
-- tables, so both are indexed). Idempotent + additive — safe to pre-stage and apply anytime.
-- Verify after apply (the P2b done-when, owner-run once creds land — a stub cannot model scanning):
--   EXPLAIN QUERY PLAN … must show the index (not SCAN); a food-hygiene bbox query's meta.rows_read
--   must fall from tens of thousands to hundreds (target ≥10x). CI: dispatch d1-verify (bbox_plan,
--   bbox_rows_read).
-- Apply: ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config wrangler.toml

CREATE INDEX IF NOT EXISTS idx_cqc_locations_lat_lng ON cqc_locations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_nhle_places_lat_lng ON nhle_places (lat, lng);
CREATE INDEX IF NOT EXISTS idx_greenspace_places_lat_lng ON greenspace_places (lat, lng);
CREATE INDEX IF NOT EXISTS idx_fhrs_establishments_lat_lng ON fhrs_establishments (lat, lng);
