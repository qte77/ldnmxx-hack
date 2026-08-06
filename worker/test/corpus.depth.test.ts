import { describe, it, expect } from "vitest";
import { queryCorpus } from "../src/corpus/query";
import type { CorpusRecord } from "../src/corpus/contract";

// 022: "the depth shows" — two behaviours, both load-bearing enough to model here rather than trust to
// the call site.
//
// 1. The default answer size rose 3 -> 5. It is a DEFAULT (queryCorpus's `n`), so nothing else in the
//    engine has to know; BBOX_CAP (50) already covers it, so no extra D1 read is bought.
// 2. The summary card names the pool it ranked from, read from corpus_meta (the same row that already
//    powers /api/freshness). The read is COSMETIC — if it fails, the user must still get their results,
//    so a size failure can never take down the query or trigger the bundled fallback.

const rec = (id: string, lat: number, lng: number): CorpusRecord => ({
  id,
  name: id,
  authority: "A",
  why: "w",
  officialUrl: "https://x",
  lastUpdated: "2026-06-01",
  lat,
  lng,
});

// Ten records tightly clustered around the origin, so the first (0.5 km) box always satisfies n.
const DENSE = Array.from({ length: 10 }, (_, i) => rec(`r${String(i)}`, 51.5 + i * 0.0005, -0.1));

// A D1 stub answering the three reads by shape: gazetteer origin, corpus_meta, and the view read.
function db(opts: { meta?: unknown[]; metaThrows?: boolean; rows?: unknown[] }): D1Database {
  const prepare = (sql: string): unknown => {
    const isMeta = sql.includes("corpus_meta");
    const isView = / FROM (?!postcodes|corpus_meta)/.test(sql);
    const all = (): Promise<{ results: unknown[] }> => {
      if (isMeta) {
        if (opts.metaThrows) return Promise.reject(new Error("corpus_meta unavailable"));
        return Promise.resolve({ results: opts.meta ?? [] });
      }
      return Promise.resolve({ results: isView ? (opts.rows ?? DENSE) : [] });
    };
    return {
      bind: () => ({ first: () => Promise.resolve({ lat: 51.5, lng: -0.1 }), all }),
      first: () => Promise.resolve({ postcode: "probe" }),
      all,
    };
  };
  return { prepare } as unknown as D1Database;
}

describe("nearest-N depth (022)", () => {
  it("returns 5 results by default, not 3", async () => {
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db: db({}) });
    expect(q.rows).toHaveLength(5);
  });

  it("still honours an explicit n (the default is a default, not a hardcode)", async () => {
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db: db({}) }, 2);
    expect(q.rows).toHaveLength(2);
  });

  it("never returns more rows than the corpus holds (a sparse area shows fewer, not padding)", async () => {
    const sparse = [rec("a", 51.5, -0.1), rec("b", 51.5005, -0.1)];
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db: db({ rows: sparse }) });
    expect(q.rows).toHaveLength(2);
  });

  it("reports the corpus size from corpus_meta, summing every corpus behind the view", async () => {
    // wander_places UNIONs two ingested corpora — its pool is the SUM, never just one of them.
    const meta = [
      { corpus: "wander-greenspace", row_count: 12197 },
      { corpus: "wander-nhle", row_count: 23741 },
      { corpus: "food-hygiene", row_count: 67082 },
      { corpus: "gazetteer", row_count: 6937 },
    ];
    const wander = await queryCorpus({ prompt: "SW9 9SL", corpus: "wander" }, { db: db({ meta }) });
    expect(wander.corpusSize).toBe(35938);
    const food = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db: db({ meta }) });
    expect(food.corpusSize).toBe(67082);
  });

  it("degrades to no size claim — NOT to a broken query — when corpus_meta cannot be read", async () => {
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" }, { db: db({ metaThrows: true }) });
    expect(q.corpusSize).toBeNull(); // no claim
    expect(q.rows).toHaveLength(5); // but the answer still arrives, from D1 — not the bundled fallback
  });

  it("claims no size on the bundled path (a 12-row sample must never imply a full corpus)", async () => {
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "food-hygiene" });
    expect(q.corpusSize ?? null).toBeNull();
  });
});
