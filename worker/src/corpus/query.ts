import { normalisePostcode } from "../../../shared/sanitize";
import { nearestN } from "../geo";
import { oldestIsoDate } from "../dates";
import type { CorpusQuery, CorpusRow } from "./contract";
import { getCorpus, type CorpusDef } from "./registry";

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Deterministic, model-free, fetch-free nearest-N over an already-resolved corpus. Pure + injectable,
// so it is driven directly in tests. Graceful, never-throwing on USER input: an invalid postcode ⇒
// { query: null, rows: [] }; a valid but unknown one ⇒ { query, rows: [] }. The row's `line` is
// pre-formatted here (query shapes data, render lays it out) so the render never sees a distance.
export function queryCorpusDef(def: CorpusDef, prompt: string, n = 3): CorpusQuery {
  const { labels } = def;
  const postcode = normalisePostcode(prompt);
  if (!postcode) return { query: null, rows: [], asOf: null, labels };
  // noUncheckedIndexedAccess: an unknown postcode is undefined at runtime, so the guard is real.
  const origin = def.postcodes[postcode];
  if (!origin) return { query: postcode, rows: [], asOf: null, labels };
  const nearest = nearestN(origin, def.records, n);
  const rows: CorpusRow[] = nearest.map((r) => ({
    id: r.id,
    title: r.name,
    line: `${r.authority} · ${String(round1(r.distanceKm))} km`,
    why: r.why,
    officialUrl: r.officialUrl,
  }));
  // Oldest lastUpdated = the conservative freshness to advertise across the shown rows. Validated ISO
  // (dates.ts) so a malformed date can never become a falsely-early "data as of" (#128).
  const asOf = oldestIsoDate(nearest.map((r) => r.lastUpdated));
  return { query: postcode, rows, asOf, labels };
}

export interface QueryCorpusInput {
  prompt: string;
  corpus?: string | undefined;
}

// The async seam the engine dispatches (workflows.ts `registry.query`). Async so a D1-backed corpus
// can slot in at W4 without changing playStage or any query-fn signature; the bundled path resolves
// instantly. An unregistered id is a PROGRAMMING error (the usecase load-guard already rejects
// authoring typos at startup), so it rejects loudly rather than rendering a silently empty batch.
export function queryCorpus(input: QueryCorpusInput, n = 3): Promise<CorpusQuery> {
  const def = input.corpus === undefined ? undefined : getCorpus(input.corpus);
  if (!def) {
    return Promise.reject(new Error(`queryCorpus: unknown corpus "${input.corpus ?? "(none)"}"`));
  }
  return Promise.resolve(queryCorpusDef(def, input.prompt, n));
}
