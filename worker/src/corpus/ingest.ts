// P1 (#182): the cron's ingest planner — release asset -> shadow table -> validate -> atomic swap
// -> corpus_meta stamp. The pure pieces (shape guards, the swap gate, batching arithmetic, the
// shadow/swap sequence) are module-TDD'd against a recording D1 stub; the fetch/handler glue
// (runIngest, worker.ts scheduled()) is proven by REAL Action + cron runs, never mocks.
//
// Table names are interpolated ONLY from INGEST_TARGETS — a closed, reviewable literal set (the
// VIEW_SQL principle): no runtime string-building near the database from data.
//
// The swap deliberately avoids ALTER TABLE RENAME: SQLite (3.25+) rewrites view definitions when a
// referenced table is renamed, which would silently repoint a corpus view at the retired table.
// DELETE + INSERT..SELECT + DROP inside one db.batch() is transactional and view-safe.
import { oldestIsoDate } from "../dates";
import type { CorpusRecord } from "./contract";
import { getCorpus } from "./registry";
import { isCorpusRecord } from "./source";

export interface IngestTarget {
  corpus: string; // corpus_meta key ("gazetteer" or "<registryId>-<source>" for multi-source corpora)
  artifact: string; // release asset filename under the rolling `corpus-data` tag
  table: string; // live D1 table (worker/migrations/*)
  kind: "gazetteer" | "corpus";
  minRows: number; // the swap gate: fewer rows than this and the live table is left untouched
  attributionOf?: string; // registry id whose labels.attribution gates this target (default: corpus)
}

// The closed set the cron may touch. P1: the postcode gazetteer (machinery prover). P2: the two
// wander raw tables — one corpus, two sources, each gated by the wander registry attribution.
export const INGEST_TARGETS: IngestTarget[] = [
  { corpus: "gazetteer", artifact: "postcodes.json", table: "postcodes", kind: "gazetteer", minRows: 1000 },
  {
    corpus: "wander-nhle",
    artifact: "nhle.json",
    table: "nhle_places",
    kind: "corpus",
    minRows: 1000,
    attributionOf: "wander",
  },
  {
    corpus: "wander-greenspace",
    artifact: "greenspace.json",
    table: "greenspace_places",
    kind: "corpus",
    minRows: 500,
    attributionOf: "wander",
  },
  // P3: care via the keyless CQC directory CSV (9.3k London locations at first fill).
  { corpus: "care", artifact: "cqc.json", table: "cqc_locations", kind: "corpus", minRows: 1000 },
  // P4: food hygiene via FHRS (62.9k London establishments at first fill).
  {
    corpus: "food-hygiene",
    artifact: "fhrs.json",
    table: "fhrs_establishments",
    kind: "corpus",
    minRows: 1000,
  },
];

export interface GazetteerRow {
  postcode: string;
  lat: number;
  lng: number;
}

export type IngestRow = GazetteerRow | CorpusRecord;

// Shape-guard an untrusted artifact into gazetteer rows: malformed rows are dropped (never throw),
// NI/BT postcodes are excluded (separate non-commercial licence — defence in depth, the parser
// already filters), duplicates dedupe first-wins.
export function gazetteerRows(data: unknown): GazetteerRow[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: GazetteerRow[] = [];
  for (const v of data as unknown[]) {
    if (typeof v !== "object" || v === null) continue;
    const r = v as Record<string, unknown>;
    if (typeof r["postcode"] !== "string" || typeof r["lat"] !== "number" || typeof r["lng"] !== "number") {
      continue;
    }
    const postcode = r["postcode"];
    if (postcode.toUpperCase().startsWith("BT")) continue;
    if (seen.has(postcode)) continue;
    seen.add(postcode);
    out.push({ postcode, lat: r["lat"], lng: r["lng"] });
  }
  return out;
}

// Shape-guard an untrusted artifact into CorpusRecords (the frozen-contract guard from source.ts).
export function corpusRows(data: unknown): CorpusRecord[] {
  if (!Array.isArray(data)) return [];
  return (data as unknown[]).filter(isCorpusRecord);
}

export type SwapGate = { ok: true } | { ok: false; reason: string };

// The gate that keeps a bad artifact out of the live store: a shrunken/broken fetch must never
// replace good data, and a CORPUS must carry its licence-obligation strings (registry attribution)
// before real data may serve — the obligation as a hard gate, not convention.
export function swapGate(target: IngestTarget, rowCount: number, attribution: string[]): SwapGate {
  if (rowCount < target.minRows) {
    return { ok: false, reason: `${target.corpus}: ${String(rowCount)} rows < minRows ${String(target.minRows)}` };
  }
  if (target.kind === "corpus" && attribution.length === 0) {
    return { ok: false, reason: `${target.corpus}: registry attribution is empty — licence gate refuses the swap` };
  }
  return { ok: true };
}

