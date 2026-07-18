import { describe, it, expect } from "vitest";
import { haversineKm, nearestN } from "../src/geo";

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.1 })).toBe(0);
  });

  it("is ~111 km for one degree of longitude at the equator", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeGreaterThan(111);
    expect(d).toBeLessThan(112);
  });

  it("is symmetric", () => {
    const a = { lat: 51.46, lng: -0.11 };
    const b = { lat: 51.52, lng: -0.06 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe("nearestN", () => {
  const origin = { lat: 51.5, lng: -0.1 };
  const items = [
    { id: "far", lat: 51.9, lng: -0.5 },
    { id: "near", lat: 51.51, lng: -0.1 },
    { id: "mid", lat: 51.6, lng: -0.2 },
  ];

  it("returns the n closest, sorted nearest-first, each tagged with distanceKm", () => {
    const out = nearestN(origin, items, 2);
    expect(out.map((o) => o.id)).toEqual(["near", "mid"]);
    expect(out[0].distanceKm).toBeLessThan(out[1].distanceKm);
    expect(typeof out[0].distanceKm).toBe("number");
  });

  it("caps at the array length and returns [] for n <= 0", () => {
    expect(nearestN(origin, items, 99)).toHaveLength(3);
    expect(nearestN(origin, items, 0)).toEqual([]);
  });
});
