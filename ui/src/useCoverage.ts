import { useEffect, useState } from "react";
import { WORKER_BASE } from "./config";
import { coverageCount, findableRecords, type CorpusCount } from "./coverage";

// 021 P2: read the live record count off our own GET /api/freshness so the hero can state what the app
// actually knows. Not an ADR-0002 concern — that rule bans live EXTERNAL fetches on the answer path;
// this is a same-origin read of an endpoint the Worker already serves (arc 019) and it touches no
// query path.
//
// Fails silent by design: offline, blocked, non-200 or a malformed body all leave the count null and the
// fold renders its category list with no number. A wrong or stale figure would cost more trust than the
// missing one it replaces.
export function useCoverage(): string | null {
  const [count, setCount] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${WORKER_BASE}/api/freshness`, { signal: ac.signal });
        if (!res.ok) return;
        const body: unknown = await res.json();
        const corpora = (body as { corpora?: unknown }).corpora;
        if (!Array.isArray(corpora)) return;
        // Narrow defensively rather than casting: a malformed rowCount must become null (uncounted),
        // never string-concatenate into a nonsense total.
        const rows: CorpusCount[] = corpora.map((c) => {
          const row = c as { corpus?: unknown; rowCount?: unknown };
          return {
            corpus: typeof row.corpus === "string" ? row.corpus : "",
            rowCount: typeof row.rowCount === "number" ? row.rowCount : null,
          };
        });
        setCount(coverageCount(findableRecords(rows)));
      } catch {
        // Offline, aborted on unmount, or bad JSON — the fold shows categories only.
      }
    })();
    return () => ac.abort();
  }, []);

  return count;
}
