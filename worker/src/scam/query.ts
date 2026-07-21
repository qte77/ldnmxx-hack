import type { CorpusLabels, CorpusRow } from "../corpus/contract";
import type { ScamRecord } from "./registry";
import { scamFirms, scamLabels } from "./registry";

// The scam-check query result threaded from the query stage to the render. Mirrors CorpusQuery (reused
// verbatim for query/rows/asOf/labels) plus one match-shape extra: `cloneCaution`, a neutral note when
// the SHOWN results include an authorised firm and a not-on-register look-alike. `query` is the
// normalised firm search (or null when the input was too short to search).
export interface ScamQuery {
  query: string | null;
  rows: CorpusRow[];
  asOf: string | null;
  labels: CorpusLabels;
  cloneCaution: string | null;
}

// Trim + collapse whitespace + cap length. This is a LOCAL match key (no external fetch, no model),
// so it is input hygiene, not a security boundary.
export function normaliseFirmQuery(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 100);
}

// Case-insensitive substring on the name, OR an exact FRN / Companies House number. Pure + injectable,
// mirroring geo.ts `nearestN` for the corpus shape. Deterministic — a plain lookup, NOT a similarity
// guess (the catalog warns "fuzzy name-match can miss a close mimic").
export function matchFirms(query: string, records: readonly ScamRecord[], n: number): ScamRecord[] {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (q.length === 0 || n <= 0) return [];
  const matched = records.filter(
    (r) => r.name.toLowerCase().includes(q) || r.frn === raw || r.chNumber === raw
  );
  return matched.slice(0, n);
}

// The register fact shown on a row (never a verdict): what the FCA register says about the firm.
function statusLabel(status: string): string {
  if (status === "authorised") return "on the FCA register (authorised)";
  if (status === "no-longer-authorised") return "no longer authorised on the FCA register";
  return "not found on the FCA register"; // not-on-register (+ any unknown, conservatively)
}

// The honest "why verify" line for each status — a signpost, never "safe"/"legitimate"/a green check.
function statusWhy(status: string): string {
  if (status === "authorised") {
    return "A clone can copy an authorised firm's name and FRN — confirm you're dealing with the real firm.";
  }
  if (status === "no-longer-authorised") {
    return "This firm is not currently authorised — check the FCA register before you act.";
  }
  return "Not found on the FCA register. That doesn't mean it's a scam, but verify before you act.";
}

// Strip common legal suffixes/noise so "Thames Capital Partners LLP" and "…Ltd" share a stem.
function nameStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|llc|plc|lp|group|holdings|uk|inc|co)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// DETERMINISTIC clone flag: only annotates look-alikes AMONG the firms this search already returned —
// an authorised firm and a not-on-register firm sharing a name stem. Never scans the dataset to guess
// clones; names the unregistered look-alike; never asserts a verdict.
function cloneCaution(matched: readonly ScamRecord[]): string | null {
  const authorised = matched.filter((r) => r.fcaStatus === "authorised");
  const unregistered = matched.filter((r) => r.fcaStatus === "not-on-register");
  for (const a of authorised) {
    const stem = nameStem(a.name);
    if (stem.length === 0) continue;
    const twin = unregistered.find((u) => nameStem(u.name) === stem);
    if (twin) {
      return `Similar name in sample: '${twin.name}' — not on the register. Names alone don't confirm identity — verify on the FCA register.`;
    }
  }
  return null;
}

// Pure, model-free, fetch-free lookup over an already-resolved firm list. Graceful on USER input: a
// too-short query ⇒ { query: null, rows: [] } (empty-invalid); a valid query with no match ⇒
// { query, rows: [] } (empty-unknown). Each row's `line`/`why`/`officialUrl` is derived here from the
// facts (honest copy in reviewed code, never authored data), so the render stays presentation-only.
export function queryScamDef(
  records: readonly ScamRecord[],
  labels: CorpusLabels,
  prompt: string,
  n = 5
): ScamQuery {
  const query = normaliseFirmQuery(prompt);
  if (query.length < 2) return { query: null, rows: [], asOf: null, labels, cloneCaution: null };
  const matched = matchFirms(query, records, n);
  const rows: CorpusRow[] = matched.map((r) => {
    const idPart = r.frn ? `FRN ${r.frn} · CH ${r.chNumber}` : `CH ${r.chNumber}`;
    return {
      id: r.id,
      title: r.name,
      line: `${idPart} · ${statusLabel(r.fcaStatus)}`,
      why: statusWhy(r.fcaStatus),
      // Every row routes to the authoritative FCA register — the mandatory "verify" signpost.
      officialUrl: labels.officialLink.url,
    };
  });
  const asOf = matched.map((r) => r.lastUpdated).sort()[0] ?? null;
  return { query, rows, asOf, labels, cloneCaution: cloneCaution(matched) };
}

// The async seam the engine dispatches (workflows.ts `registry.query`). Async to match the QueryFn
// contract (a D1-backed source can slot in at W4); the bundled path resolves instantly. `corpus` is
// unused — there is a single scam dataset, hard-coded (no id to validate, so no load-guard needed).
export function queryScam(input: { prompt: string; corpus?: string | undefined }): Promise<ScamQuery> {
  return Promise.resolve(queryScamDef(scamFirms, scamLabels, input.prompt));
}
