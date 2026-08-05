// 021 P1: the ONE honest number the hero claims. The live deploy holds ~112k official records across
// four registers, and the fold used to claim none of them — a visitor could not tell what the app knew
// without first typing a successful query.
//
// Deliberately declares its own narrow view of the GET /api/freshness payload instead of importing
// worker/src/freshness.ts: the SPA must never pull in worker modules (same one-way rule that keeps
// shared/usecaseCatalog.ts dependency-free). Only the two fields the claim needs are modelled.

export interface CorpusCount {
  corpus: string;
  rowCount: number | null;
}

// Corpora that are NOT user-findable records. `gazetteer` is postcode centroids — the anchor that turns
// a typed place into a lat/lng for nearest-N, never itself a result. Counting it would overstate the
// claim by ~7k. Keep this list as the single place that decides what "a record" means to a visitor.
const INFRASTRUCTURE_CORPORA = new Set(["gazetteer"]);

// Sum the rows a user can actually be shown. A null rowCount (a corpus registered but not yet ingested)
// counts as zero rather than throwing — the watchdog's job is to notice that, not the hero's.
export function findableRecords(corpora: readonly CorpusCount[]): number {
  return corpora
    .filter((c) => !INFRASTRUCTURE_CORPORA.has(c.corpus))
    .reduce((sum, c) => sum + (c.rowCount ?? 0), 0);
}

// Render the count as a claim, or null when there is nothing honest to say. Rounds DOWN to the nearest
// thousand so the stated figure is always one the data covers; under a thousand there is no "N,000+" to
// state and the fold falls back to the category list alone. null in (a failed fetch) → null out.
export function coverageCount(total: number | null): string | null {
  if (total === null || total < 1000) return null;
  const thousands = Math.floor(total / 1000);
  return `${thousands.toLocaleString("en-GB")},000+`;
}
