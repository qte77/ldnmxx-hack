// The GENERIC deterministic-corpus contract. One shape serves every corpus workflow (Care now;
// Wander/Scam next), so adding one is register + a JSON with no bespoke Worker TS.
//
// Frozen deliberately: W4/W5 ingest real data against exactly this record shape (and a D1 view per
// corpus projects onto it), so changing it is a breaking change for the ingest pipeline.
import type { Coords } from "../geo";

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
}
