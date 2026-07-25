import { describe, it, expect } from "vitest";
import { buildFreshnessPayload, type FreshnessRow } from "../src/freshness";

// The pure contract of the public GET /api/freshness surface: D1 corpus_meta rows -> the JSON the
// credential-free watchdog parses (.corpora[].ingestedAt). A silent rename here breaks the monitor,
// so the field mapping + null-honesty + empty-store shape are the load-bearing behaviours to pin.
describe("buildFreshnessPayload", () => {
  const now = "2026-07-25T12:00:00.000Z";

  it("maps corpus_meta rows to the public camelCase contract, echoing generatedAt", () => {
    const rows: FreshnessRow[] = [
      { corpus: "postcodes", as_of: "2026-05-01", ingested_at: "2026-07-25T04:47:00.000Z", row_count: 6656 },
      { corpus: "fhrs", as_of: "2026-07-01", ingested_at: "2026-07-25T04:48:00.000Z", row_count: 66871 },
    ];
    expect(buildFreshnessPayload(rows, now)).toEqual({
      generatedAt: now,
      corpora: [
        { corpus: "postcodes", ingestedAt: "2026-07-25T04:47:00.000Z", asOf: "2026-05-01", rowCount: 6656 },
        { corpus: "fhrs", ingestedAt: "2026-07-25T04:48:00.000Z", asOf: "2026-07-01", rowCount: 66871 },
      ],
    });
  });

  it("preserves a null ingested_at rather than dropping the corpus (freshness honesty)", () => {
    const rows: FreshnessRow[] = [{ corpus: "cqc", as_of: null, ingested_at: null, row_count: null }];
    expect(buildFreshnessPayload(rows, now).corpora).toEqual([
      { corpus: "cqc", ingestedAt: null, asOf: null, rowCount: null },
    ]);
  });

  it("returns an empty corpora list (not an error) when the store has no rows", () => {
    expect(buildFreshnessPayload([], now)).toEqual({ generatedAt: now, corpora: [] });
  });
});
