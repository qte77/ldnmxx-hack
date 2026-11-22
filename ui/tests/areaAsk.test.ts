import { describe, it, expect } from "vitest";
import { areaAsk } from "../src/screens/areaAsk";
import { usecaseCatalog, type CatalogEntry } from "../../shared/usecaseCatalog";
import { normalisePostcode } from "../../shared/sanitize";
import { resolvePlace } from "../../shared/places";
import { boroughLabels } from "../src/boroughs";

// #353: a card or chip tap answers for the user's saved area, not for the canned example's postcode.
const byId = (id: string): CatalogEntry => {
  const entry = usecaseCatalog().find((u) => u.id === id);
  if (!entry) throw new Error(`no catalog entry ${id}`);
  return entry;
};
const names = (text: string) => normalisePostcode(text) !== null || resolvePlace(text) !== null;

describe("areaAsk", () => {
  it("keeps the canned example and marks it as an example when no area is set", () => {
    expect(areaAsk(byId("sort-my-care"), null)).toEqual({ text: "GP near E8 3GT", isExample: true });
  });

  it("asks for the saved area instead of the example's postcode", () => {
    expect(areaAsk(byId("sort-my-care"), "Camden")).toEqual({ text: "GP near Camden", isExample: false });
  });

  it("uses the saved area for every routable usecase whose example names a location", () => {
    // Guards the catalog: a new routable example that names a place in another phrasing ("in X")
    // would otherwise silently keep someone else's area.
    const located = usecaseCatalog().filter((u) => u.keywords.length > 0 && names(u.example));
    expect(located.length).toBeGreaterThan(0);
    for (const entry of located) {
      const ask = areaAsk(entry, "Hackney");
      expect(ask.isExample).toBe(false);
      expect(resolvePlace(ask.text)?.label).toBe("Hackney");
      expect(normalisePostcode(ask.text)).toBeNull();
    }
  });

  it("leaves an example that names no location alone, and never labels it as an example area", () => {
    const scam = byId("sort-my-scam-check");
    expect(areaAsk(scam, null)).toEqual({ text: scam.example, isExample: false });
    expect(areaAsk(scam, "Camden")).toEqual({ text: scam.example, isExample: false });
  });

  it("keeps a from/to route canned (still an example) even with an area set", () => {
    const route = byId("sort-my-route");
    expect(areaAsk(route, "Camden")).toEqual({ text: route.example, isExample: true });
  });

  it("produces an ask the Worker resolves to the same place for every borough the select offers", () => {
    const care = byId("sort-my-care");
    for (const borough of boroughLabels()) {
      expect(resolvePlace(areaAsk(care, borough).text)?.label).toBe(borough);
    }
  });
});
