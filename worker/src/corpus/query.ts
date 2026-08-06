import { normalisePostcode } from "../../../shared/sanitize";
import { resolvePlace } from "../../../shared/places";
import { bboxAround, humanDistance, nearestN, type Coords } from "../geo";
import { oldestIsoDate } from "../dates";
import type { CorpusLabels, CorpusQuery, CorpusRecord, CorpusRow } from "./contract";
import { bundledSource, d1Source, type CorpusSource, type QueryCtx } from "./source";
import { getCorpus, type CorpusDef } from "./registry";

// Pure: the authority EVERY shown row shares, or null when the corpus is genuinely multi-source for
// this query (wander UNIONs NHLE + Greenspace; care's bundled sample mixes ICBs). Never a false
// single-source claim — render.ts only tags the summary with it when it is non-null.
function sharedAuthorityOf(records: readonly { authority: string }[]): string | null {
  const first = records[0]?.authority;
  if (first === undefined) return null;
  return records.every((r) => r.authority === first) ? first : null;
}

// The pure, load-bearing core: nearest-N + the pre-formatted display line + conservative freshness.
// Model-free, IO-free — driven directly in tests. The row's `line` is formatted HERE (query shapes
// data, render lays it out) so the render never sees a distance or coords. 018 P5: humanised distance
// (never a bare "0 km") + a walk estimate; the shared authority is lifted to the summary card, de-duped
// off every row (fallback: keep it per-row when the corpus is multi-source, so no false single claim).
function corpusRows(
  origin: Coords,
  records: readonly CorpusRecord[],
  n: number
): { rows: CorpusRow[]; asOf: string | null; sharedAuthority: string | null } {
  const nearest = nearestN(origin, records, n);
  const shared = sharedAuthorityOf(nearest);
  const rows: CorpusRow[] = nearest.map((r) => ({
    id: r.id,
    title: r.name,
    line: shared ? humanDistance(r.distanceKm) : `${r.authority} · ${humanDistance(r.distanceKm)}`,
    why: r.why,
    officialUrl: r.officialUrl,
  }));
  // Oldest lastUpdated = the conservative freshness to advertise across the shown rows. Validated
  // ISO (dates.ts) so a malformed date can never become a falsely-early "data as of" (#128).
  return { rows, asOf: oldestIsoDate(nearest.map((r) => r.lastUpdated)), sharedAuthority: shared };
}

// A user's ask resolves to EITHER a postcode string (looked up in the gazetteer) OR a named London
// place with fixed anchor coords (committed data/places.json, 020 P2/#1). null when the ask names
// neither — a genuinely unparseable location. Fetch-free: both paths are static in-memory lookups.
type Located = { label: string; postcode: string } | { label: string; coords: Coords };

function resolveLocation(prompt: string): Located | null {
  const postcode = normalisePostcode(prompt);
  if (postcode) return { label: postcode, postcode };
  const place = resolvePlace(prompt);
  if (place) return { label: place.label, coords: { lat: place.lat, lng: place.lng } };
  return null;
}

// Deterministic, model-free nearest-N over an in-memory corpus def. Pure + injectable, so it is
// driven directly in tests. Graceful, never-throwing on USER input: an unresolvable location ⇒
// { query: null, rows: [] }; a place/valid postcode with nothing nearby ⇒ { query, rows: [] }.
// 022: n defaults to 5 (was 3) — see queryCorpus. The bundled def carries no pool count, so no claim.
export function queryCorpusDef(def: CorpusDef, prompt: string, n = DEFAULT_N): CorpusQuery {
  const { labels } = def;
  const loc = resolveLocation(prompt);
  if (!loc) return { query: null, rows: [], asOf: null, labels };
  if ("coords" in loc) return { query: loc.label, ...corpusRows(loc.coords, def.records, n), labels };
  // noUncheckedIndexedAccess: an unknown postcode is undefined at runtime, so the guard is real.
  const origin = def.postcodes[loc.postcode];
  if (!origin) return { query: loc.postcode, rows: [], asOf: null, labels };
  return { query: loc.postcode, ...corpusRows(origin, def.records, n), labels };
}

