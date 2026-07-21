import { describe, it, expect } from "vitest";
import { matchFirms, normaliseFirmQuery, queryScamDef } from "../src/scam/query";
import { scamFirms, scamLabels, type ScamRecord } from "../src/scam/registry";

// Words that would turn an honest FLAG into a VERDICT. The tool must never render any of these — the
// catalog's hard rule is "never render a green check" (data/usecase-catalog.json). "scam" is
// deliberately NOT forbidden: the honest copy says "that doesn't mean it's a scam".
const VERDICT_WORDS = /\b(safe|legitimate|genuine|verified|trustworthy|green check|all clear)\b/i;

const rec = (over: Partial<ScamRecord>): ScamRecord => ({
  id: "x",
  name: "X Ltd",
  frn: null,
  chNumber: "00000000",
  fcaStatus: "not-on-register",
  lastUpdated: "2026-06-01",
  ...over,
});

const firms: ScamRecord[] = [
  rec({ id: "auth", name: "Thames Capital Partners LLP", frn: "210987", chNumber: "OC345678", fcaStatus: "authorised", lastUpdated: "2026-06-01" }),
  rec({ id: "clone", name: "Thames Capital Partners Ltd", frn: null, chNumber: "12876543", fcaStatus: "not-on-register", lastUpdated: "2026-05-20" }),
  rec({ id: "gone", name: "Brixton Mutual Savings plc", frn: "308812", chNumber: "09112233", fcaStatus: "no-longer-authorised", lastUpdated: "2026-05-10" }),
];

describe("normaliseFirmQuery", () => {
  it("trims + collapses internal whitespace", () => {
    expect(normaliseFirmQuery("  Thames   Capital  ")).toBe("Thames Capital");
  });
  it("caps length", () => {
    expect(normaliseFirmQuery("a".repeat(200)).length).toBeLessThanOrEqual(100);
  });
});

describe("matchFirms", () => {
  it("matches by case-insensitive name substring", () => {
    expect(matchFirms("thames capital", firms, 5).map((r) => r.id).sort()).toEqual(["auth", "clone"]);
  });
  it("matches by exact FRN", () => {
    expect(matchFirms("210987", firms, 5).map((r) => r.id)).toEqual(["auth"]);
  });
  it("matches by exact Companies House number", () => {
    expect(matchFirms("09112233", firms, 5).map((r) => r.id)).toEqual(["gone"]);
  });
  it("returns [] for no match and caps to n", () => {
    expect(matchFirms("nonesuch-firm", firms, 5)).toEqual([]);
    expect(matchFirms("a", firms, 1).length).toBeLessThanOrEqual(1);
  });
});

describe("queryScamDef", () => {
  it("blank / too-short input -> empty-invalid (query null, no rows)", () => {
    const q = queryScamDef(firms, scamLabels, "  ");
    expect(q.query).toBeNull();
    expect(q.rows).toEqual([]);
    expect(q.cloneCaution).toBeNull();
  });

  it("valid input, no match -> empty-unknown (query set, rows empty)", () => {
    const q = queryScamDef(firms, scamLabels, "Zzz Nonesuch");
    expect(q.query).toBe("Zzz Nonesuch");
    expect(q.rows).toEqual([]);
  });

  it("a hit carries the facts, NEVER a verdict, and always routes to the FCA register", () => {
    const q = queryScamDef(firms, scamLabels, "Thames Capital Partners");
    expect(q.rows.length).toBe(2);
    for (const row of q.rows) {
      expect(row.officialUrl).toContain("fca");
      expect(`${row.line} ${row.why}`).not.toMatch(VERDICT_WORDS);
    }
    const auth = q.rows.find((r) => r.title.includes("LLP"));
    expect(auth?.line).toContain("FRN 210987");
    expect(auth?.line.toLowerCase()).toContain("authorised");
  });

  it("flags a clone pattern deterministically: authorised + not-on-register sharing a name stem", () => {
    const q = queryScamDef(firms, scamLabels, "Thames Capital Partners");
    expect(q.cloneCaution).toBeTruthy();
    expect(q.cloneCaution).toContain("Thames Capital Partners Ltd");
    expect(q.cloneCaution ?? "").not.toMatch(VERDICT_WORDS);
  });

  it("no clone caution when the match has no authorised/not-on-register look-alike pair", () => {
    expect(queryScamDef(firms, scamLabels, "Brixton").cloneCaution).toBeNull();
  });

  it("asOf is the conservative (oldest) lastUpdated across the shown rows", () => {
    expect(queryScamDef(firms, scamLabels, "Thames Capital Partners").asOf).toBe("2026-05-20");
  });
});

describe("the committed sample dataset", () => {
  it("uses only known FCA statuses (a data typo would silently fall through to the derived copy)", () => {
    const known = new Set(["authorised", "no-longer-authorised", "not-on-register"]);
    for (const f of scamFirms) expect(known.has(f.fcaStatus)).toBe(true);
  });
  it("includes the clone-pair the demo relies on", () => {
    const q = queryScamDef(scamFirms, scamLabels, "Thames Capital Partners");
    expect(q.rows.length).toBeGreaterThanOrEqual(2);
    expect(q.cloneCaution).toBeTruthy();
  });
});
