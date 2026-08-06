// The GENERIC deterministic-corpus contract. One shape serves every corpus workflow (Care now;
// Wander/Scam next), so adding one is register + a JSON with no bespoke Worker TS.
//
// Frozen deliberately: W4/W5 ingest real data against exactly this record shape (and a D1 view per
// corpus projects onto it), so changing it is a breaking change for the ingest pipeline.
import type { Coords } from "../geo";
import type { DateLabelMode } from "../dates";

// One row of a bundled corpus: the public display fields plus lat/lng for the proximity sort.
// Coords + any extra source columns are INTERNAL — they never reach the render (see CorpusRow).
export interface CorpusRecord extends Coords {
  id: string;
  name: string;
  authority: string;
  why: string;
  officialUrl: string;
  lastUpdated: string;
}

// Per-corpus presentation strings. The officialLink is CURATED + verified and lives here in reviewed
// TS — never in casually-authored usecase JSON — which is what keeps "signpost, not adjudicator" honest.
export interface CorpusLabels {
  noun: string; // singular, e.g. "service" | "place" — the render pluralises
  summaryLine: string; // e.g. "Nearest public-service signposts" | "Matching published warnings"
  officialLink: { text: string; url: string };
  emptyInvalidHint: string; // shown when the input was not a valid postcode
  emptyUnknownHint: string; // shown when the postcode is valid but the corpus has nothing for it
  // P1 (#182): the corpus's licence-obligation strings (data/sources.json redistribute_note),
  // rendered as caption lines on the disclaimer card. Reviewed TS like every label — never
  // data-supplied. Empty for a bundled-sample corpus; the ingest cron REFUSES to swap real data
  // into a corpus whose attribution is empty (obligation as a hard gate, not convention).
  attribution: string[];
  // P3 (#225): how this corpus's `asOf` (oldest lastUpdated) is worded — honest to what the date
  // ACTUALLY means for THIS source (freshness vs a record's own listing/inspection age). Required, so
  // every corpus present and future declares its date semantics consciously instead of inheriting a
  // wrong default. See dates.ts `formatDateLabel`.
  dateLabel: DateLabelMode;
  // P5 (018): a small per-corpus mark shown ONCE on the summary card title — cheap visual variety
  // across workflows without touching every row. Required (like dateLabel), so every corpus declares it
  // consciously; decorative reviewed-TS, never inferred from data.
  glyph: string;
}

// A row handed to the render. `line` is the retrieval-specific secondary line, PRE-FORMATTED by the
// query (e.g. "NHS A · 0.4 km" for a nearest query, a match token for a lookup one) so the render
// stays shape-agnostic and a match-shaped workflow reuses it verbatim.
export interface CorpusRow {
  id: string;
  title: string;
  line: string;
  why: string;
  officialUrl: string;
}

// The result threaded from the query stage to the render. `query` is the normalised postcode (or null
// when the input was not valid); `asOf` is the conservative (oldest) freshness across the shown rows.
export interface CorpusQuery {
  query: string | null;
  rows: CorpusRow[];
  asOf: string | null;
  labels: CorpusLabels;
  // P5 (018): the authority EVERY shown row shares, or null when the corpus is multi-source for this
  // query — render.ts tags the summary card with it only when non-null (never a false single claim).
  // Optional + derived by query.ts, so existing CorpusQuery fixtures need no edit (undefined ⇒ the
  // per-row `authority · distance` line, today's honest behaviour).
  sharedAuthority?: string | null;
  // 022: how many records the shown rows were ranked FROM — the depth behind the answer, which was
  // otherwise invisible (5 rows off 67k official records looked like 5 rows off a 12-row sample).
  // Read from corpus_meta (the row already behind /api/freshness), so it is a real ingested count and
  // never a guess. null/undefined ⇒ unknown (the bundled sample) ⇒ render makes NO claim.
  corpusSize?: number | null | undefined;
}