// P2b (017): read the corpus bounded to a bbox around the origin, WIDENING the radius until at least
// `n` rows are in view, then falling back to the full unbounded read. The widen guarantees results
// never silently shrink (a sparse corpus far from the origin still answers), and the unbounded final
// read is where source.ts's not-yet-swapped empty-view guard fires. The bundled source ignores the
// bbox (in-memory) so its first bounded call returns everything — no behaviour change off D1.
// Start SMALL: D1 bills rows SCANNED and the geo index can only range its LEADING column, so the
// row-read win depends on a tight first box (LIVE food-hygiene: 5 km read 55,201 rows = 1.2×; 0.5 km
// reads 3,810 = 17.5×, clearing ADR 0002's ≥10× target). Widen only when a sparse corpus needs it.
const WIDEN_KM = [0.5, 2, 8];

// 022: how many results an answer shows by default. Raised 3 → 5 so the depth behind the corpus is
// visible in the answer itself; still far below source.ts's BBOX_CAP (50), so it buys no extra D1 read,
// and the widen-retry above keeps a sparse area answering rather than shrinking.
const DEFAULT_N = 5;
async function readWithinWidening(
  source: CorpusSource,
  origin: Coords,
  n: number
): Promise<CorpusRecord[]> {
  for (const km of WIDEN_KM) {
    const recs = await source.records(bboxAround(origin, km), origin);
    if (recs.length >= n) return recs;
  }
  return source.records(); // unbounded — never fewer results than today; also the empty-view guard point
}

// Rank a corpus around an ALREADY-resolved origin (a postcode's coords or a place anchor). Shared by
// the postcode + place paths and by the bundled + D1 sources.
// 022: the pool count is COSMETIC — it must never cost a user their answer. Any failure (or a source
// that cannot count) degrades to null, i.e. no claim on the card, while the records read proceeds
// untouched. Deliberately NOT inside queryCorpus's D1 try/catch: a corpus_meta hiccup must not demote a
// working D1 answer to the bundled sample.
async function poolSize(source: CorpusSource): Promise<number | null> {
  if (source.size === undefined) return null;
  try {
    return await source.size();
  } catch (err) {
    console.warn("corpus size unavailable — rendering without a pool claim:", err);
    return null;
  }
}

async function rankFrom(
  source: CorpusSource,
  labels: CorpusLabels,
  queryLabel: string,
  origin: Coords,
  n: number
): Promise<CorpusQuery> {
  // Concurrent: the pool count never adds latency to the read that actually answers the question.
  const [records, corpusSize] = await Promise.all([readWithinWidening(source, origin, n), poolSize(source)]);
  return { query: queryLabel, ...corpusRows(origin, records, n), labels, corpusSize };
}

// One postcode-driven query: resolve the origin from the gazetteer, then rank. A gazetteer MISS is a
// real "unknown postcode" answer, not a failure — it does not trigger fallback.
async function querySource(
  source: CorpusSource,
  labels: CorpusLabels,
  postcode: string,
  n: number
): Promise<CorpusQuery> {
  const origin = await source.origin(postcode);
  if (!origin) return { query: postcode, rows: [], asOf: null, labels };
  return rankFrom(source, labels, postcode, origin, n);
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
  n = DEFAULT_N
): Promise<CorpusQuery> {
  const def = input.corpus === undefined ? undefined : getCorpus(input.corpus);
  if (!def) throw new Error(`queryCorpus: unknown corpus "${input.corpus ?? "(none)"}"`);
  const loc = resolveLocation(input.prompt);
  if (!loc) return { query: null, rows: [], asOf: null, labels: def.labels };
  // One closure over BOTH location kinds (postcode lookup vs place anchor) so the D1→bundled fallback
  // below is written once, not per kind.
  const runOn = (source: CorpusSource): Promise<CorpusQuery> =>
    "coords" in loc
      ? rankFrom(source, def.labels, loc.label, loc.coords, n)
      : querySource(source, def.labels, loc.postcode, n);
  if (def.d1View !== undefined && ctx?.db !== undefined) {
    try {
      return await runOn(d1Source(ctx.db, def.d1View));
    } catch (err) {
      console.warn(`corpus "${String(input.corpus)}": D1 source failed, using bundled:`, err);
    }
  }
  return runOn(bundledSource(def));
}
