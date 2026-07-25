import { describe, it, expect } from "vitest";
import { suggestionMode } from "../src/suggestions";

// 020 P3 (#3): the example chips used to vanish after the first search and never return. The gate now
// shows the full hero chips on the empty state, nothing while a run streams, and a compact "try another"
// row once results are in — so a user can always pivot. Pure policy (mirrors useRotatingPlaceholder's
// shouldRotate), driven directly here; the rendering is glue verified by the e2e sweep.
describe("suggestionMode", () => {
  it("shows the hero chips on the empty state (no search yet)", () => {
    expect(suggestionMode({ hasSearched: false, isRunning: false })).toBe("hero");
  });

  it("shows nothing while a search is running (results are streaming)", () => {
    expect(suggestionMode({ hasSearched: true, isRunning: true })).toBe("none");
    expect(suggestionMode({ hasSearched: false, isRunning: true })).toBe("none");
  });

  it("shows the 'try another' row once results are in (searched, not running)", () => {
    expect(suggestionMode({ hasSearched: true, isRunning: false })).toBe("tryAnother");
  });
});
