import { describe, it, expect } from "vitest";
import { lookupAsOf } from "../src/sheet/freshnessLookup";

describe("lookupAsOf", () => {
  it("returns the matching corpus's asOf", () => {
    const corpora = [
      { corpus: "cqc", asOf: "2026-09-01" },
      { corpus: "fhrs", asOf: "2026-08-20" },
    ];
    expect(lookupAsOf(corpora, "fhrs")).toBe("2026-08-20");
  });

  it("returns null when no freshnessKey is given (no honest single date to show)", () => {
    expect(lookupAsOf([{ corpus: "cqc", asOf: "2026-09-01" }], undefined)).toBeNull();
  });

  it("returns null when no corpus matches, rather than guessing at any row", () => {
    expect(lookupAsOf([{ corpus: "cqc", asOf: "2026-09-01" }], "unknown-corpus")).toBeNull();
  });

  it("returns null when the matching row's asOf is itself null (registered but not yet ingested)", () => {
    expect(lookupAsOf([{ corpus: "cqc", asOf: null }], "cqc")).toBeNull();
  });

  it("returns null for an empty payload", () => {
    expect(lookupAsOf([], "cqc")).toBeNull();
  });
});
