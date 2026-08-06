// The corpus DATA-source seam (W6 #13, ADR 0002): where records + the postcode gazetteer come from.
// Labels/official links stay in registry.ts (curated, reviewed TS) — NEVER in a source — so a data
// slip can't alter copy or links. Two implementations: the bundled sample JSON (default, and the
// outage fallback) and a CF D1 store read through one SQL view per corpus (worker/migrations/*).
import type { BBox, Coords } from "../geo";
import { FRESHNESS_SQL } from "../freshness";
import type { CorpusRecord } from "./contract";

// Threaded from the request (worker.ts ModelCtx) into deterministic query stages. Optional end to
// end: absent in tests and local dev → the bundled path, so no test or dev flow needs a database.
export interface QueryCtx {
  db?: D1Database | undefined;
}

export interface CorpusSource {
  origin(postcode: string): Promise<Coords | null>;
  // P2b (017): `bbox` PREFILTERS the read to a lat/lng band around the origin (bound-parameter, static
  // SQL — ADR 0002 preserved) so D1 seeks an index instead of scanning the whole view; `origin` orders
  // by proximity so the LIMIT keeps the nearest. Absent ⇒ the full unbounded read (the widen-retry's
  // final fallback + the empty-view guard). The bundled source is in-memory and ignores both.
  records(bbox?: BBox, origin?: Coords): Promise<CorpusRecord[]>;
  // 022: how many records this source holds in total — the pool the nearest-N were ranked from.
  // OPTIONAL: a source that cannot say (the bundled sample) simply omits it, and the render then makes
  // no claim. Cosmetic by contract — query.ts must never let this read fail a user's answer.
  size?(): Promise<number | null>;
}

// The bundled static-JSON corpus (compile-checked against CorpusRecord in registry.ts). Resolves
// instantly; also the fallback when D1 is unbound or down.
export function bundledSource(def: {
  records: CorpusRecord[];
  postcodes: Record<string, Coords>;
}): CorpusSource {
  return {
    // noUncheckedIndexedAccess: an unknown postcode is undefined → null, mirroring a D1 miss.
    origin: (postcode) => Promise.resolve(def.postcodes[postcode] ?? null),
    // In-memory + tiny → the bbox/origin hints are irrelevant; return all and let nearestN rank.
    records: () => Promise.resolve(def.records),
  };
}

// Reject any row that doesn't match the frozen CorpusRecord — a malformed ingest row must never
// reach the render. Narrow via Record<string, unknown>, never `as Partial<T>` (see AGENT_LEARNINGS).
// Exported: the ingest cron (ingest.ts) applies the SAME guard to untrusted artifacts (DRY).
export function isCorpusRecord(v: unknown): v is CorpusRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["id"] === "string" &&
    typeof r["name"] === "string" &&
    typeof r["authority"] === "string" &&
    typeof r["why"] === "string" &&
    typeof r["officialUrl"] === "string" &&
    typeof r["lastUpdated"] === "string" &&
    typeof r["lat"] === "number" &&
    typeof r["lng"] === "number"
  );
}

// Fully STATIC SQL per registered view — no runtime string-building near the database, so the
// statement set is closed + reviewable (safe by construction, not by argument). A new corpus view
// adds one entry here alongside its registry `d1View` and migration.
const VIEW_SQL: Record<string, string> = {
  care_signposts:
    "SELECT id, name, authority, why, officialUrl, lastUpdated, lat, lng FROM care_signposts",
  wander_places:
    "SELECT id, name, authority, why, officialUrl, lastUpdated, lat, lng FROM wander_places",
  food_hygiene:
    "SELECT id, name, authority, why, officialUrl, lastUpdated, lat, lng FROM food_hygiene",
};

// P2b (017): the bbox prefilter suffix, appended to the STATIC base select above (two static constants
// concatenated — still a closed statement, no user data in the string; the box + origin + weight + cap
// are BOUND params ?1–?8, ADR 0002 preserved). `WHERE lat/lng BETWEEN` lets D1 seek the (lat,lng) index
// (migration 0005) instead of scanning the view; `ORDER BY` a cos-weighted squared-degree proximity
// keeps the LIMITed rows the NEAREST, so a cap can't drop a true-nearest. nearestN re-ranks by exact
// haversine. ?7 = cos²(originLat) rescales longitude-degrees to latitude-equivalent distance.
const BBOX_SUFFIX =
  " WHERE lat BETWEEN ?1 AND ?2 AND lng BETWEEN ?3 AND ?4" +
  " ORDER BY (lat - ?5) * (lat - ?5) + (lng - ?6) * (lng - ?6) * ?7 LIMIT ?8";
