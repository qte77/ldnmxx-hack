import { describe, it, expect } from "vitest";
import { buildScamCards } from "../src/scam/render";
import { scamLabels } from "../src/scam/registry";
import type { ScamQuery } from "../src/scam/query";
import type { CorpusRow } from "../src/corpus/contract";

const VERDICT_WORDS = /\b(safe|legitimate|genuine|verified|trustworthy|green check|all clear)\b/i;

const row = (over: Partial<CorpusRow>): CorpusRow => ({
  id: "auth",
  title: "Thames Capital Partners LLP",
  line: "FRN 210987 · CH OC345678 · on the FCA register (authorised)",
  why: "A clone can copy an authorised firm's name and FRN — confirm you're dealing with the real firm.",
  officialUrl: "https://register.fca.org.uk/",
  ...over,
});

const q = (over: Partial<ScamQuery>): ScamQuery => ({
  query: "Thames Capital Partners",
  rows: [row({})],
  asOf: "2026-06-01",
  labels: scamLabels,
  cloneCaution: null,
  ...over,
});

const json = (v: unknown): string => JSON.stringify(v);

describe("buildScamCards", () => {
  it("renders the FCA official link + the disclaimer + a verify/confirm line", () => {
    const s = json(buildScamCards(q({})));
    expect(s).toContain("register.fca.org.uk");
    expect(s).toContain("Always confirm with the official source");
    expect(s.toLowerCase()).toMatch(/verify|confirm/);
  });

  it("NEVER renders a verdict / green check", () => {
    expect(json(buildScamCards(q({})))).not.toMatch(VERDICT_WORDS);
  });

  it("renders the clone caution when present", () => {
    const s = json(
      buildScamCards(
        q({
          cloneCaution:
            "Similar name in sample: 'Thames Capital Partners Ltd' — not on the register. Names alone don't confirm identity — verify on the FCA register.",
        }),
      ),
    );
    expect(s).toContain("Thames Capital Partners Ltd");
  });

  it("empty-invalid (query null) prompts for a firm name / FRN, still with the disclaimer", () => {
    const s = json(buildScamCards(q({ query: null, rows: [] })));
    expect(s.toLowerCase()).toMatch(/firm name|frn/);
    expect(s).toContain("Always confirm with the official source");
  });

  it("empty-unknown (valid query, no match) says no match + still routes to the register", () => {
    const s = json(buildScamCards(q({ rows: [] })));
    expect(s.toLowerCase()).toContain("no firm");
    expect(s).toContain("register.fca.org.uk");
  });
});
