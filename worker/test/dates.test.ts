import { describe, it, expect } from "vitest";
import { formatDateLabel, isIsoDate, oldestIsoDate } from "../src/dates";

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

describe("formatDateLabel", () => {
  it("asOf mode states a genuine freshness claim", () => {
    expect(formatDateLabel("asOf", "2026-05-01")).toBe("data as of 2026-05-01");
  });
  it("listedYear mode reduces a record's own date to its YEAR — never framed as freshness", () => {
    expect(formatDateLabel("listedYear", "1949-03-14")).toBe("listed 1949");
  });
  it("inspected mode states a per-record inspection date, not our data freshness", () => {
    expect(formatDateLabel("inspected", "2025-11-03")).toBe("inspected 2025-11-03");
  });
  it("omit mode makes NO date claim, even when a date is available", () => {
    expect(formatDateLabel("omit", "2026-05-01")).toBe("");
  });
  it("makes no claim when there is no valid asOf date, regardless of mode", () => {
    for (const mode of ["asOf", "listedYear", "inspected"] as const) {
      expect(formatDateLabel(mode, null)).toBe("");
    }
  });
});

// 023: defence in depth. The ingest guard that should have dropped FHRS placeholder dates matched ONE
// magic value (1900-01-01) and missed the 1901-01-01 the FSA also uses, so 6,361 live rows rendered
// "inspected 1901-01-01" to Londoners. Fixing the parser stops NEW rows; this stops any placeholder that
// is already stored — or that a future source invents — from ever becoming a claim on a card.
//
// Mode-aware by necessity: `listedYear` dates are LEGITIMATELY old (NHLE listings from 1949), so the
// floor applies only to `inspected`, where a pre-2000 date cannot be a real inspection (FHRS began 2010).
describe("formatDateLabel — implausible 'inspected' dates make no claim", () => {
  it("refuses to claim a pre-2000 inspection date", () => {
    for (const placeholder of ["1901-01-01", "1900-01-01", "1970-01-01", "1999-12-31"]) {
      expect(formatDateLabel("inspected", placeholder)).toBe("");
    }
  });

  it("still reports real inspection dates", () => {
    expect(formatDateLabel("inspected", "2024-07-09")).toBe("inspected 2024-07-09");
    expect(formatDateLabel("inspected", "2010-01-01")).toBe("inspected 2010-01-01");
  });

  it("leaves legitimately-old listing years alone (a 1949 listing is real, not a placeholder)", () => {
    expect(formatDateLabel("listedYear", "1949-02-24")).toBe("listed 1949");
  });
});