// D1 bound-parameter batching: split rows so each INSERT stays within the parameter budget.
export function chunkRows<T>(rows: readonly T[], paramsPerRow: number, maxParams = 90): T[][] {
  const perChunk = Math.max(1, Math.floor(maxParams / paramsPerRow));
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += perChunk) chunks.push(rows.slice(i, i + perChunk));
  return chunks;
}

const COLUMNS: Record<IngestTarget["kind"], string[]> = {
  gazetteer: ["postcode", "lat", "lng"],
  corpus: ["id", "name", "authority", "why", "official_url", "last_updated", "lat", "lng"],
};

function rowParams(kind: IngestTarget["kind"], row: IngestRow): (string | number)[] {
  if (kind === "gazetteer") {
    const g = row as GazetteerRow;
    return [g.postcode, g.lat, g.lng];
  }
  const c = row as CorpusRecord;
  return [c.id, c.name, c.authority, c.why, c.officialUrl, c.lastUpdated, c.lat, c.lng];
}

export interface IngestResult {
  swapped: boolean;
  rowCount: number;
  reason?: string;
}

// shadow -> validate -> swap for ONE target. Pre-gates on the parsed rows (cheap refusal before any
// database work), re-gates on the server-side shadow COUNT (the truth), then swaps atomically.
export async function ingestArtifact(
  db: D1Database,
  target: IngestTarget,
  rows: readonly IngestRow[],
  attribution: string[]
): Promise<IngestResult> {
  const pre = swapGate(target, rows.length, attribution);
  if (!pre.ok) return { swapped: false, rowCount: rows.length, reason: pre.reason };

  const shadow = `${target.table}_shadow`;
  const cols = COLUMNS[target.kind];
  await db.prepare(`DROP TABLE IF EXISTS ${shadow}`).run();
  await db.prepare(`CREATE TABLE ${shadow} AS SELECT * FROM ${target.table} WHERE 0`).run();
  for (const chunk of chunkRows(rows, cols.length)) {
    const placeholders = chunk.map(() => `(${cols.map(() => "?").join(",")})`).join(",");
    const params = chunk.flatMap((r) => rowParams(target.kind, r));
    await db
      .prepare(`INSERT INTO ${shadow} (${cols.join(",")}) VALUES ${placeholders}`)
      .bind(...params)
      .run();
  }

  const counted = await db.prepare(`SELECT COUNT(*) AS n FROM ${shadow}`).first<{ n: number }>();
  const n = typeof counted?.n === "number" ? counted.n : 0;
  const gate = swapGate(target, n, attribution);
  if (!gate.ok) return { swapped: false, rowCount: n, reason: gate.reason };

  const asOf =
    target.kind === "corpus" ? oldestIsoDate(rows.map((r) => (r as CorpusRecord).lastUpdated)) : null;
  await db.batch([
    db.prepare(`DELETE FROM ${target.table}`),
    db.prepare(`INSERT INTO ${target.table} SELECT * FROM ${shadow}`),
    db.prepare(`DROP TABLE ${shadow}`),
    db
      .prepare(
        "INSERT INTO corpus_meta (corpus, as_of, ingested_at, row_count) VALUES (?1, ?2, ?3, ?4) " +
          "ON CONFLICT(corpus) DO UPDATE SET as_of = excluded.as_of, " +
          "ingested_at = excluded.ingested_at, row_count = excluded.row_count"
      )
      .bind(target.corpus, asOf, new Date().toISOString(), n),
  ]);
  return { swapped: true, rowCount: n };
}

// Where the ingester Action publishes the normalised artifacts (a rolling release tag on the public
// repo — keyless to read; no CF credential ever enters CI, no GitHub credential ever enters the Worker).
const ASSET_BASE = "https://github.com/qte77/ldnmxx-hack/releases/download/corpus-data";

// The cron's glue: fetch each target's artifact and run the tested planner. Deliberately NOT
// unit-tested (verify-live rule) — a failed/short/missing artifact is logged and skipped, never
// allowed to touch the live store (the gate above), and never throws out of the handler.
export async function runIngest(db: D1Database): Promise<void> {
  for (const target of INGEST_TARGETS) {
    try {
      const res = await fetch(`${ASSET_BASE}/${target.artifact}`, { redirect: "follow" });
      if (!res.ok) {
        console.warn(`ingest ${target.corpus}: asset fetch ${String(res.status)} — skipped`);
        continue;
      }
      const data: unknown = await res.json();
      const rows = target.kind === "gazetteer" ? gazetteerRows(data) : corpusRows(data);
      const attribution =
        target.kind === "corpus"
          ? (getCorpus(target.attributionOf ?? target.corpus)?.labels.attribution ?? [])
          : [];
      const out = await ingestArtifact(db, target, rows, attribution);
      console.log(
        `ingest ${target.corpus}: swapped=${String(out.swapped)} rows=${String(out.rowCount)}` +
          (out.reason === undefined ? "" : ` (${out.reason})`)
      );
    } catch (err) {
      console.warn(`ingest ${target.corpus} failed:`, err);
    }
  }
}
