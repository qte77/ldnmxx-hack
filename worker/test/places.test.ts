import { describe, it, expect } from "vitest";
import { resolvePlace } from "../../shared/places";

// 020 P2 (#1): a query that names a London place instead of a postcode ("wander nearby tower",
// "GP near Camden") must resolve to an anchor point so nearest-N can answer, instead of dead-ending
// on "Enter a valid UK postcode". Fetch-free lookup over the committed data/places.json.
describe("resolvePlace (committed London place gazetteer)", () => {
  it("resolves a bare landmark token: 'wander nearby tower' → Tower of London", () => {
    expect(resolvePlace("wander nearby tower")?.label).toBe("Tower of London");
  });

  it("resolves a borough by name and carries coords: 'GP near Camden' → Camden", () => {
    const p = resolvePlace("GP near Camden");
    expect(p?.label).toBe("Camden");
    expect(typeof p?.lat).toBe("number");
    expect(typeof p?.lng).toBe("number");
  });

  it("prefers the LONGEST alias: 'food near tower bridge' → Tower Bridge, not Tower of London", () => {
    expect(resolvePlace("food near tower bridge")?.label).toBe("Tower Bridge");
  });

  it("prefers a borough phrase over a bare token: 'parks in tower hamlets' → Tower Hamlets", () => {
    expect(resolvePlace("parks in tower hamlets")?.label).toBe("Tower Hamlets");
  });

  it("returns null when no place is named", () => {
    expect(resolvePlace("hello how are you today")).toBeNull();
  });

  it("matches whole words only: 'kewpie doll' does not resolve to Kew", () => {
    expect(resolvePlace("kewpie doll")).toBeNull();
  });
});