// Nearest-by-proxy rows to return from a bounded read — well above the workflow's n (5 since 022), so
// the true nearest-N are always within the capped set even allowing for the proxy's small skew. Raising
// n costs no extra D1 read while it stays far below this cap.
const BBOX_CAP = 50;

// 022: which ingested corpora feed each D1 view, for the pool count on the summary card. `wander_places`
// UNIONs two ingests, so its pool is the SUM — never one arm of it. A static closed map, mirroring
// VIEW_SQL above: a new view declares its meta keys here, consciously, or reports no size at all.
const VIEW_META_KEYS: Record<string, readonly string[]> = {
  care_signposts: ["care"],
  wander_places: ["wander-greenspace", "wander-nhle"],
  food_hygiene: ["food-hygiene"],
};
const toRad = (deg: number): number => (deg * Math.PI) / 180;

// A corpus read through its D1 view (the CorpusRecord contract in SQL — see worker/migrations).
export function d1Source(db: D1Database, view: string): CorpusSource {
  return {
    origin: async (postcode) => {
      const row = await db
        .prepare("SELECT lat, lng FROM postcodes WHERE postcode = ?1")
        .bind(postcode)
        .first<{ lat: number; lng: number }>();
      if (row !== null && typeof row.lat === "number" && typeof row.lng === "number") {
        return { lat: row.lat, lng: row.lng };
      }
      // Distinguish a genuine miss from a NOT-YET-SEEDED store (provisioned before ingest — A2/#13
      // lands ahead of W4/#161): an empty gazetteer must degrade to the bundled sample, not answer
      // every postcode with an empty state. Throwing routes through queryCorpus's fallback.
      const seeded = await db.prepare("SELECT postcode FROM postcodes LIMIT 1").first();
      if (seeded === null) {
        throw new Error("d1Source: postcodes gazetteer is empty — store not seeded yet");
      }
      return null;
    },
    records: async (bbox, origin) => {
      const base = VIEW_SQL[view];
      // An unregistered view is a programming error; the throw is caught by queryCorpus, which
      // degrades to the bundled sample rather than a broken stream.
      if (base === undefined) throw new Error(`d1Source: no SQL registered for view "${view}"`);
      // BOUNDED read (P2b): the bbox prefilter. An empty result here is a legitimate "nothing nearby
      // at this radius" → return [] so the widen-retry can widen; NEVER the empty-view guard (that
      // would wrongly trigger the bundled fallback for a simply-empty box).
      if (bbox && origin) {
        const cosLat = Math.max(Math.cos(toRad(origin.lat)), 0.01);
        const rs = await db
          .prepare(base + BBOX_SUFFIX)
          .bind(bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng, origin.lat, origin.lng, cosLat * cosLat, BBOX_CAP)
          .all();
        return (rs.results as unknown[]).filter(isCorpusRecord);
      }
      // UNBOUNDED read: the widen-retry's final fallback AND the not-yet-swapped guard point.
      const rs = await db.prepare(base).all();
      // Widen to unknown[] first: an interface has no implicit index signature, so the type-guard
      // filter only narrows from unknown, not from D1's Record<string, unknown> rows.
      const rows: unknown[] = rs.results;
      const valid = rows.filter(isCorpusRecord);
      // P1 (#182): an empty view can only be a NOT-YET-SWAPPED corpus — the cron's swap gate
      // refuses <50 rows, so a live view is never legitimately empty. Throwing routes through
      // queryCorpus's bundled fallback (the gazetteer seed-probe pattern above, #171), so seeding
      // the gazetteer alone can never strand a corpus on an empty D1 answer.
      if (valid.length === 0) {
        throw new Error(`d1Source: view "${view}" has no valid rows — corpus not swapped yet`);
      }
      return valid;
    },
    // 022: the pool the nearest-N were ranked from. Reuses FRESHNESS_SQL — the same reviewed static
    // statement already serving /api/freshness (DRY: one corpus_meta read shape, not two) — over a
    // table of a handful of rows, so it is negligible beside the bbox read. Summing in JS keeps the SQL
    // closed and static (no IN-list built per view). An unmapped view or a missing/blank meta row
    // yields null, i.e. no claim.
    size: async () => {
      const keys = VIEW_META_KEYS[view];
      if (keys === undefined) return null;
      const rs = await db.prepare(FRESHNESS_SQL).all();
      const rows = rs.results as unknown[];
      let total = 0;
      for (const raw of rows) {
        const row = raw as { corpus?: unknown; row_count?: unknown };
        if (typeof row.corpus === "string" && keys.includes(row.corpus) && typeof row.row_count === "number") {
          total += row.row_count;
        }
      }
      return total > 0 ? total : null;
    },
  };
}
