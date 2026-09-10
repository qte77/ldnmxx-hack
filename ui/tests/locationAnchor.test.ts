import { describe, it, expect } from "vitest";
import { withLocationAnchor } from "../src/screens/locationAnchor";

// 024 P1: the borough location ANCHOR (never a filter) — append the saved borough to a submitted ask
// only when it names no location of its own, so the Worker's existing place-resolution
// (shared/sanitize.normalisePostcode, shared/places.resolvePlace) still has a starting point when the
// user typed none. Real UK-postcode/place logic is reused verbatim (DRY) rather than reimplemented.
describe("withLocationAnchor", () => {
  it("returns the text unchanged when no borough is set", () => {
    expect(withLocationAnchor("GP near me", null)).toBe("GP near me");
  });

  it("returns the text unchanged when it already contains a UK postcode", () => {
    expect(withLocationAnchor("GP near E8 3GT", "Camden")).toBe("GP near E8 3GT");
  });

  it("returns the text unchanged when it already names a known place", () => {
    expect(withLocationAnchor("parks to wander near Camden", "Islington")).toBe(
      "parks to wander near Camden",
    );
  });

  it("appends the borough as a location anchor when the ask names no location of its own", () => {
    expect(withLocationAnchor("GP near me", "Camden")).toBe("GP near me, Camden");
  });

  it("leaves an empty/whitespace-only ask empty even with a borough set — never invents a query", () => {
    // A bare borough is not an ask: the router would otherwise see ", Camden" instead of "" and might
    // guess a workflow, brushing the locked "no silent default" decision (ADR — one input, no
    // mount-time flagship fallback). An empty ask must reach the router exactly as empty.
    expect(withLocationAnchor("", "Camden")).toBe("");
    expect(withLocationAnchor("   ", "Camden")).toBe("   ");
  });
});
