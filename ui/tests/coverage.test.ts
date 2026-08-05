import { describe, it, expect } from "vitest";
import { findableRecords, coverageCount, type CorpusCount } from "../src/coverage";

// 021 P1: the landing page never told a visitor what the app actually knows — the live deploy holds
// ~112k official records and the fold claimed none of them. This module turns the /api/freshness
// payload into ONE honest number for the hero. Honesty is the whole product promise, so the rules are
// tested here rather than trusted to the call site: infrastructure corpora never count as findable
// records, the number only ever rounds DOWN, and an absent/failed payload yields no number at all
// (the fold then renders the categories alone — never a fabricated or stale figure).
//
// Pure + node-only, mirroring suggestions.ts; the fetch wiring + rendering are glue for the e2e sweep.

// The live shape as of 2026-08-05 (GET /api/freshness) — the four findable corpora plus the
// `gazetteer` infrastructure corpus that must be excluded from any user-facing claim.
const LIVE: CorpusCount[] = [
  { corpus: "care", rowCount: 9360 },
  { corpus: "food-hygiene", rowCount: 67082 },
  { corpus: "gazetteer", rowCount: 6937 },
  { corpus: "wander-greenspace", rowCount: 12197 },
  { corpus: "wander-nhle", rowCount: 23741 },
];

describe("findableRecords", () => {
  it("sums only the corpora a user can actually find results in", () => {
    // 9360 + 67082 + 12197 + 23741 — the gazetteer is postcode centroids, an anchor for nearest-N,
    // never a result. Counting it would overstate the claim by ~7k records.
    expect(findableRecords(LIVE)).toBe(112380);
  });

  it("excludes the gazetteer even when it is the only corpus present", () => {
    expect(findableRecords([{ corpus: "gazetteer", rowCount: 6937 }])).toBe(0);
  });

  it("treats a null rowCount as zero rather than throwing (a corpus can exist pre-ingest)", () => {
    expect(findableRecords([{ corpus: "care", rowCount: null }])).toBe(0);
    expect(findableRecords([{ corpus: "care", rowCount: null }, { corpus: "wander-nhle", rowCount: 10 }])).toBe(10);
  });

  it("is zero for an empty payload", () => {
    expect(findableRecords([])).toBe(0);
  });
});

describe("coverageCount", () => {
  it("rounds DOWN to the nearest thousand so the claim is never overstated", () => {
    expect(coverageCount(112380)).toBe("112,000+");
    expect(coverageCount(112999)).toBe("112,000+");
    expect(coverageCount(9999)).toBe("9,000+");
  });

  it("gives no number when there is nothing honest to claim", () => {
    // Below a thousand there is no "N,000+" to state, so the fold shows categories only.
    expect(coverageCount(0)).toBeNull();
    expect(coverageCount(999)).toBeNull();
  });

  it("gives no number for a failed or absent fetch", () => {
    expect(coverageCount(null)).toBeNull();
  });
});
