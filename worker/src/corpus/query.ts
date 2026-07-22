import { normalisePostcode } from "../../../shared/sanitize";
import { nearestN, type Coords } from "../geo";
import { oldestIsoDate } from "../dates";
import type { CorpusLabels, CorpusQuery, CorpusRecord, CorpusRow } from "./contract";
import { bundledSource, d1Source, type CorpusSource, type QueryCtx } from "./source";
import { getCorpus, type CorpusDef } from "./registry";

const round1 = (n: number): number => Math.round(n * 10) / 10;

// The pure, load-bearing core: nearest-N + the pre-formatted display line + conservative freshness.
// Model-free, IO-free — driven directly in tests. The row's `line` is formatted HERE (query shapes
// data, render lays it out) so the render never sees a distance or coords.
function corpusRows(
  origin: Coords,
  records: readonly CorpusRecord[],
  n: number
): { rows: CorpusRow[]; asOf: string | null } {
  const nearest = nearestN(origin, records, n);
  const rows: CorpusRow[] = nearest.map((r) => ({
    id: r.id,
    title: r.name,
    line: `${r.authority} · ${String(round1(r.distanceKm))} km`,
    why: r.why,
    officialUrl: r.officialUrl,
  }));
  // Oldest lastUpdated = the conservative freshness to advertise across the shown rows. Validated
  // ISO (dates.ts) so a malformed date can never become a falsely-early "data as of" (#128).
  return { rows, asOf: oldestIsoDate(nearest.map((r) => r.lastUpdated)) };
}

// Deterministic, model-free nearest-N over an in-memory corpus def. Pure + injectable, so it is
// driven directly in tests. Graceful, never-throwing on USER input: an invalid postcode ⇒
// { query: null, rows: [] }; a valid but unknown one ⇒ { query, rows: [] }.
export function queryCorpusDef(def: CorpusDef, prompt: string, n = 3): CorpusQuery {
  const { labels } = def;
  const postcode = normalisePostcode(prompt);
  if (!postcode) return { query: null, rows: [], asOf: null, labels };
  // noUncheckedIndexedAccess: an unknown postcode is undefined at runtime, so the guard is real.
  const origin = def.postcodes[postcode];
  if (!origin) return { query: postcode, rows: [], asOf: null, labels };
  return { query: postcode, ...corpusRows(origin, def.records, n), labels };
}

// One source-driven query: resolve the origin, then rank. Shared by the bundled + D1 paths. A
// gazetteer MISS is a real "unknown postcode" answer, not a failure — it does not trigger fallback.
async function querySource(
  source: CorpusSource,
  labels: CorpusLabels,
  postcode: string,
  n: number
): Promise<CorpusQuery> {
  const origin = await source.origin(postcode);
  if (!origin) return { query: postcode, rows: [], asOf: null, labels };
  return { query: postcode, ...corpusRows(origin, await source.records(), n), labels };
}

export interface QueryCorpusInput {
  prompt: string;
  corpus?: string | undefined;
}

// The async seam the engine dispatches (workflows.ts `registry.query`). Source selection (W6, ADR
// 0002): a corpus flagged with a `d1View` AND a bound `ctx.db` reads the D1 store; anything else —
// and any D1 FAILURE — uses the bundled sample, so tests need no database and a D1 outage degrades
// to the committed sample instead of a broken stream. An unregistered id is a PROGRAMMING error
// (the usecase load-guard already rejects authoring typos at startup), so it rejects loudly.
export async function queryCorpus(
  input: QueryCorpusInput,
  ctx?: QueryCtx,
  n = 3
): Promise<CorpusQuery> {
  const def = input.corpus === undefined ? undefined : getCorpus(input.corpus);
  if (!def) throw new Error(`queryCorpus: unknown corpus "${input.corpus ?? "(none)"}"`);
  const postcode = normalisePostcode(input.prompt);
  if (!postcode) return { query: null, rows: [], asOf: null, labels: def.labels };
  if (def.d1View !== undefined && ctx?.db !== undefined) {
    try {
      return await querySource(d1Source(ctx.db, def.d1View), def.labels, postcode, n);
    } catch (err) {
      console.warn(`corpus "${String(input.corpus)}": D1 source failed, using bundled:`, err);
    }
  }
  return querySource(bundledSource(def), def.labels, postcode, n);
}
