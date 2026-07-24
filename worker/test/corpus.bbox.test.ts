import { describe, it, expect } from "vitest";
import { queryCorpus } from "../src/corpus/query";
import type { CorpusRecord } from "../src/corpus/contract";

// P2b (017): the bbox prefilter must issue a BOUNDED, index-seekable statement for the D1 read — not
// the whole-view scan. A mocked D1 cannot model rows-SCANNED (that is the live meta.rows_read proof,
// owed on the credential — see #206), so here we prove the code PATH: the statement carries the bbox
// WHERE + a LIMIT and is BOUND with the box parameters, and the widen-radius retry never silently
// shrinks results. The static-SQL whitelist (ADR 0002) is preserved — bind params, no string-building.

// A recording D1 stub: captures every prepared SQL string and the bound params, and answers the
// gazetteer/probe/view reads by method shape (mirrors corpus.test.ts's stub, plus .bind().all()).
interface Recorded {
  sqls: string[];
  binds: unknown[][];
}
function recordingDb(opts: {
  origin: { lat: number; lng: number };
  rowsByCall: unknown[][]; // successive view-read results (one per bounded/unbounded read)
  rec: Recorded;
}): D1Database {
  let viewRead = 0;
  const prepare = (sql: string): unknown => {
    opts.rec.sqls.push(sql);
    const isView = / FROM (?!postcodes)/.test(sql); // the corpus view read, not the postcodes gazetteer
    const allResult = (): Promise<{ results: unknown[] }> => {
      const rows = isView ? (opts.rowsByCall[viewRead++] ?? []) : [];
      return Promise.resolve({ results: rows });
    };
    return {
      bind: (...args: unknown[]) => {
        opts.rec.binds.push(args);
        return {
          first: () => Promise.resolve(opts.origin), // origin lookup (bound)
          all: allResult, // bounded view read (bbox)
        };
      },
      first: () => Promise.resolve({ postcode: "probe" }), // gazetteer seeded-probe (unbound)
      all: allResult, // unbounded view read
    };
  };
  return { prepare } as unknown as D1Database;
}

const near = (id: string, lat: number, lng: number): CorpusRecord => ({
  id,
  name: id,
  authority: "A",
  why: "w",
  officialUrl: "https://x",
  lastUpdated: "2026-06-01",
  lat,
  lng,
});

describe("queryCorpus D1 read — bbox prefilter (P2b)", () => {
  it("issues a BOUNDED view read (bbox WHERE + LIMIT), bound with the box params — not a full scan", async () => {
    const rec: Recorded = { sqls: [], binds: [] };
    const db = recordingDb({
      origin: { lat: 51.5, lng: -0.1 },
      rowsByCall: [[near("a", 51.5, -0.1), near("b", 51.51, -0.1), near("c", 51.49, -0.1)]],
      rec,
    });
    await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db });
    const viewSql = rec.sqls.find((s) => s.includes("FROM food_hygiene"));
    expect(viewSql).toBeTruthy();
    expect(viewSql).toMatch(/where\s+lat\s+between/i); // bounded, index-seekable
    expect(viewSql).toMatch(/limit/i); // capped result
    // the bounded read was BOUND with numeric box params (min/max lat/lng, origin, weight, cap)
    const boxBind = rec.binds.find((b) => b.length >= 5 && b.every((v) => typeof v === "number"));
    expect(boxBind).toBeTruthy();
  });

  it("widens the radius when the tight box returns too few rows (results never silently shrink)", async () => {
    const rec: Recorded = { sqls: [], binds: [] };
    // 5 km box: 1 row (too few for n=3) → widen to 15 km: 3 rows → used.
    const db = recordingDb({
      origin: { lat: 51.5, lng: -0.1 },
      rowsByCall: [
        [near("only", 51.5, -0.1)],
        [near("only", 51.5, -0.1), near("b", 51.55, -0.1), near("c", 51.45, -0.1)],
      ],
      rec,
    });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db, }, 3);
    expect(q.rows.length).toBe(3); // widened box supplied enough — did not shrink to 1
    const boundedReads = rec.binds.filter((b) => b.length >= 5 && b.every((v) => typeof v === "number"));
    expect(boundedReads.length).toBeGreaterThanOrEqual(2); // tried at least two radii
  });

  it("ranks the bounded rows by true distance (nearest-first), identical to an unbounded ranking", async () => {
    const rec: Recorded = { sqls: [], binds: [] };
    const rows = [near("mid", 51.53, -0.1), near("near", 51.501, -0.1), near("far", 51.6, -0.1)];
    const db = recordingDb({ origin: { lat: 51.5, lng: -0.1 }, rowsByCall: [rows], rec });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db }, 3);
    expect(q.rows.map((r) => r.id)).toEqual(["near", "mid", "far"]);
  });
});
