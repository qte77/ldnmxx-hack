// The corpus DATA-source seam (W6 #13, ADR 0002): where records + the postcode gazetteer come from.
// Labels/official links stay in registry.ts (curated, reviewed TS) — NEVER in a source — so a data
// slip can't alter copy or links. Two implementations: the bundled sample JSON (default, and the
// outage fallback) and a CF D1 store read through one SQL view per corpus (worker/migrations/*).
import type { Coords } from "../geo";
import type { CorpusRecord } from "./contract";

// Threaded from the request (worker.ts ModelCtx) into deterministic query stages. Optional end to
// end: absent in tests and local dev → the bundled path, so no test or dev flow needs a database.
export interface QueryCtx {
  db?: D1Database | undefined;
}

export interface CorpusSource {
  origin(postcode: string): Promise<Coords | null>;
  records(): Promise<CorpusRecord[]>;
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
    records: () => Promise.resolve(def.records),
  };
}

// Reject any D1 row that doesn't match the frozen CorpusRecord — a malformed ingest row must never
// reach the render. Narrow via Record<string, unknown>, never `as Partial<T>` (see AGENT_LEARNINGS).
function isCorpusRecord(v: unknown): v is CorpusRecord {
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
};

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
    records: async () => {
      const sql = VIEW_SQL[view];
      // An unregistered view is a programming error; the throw is caught by queryCorpus, which
      // degrades to the bundled sample rather than a broken stream.
      if (sql === undefined) throw new Error(`d1Source: no SQL registered for view "${view}"`);
      const rs = await db.prepare(sql).all();
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
  };
}
