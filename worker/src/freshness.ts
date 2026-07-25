// Public GET /api/freshness — the read-only surface a credential-free CI watchdog polls to detect a
// silently-dead ingest cron. The Worker does one static SELECT over corpus_meta (ADR-0002 closed
// whitelist SQL, no user input, no write path) and this module maps the rows to the response contract.
// Exposes only non-sensitive aggregate metadata: corpus name, ingest timestamp, its as-of date, row
// count — no record rows, no PII.

export const FRESHNESS_SQL =
  "SELECT corpus, as_of, ingested_at, row_count FROM corpus_meta ORDER BY corpus";

// A corpus_meta row as stored (worker/migrations/0001_corpus_store.sql). ingested_at is stamped
// `new Date().toISOString()` by the cron (corpus/ingest.ts); nullable until a corpus first ingests.
export interface FreshnessRow {
  corpus: string;
  as_of: string | null;
  ingested_at: string | null;
  row_count: number | null;
}

export interface CorpusFreshness {
  corpus: string;
  ingestedAt: string | null;
  asOf: string | null;
  rowCount: number | null;
}

export interface FreshnessPayload {
  generatedAt: string;
  corpora: CorpusFreshness[];
}

// Pure rows -> contract map. Preserves nulls (never drop a corpus — a missing ingestedAt is exactly
// what the watchdog must SEE as stale, not have hidden). Order follows the caller's rows, which the
// FRESHNESS_SQL `ORDER BY corpus` fixes (single source of ordering).
export function buildFreshnessPayload(
  rows: readonly FreshnessRow[],
  generatedAt: string
): FreshnessPayload {
  return {
    generatedAt,
    corpora: rows.map((r) => ({
      corpus: r.corpus,
      ingestedAt: r.ingested_at,
      asOf: r.as_of,
      rowCount: r.row_count,
    })),
  };
}
