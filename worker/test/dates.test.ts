import { describe, it, expect } from "vitest";
import { isIsoDate, oldestIsoDate } from "../src/dates";

describe("isIsoDate", () => {
  it("accepts a real ISO calendar date", () => {
    expect(isIsoDate("2026-06-01")).toBe(true);
  });
  it("rejects non-ISO shapes and impossible calendar dates", () => {
    for (const s of ["01/06/2026", "2026-6-1", "2026/06/01", "June 2026", "", "2026-13-01", "2026-02-30"]) {
      expect(isIsoDate(s)).toBe(false);
    }
  });
});

describe("oldestIsoDate", () => {
  it("returns the chronologically oldest valid ISO date (the conservative freshness)", () => {
    expect(oldestIsoDate(["2026-06-01", "2026-05-15", "2026-06-10"])).toBe("2026-05-15");
  });
  it("EXCLUDES non-ISO values so a malformed date can't skew the 'data as of' claim", () => {
    // "01/06/2026" sorts BEFORE any "2026-…" as a raw string — the old sort()[0] would have picked it
    // and advertised a wrong freshness. Excluding it keeps the claim honest.
    expect(oldestIsoDate(["2026-06-01", "01/06/2026", "2026-05-20"])).toBe("2026-05-20");
  });
  it("returns null when nothing is a valid ISO date (no false freshness claim)", () => {
    expect(oldestIsoDate(["soon", "01/06/2026"])).toBeNull();
    expect(oldestIsoDate([])).toBeNull();
  });
});
