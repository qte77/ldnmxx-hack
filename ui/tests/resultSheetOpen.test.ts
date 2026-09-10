import { describe, it, expect } from "vitest";
import { resultSheetOpen } from "../src/screens/resultSheetOpen";

// 024 P2: a REAL bug caught by the headless smoke check — a run that fails on the network (no local
// worker, a CORS/base-URL mismatch, …) sets `error` but never appends to `eventLog`, so `isRunning`
// flips back to false the instant the fetch rejects and a naive `hasSearched` (isRunning ||
// eventLog.length > 0) reverts to false. Gating the sheet on `hasSearched` alone made it open and
// immediately close on a failed run, hiding the very error it exists to show. `error` must keep the
// sheet open on its own, independent of `hasSearched` — mirroring the ORIGINAL inline error block,
// which rendered whenever `error` was set, never conditioned on `hasSearched`.
describe("resultSheetOpen", () => {
  it("is closed with nothing searched, no error, not dismissed", () => {
    expect(resultSheetOpen({ hasSearched: false, error: null, dismissed: false })).toBe(false);
  });

  it("opens while a search is running or has results (hasSearched)", () => {
    expect(resultSheetOpen({ hasSearched: true, error: null, dismissed: false })).toBe(true);
  });

  it("stays open on a failed run even though hasSearched has reverted to false", () => {
    expect(resultSheetOpen({ hasSearched: false, error: "network error", dismissed: false })).toBe(true);
  });

  it("an explicit dismiss closes it regardless of hasSearched/error", () => {
    expect(resultSheetOpen({ hasSearched: true, error: null, dismissed: true })).toBe(false);
    expect(resultSheetOpen({ hasSearched: false, error: "boom", dismissed: true })).toBe(false);
  });
});
