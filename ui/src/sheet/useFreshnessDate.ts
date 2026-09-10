import { useEffect, useState } from "react";
import { WORKER_BASE } from "../config";
import { lookupAsOf, type FreshnessRow } from "./freshnessLookup";

// 024 P6 (design-match): the ResultSheet's "Updated Y" meta line. Same GET /api/freshness endpoint
// useCoverage.ts already reads (same-origin, ADR-0002-exempt — see its header comment) but a separate
// small fetch rather than shared state: the two callers want different shapes (a totals count vs. one
// corpus's asOf) and mount/unmount independently (Home vs. the sheet), so sharing would cost more
// coupling than the duplicated ~15 lines are worth (AHA).
//
// Fails silent by design, same as useCoverage: offline, blocked, non-200, malformed body, or no
// matching corpus all leave asOf null and the meta row simply omits "Updated" rather than showing a
// wrong or stale date. `result.key` guards a second, subtler case useCoverage never has to: freshnessKey
// can CHANGE while this hook stays mounted (a "Try another:" pivot swaps the active usecase without
// remounting the sheet) — if an in-flight fetch for the OLD key resolves after the key has already
// moved on, `result?.key === freshnessKey` below discards it rather than briefly showing the wrong
// corpus's date under the new title.
export function useFreshnessDate(freshnessKey: string | undefined): string | null {
  const [result, setResult] = useState<{ key: string | undefined; asOf: string | null } | null>(null);

  useEffect(() => {
    if (!freshnessKey) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${WORKER_BASE}/api/freshness`, { signal: ac.signal });
        if (!res.ok) return;
        const body: unknown = await res.json();
        const corpora = (body as { corpora?: unknown }).corpora;
        if (!Array.isArray(corpora)) return;
        const rows: FreshnessRow[] = corpora.map((c) => {
          const row = c as { corpus?: unknown; asOf?: unknown };
          return {
            corpus: typeof row.corpus === "string" ? row.corpus : "",
            asOf: typeof row.asOf === "string" ? row.asOf : null,
          };
        });
        setResult({ key: freshnessKey, asOf: lookupAsOf(rows, freshnessKey) });
      } catch {
        // Offline, aborted on unmount, or bad JSON — no update; the stale-key guard below still
        // applies to whatever `result` already held.
      }
    })();
    return () => ac.abort();
  }, [freshnessKey]);

  return result !== null && result.key === freshnessKey ? result.asOf : null;
}
