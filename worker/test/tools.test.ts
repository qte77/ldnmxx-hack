import { describe, it, expect } from "vitest";
import { ASSESS_STAGE_TOOL, isValidAssessResult } from "../../shared/assessTool";
import { SEARCH_OPPORTUNITIES_TOOL, isValidSearchResult } from "../../shared/searchTool";

describe("assess_stage tool", () => {
  it("exposes a forced-tool schema named assess_stage", () => {
    expect(ASSESS_STAGE_TOOL.function.name).toBe("assess_stage");
  });
  it("accepts a well-formed result", () => {
    expect(isValidAssessResult({ reasoning: "early idea", stage: "idea", unlock: ["register", "build MVP"] })).toBe(true);
  });
  it("rejects an unknown stage", () => {
    expect(isValidAssessResult({ reasoning: "x", stage: "scaling", unlock: [] })).toBe(false);
  });
  it("rejects missing or mistyped fields", () => {
    expect(isValidAssessResult({ stage: "idea", unlock: [] })).toBe(false); // no reasoning
    expect(isValidAssessResult({ reasoning: "x", stage: "idea", unlock: "nope" })).toBe(false); // unlock not array
    expect(isValidAssessResult({ reasoning: "x", stage: "idea", unlock: [1, 2] })).toBe(false); // unlock not strings
    expect(isValidAssessResult(null)).toBe(false);
  });
});

describe("search_opportunities tool", () => {
  const ids = ["demo-001", "demo-002", "demo-003"];

  it("exposes a forced-tool schema named search_opportunities", () => {
    expect(SEARCH_OPPORTUNITIES_TOOL.function.name).toBe("search_opportunities");
  });
  it("accepts matches whose ids are all in the candidate set", () => {
    const r = {
      reasoning: "ranked by fit to a pre-revenue idea",
      matches: [
        { id: "demo-001", score: 90, whyItFits: "non-dilutive R&D fit", stageFit: "idea" },
        { id: "demo-003", score: 71, whyItFits: "London civic-tech" },
      ],
    };
    expect(isValidSearchResult(r, ids)).toBe(true);
  });
  it("rejects an invented id not in the candidate set", () => {
    const r = { reasoning: "x", matches: [{ id: "demo-999", score: 90, whyItFits: "fits" }] };
    expect(isValidSearchResult(r, ids)).toBe(false);
  });
  it("rejects empty matches or missing fields", () => {
    expect(isValidSearchResult({ reasoning: "x", matches: [] }, ids)).toBe(false); // empty
    expect(isValidSearchResult({ matches: [{ id: "demo-001", score: 1, whyItFits: "y" }] }, ids)).toBe(false); // no reasoning
    expect(isValidSearchResult({ reasoning: "x", matches: [{ id: "demo-001", whyItFits: "y" }] }, ids)).toBe(false); // no score
  });
  // Untrusted model JSON: a non-object anywhere in the payload must be REJECTED, never thrown on —
  // the caller relies on a boolean to fall back to the canned cards.
  it("rejects a non-object result without throwing", () => {
    expect(isValidSearchResult(null, ids)).toBe(false);
    expect(isValidSearchResult("nope", ids)).toBe(false);
  });
  it("rejects a non-object match element without throwing", () => {
    expect(isValidSearchResult({ reasoning: "x", matches: [null] }, ids)).toBe(false);
    expect(isValidSearchResult({ reasoning: "x", matches: ["demo-001"] }, ids)).toBe(false);
  });
});
