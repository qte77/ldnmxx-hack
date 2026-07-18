import { describe, it, expect } from "vitest";
import { queryCareServices, type CareServiceRecord } from "../src/care/careServices";
import type { Coords } from "../src/geo";

const services: CareServiceRecord[] = [
  { id: "near", name: "Near GP", authority: "NHS A", category: "GP surgery", why: "register", officialUrl: "https://nhs.uk/near", lat: 51.501, lng: -0.14, lastUpdated: "2026-06-01" },
  { id: "mid", name: "Mid Pharmacy", authority: "NHS B", category: "Pharmacy", why: "advice", officialUrl: "https://nhs.uk/mid", lat: 51.52, lng: -0.12, lastUpdated: "2026-05-01" },
  { id: "far", name: "Far Dentist", authority: "NHS C", category: "Dentist", why: "checkup", officialUrl: "https://nhs.uk/far", lat: 51.6, lng: -0.3, lastUpdated: "2026-04-01" },
];
const postcodes: Record<string, Coords> = { "SW1A 1AA": { lat: 51.501, lng: -0.141 } };

describe("queryCareServices", () => {
  it("returns the nearest-N services, sorted, distanceKm attached, in the local contract shape", () => {
    const q = queryCareServices("SW1A 1AA", services, postcodes, 2);
    expect(q.postcode).toBe("SW1A 1AA");
    expect(q.services.map((s) => s.id)).toEqual(["near", "mid"]);
    expect(q.services[0].distanceKm).toBeLessThanOrEqual(q.services[1].distanceKm);
    // contract shape only — internal corpus fields (lat/lng/category) must not leak
    expect(Object.keys(q.services[0]).sort()).toEqual(
      ["authority", "distanceKm", "id", "lastUpdated", "name", "officialUrl", "why"].sort()
    );
  });

  it("extracts the postcode from a longer prompt", () => {
    const q = queryCareServices("services near SW1A 1AA thanks", services, postcodes, 1);
    expect(q.postcode).toBe("SW1A 1AA");
    expect(q.services).toHaveLength(1);
  });

  it("returns a null-postcode empty result for an invalid postcode (graceful, no throw)", () => {
    expect(queryCareServices("not a postcode", services, postcodes)).toEqual({ postcode: null, services: [] });
  });

  it("keeps the postcode but returns no services for a valid-but-unknown postcode", () => {
    expect(queryCareServices("N1 9GU", services, postcodes)).toEqual({ postcode: "N1 9GU", services: [] });
  });

  it("wires up against the bundled corpus (defaults) for a known demo postcode", () => {
    const q = queryCareServices("SW9 9SL");
    expect(q.postcode).toBe("SW9 9SL");
    expect(q.services.length).toBeGreaterThan(0);
    expect(q.services.length).toBeLessThanOrEqual(3);
    expect(typeof q.services[0].distanceKm).toBe("number");
  });
});
