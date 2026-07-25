import { describe, it, expect } from "vitest";
import { haversineKm, nearestN, bboxAround, humanDistance } from "../src/geo";

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
    expect(out[0]!.distanceKm).toBeLessThan(out[1]!.distanceKm);
    expect(typeof out[0]!.distanceKm).toBe("number");
  });

  it("caps at the array length and returns [] for n <= 0", () => {
    expect(nearestN(origin, items, 99)).toHaveLength(3);
    expect(nearestN(origin, items, 0)).toEqual([]);
  });
});

// P2b (017): the bbox prefilter's pure core. Bounds a lat/lng box around an origin so the D1 read
// seeks a latitude band instead of scanning the whole view. London-only (no antimeridian wrap).
describe("bboxAround", () => {
  const origin = { lat: 51.5, lng: -0.1 };

  it("centres the box on the origin (origin inside; symmetric in latitude)", () => {
    const b = bboxAround(origin, 5);
    expect(b.minLat).toBeLessThan(origin.lat);
    expect(b.maxLat).toBeGreaterThan(origin.lat);
    expect(b.minLng).toBeLessThan(origin.lng);
    expect(b.maxLng).toBeGreaterThan(origin.lng);
    expect(origin.lat - b.minLat).toBeCloseTo(b.maxLat - origin.lat, 9); // symmetric about origin
  });

  it("a corner of the box is at least the requested radius away (so it never under-covers)", () => {
    const km = 5;
    const b = bboxAround(origin, km);
    // The nearest box EDGE (due north/east) must be at least `km` away — a point within `km` of the
    // origin can never fall outside the box, so the prefilter cannot drop a genuine nearest result.
    expect(haversineKm(origin, { lat: b.maxLat, lng: origin.lng })).toBeGreaterThanOrEqual(km);
    expect(haversineKm(origin, { lat: origin.lat, lng: b.maxLng })).toBeGreaterThanOrEqual(km);
  });

  it("a wider radius yields a strictly larger box", () => {
    const small = bboxAround(origin, 5);
    const big = bboxAround(origin, 15);
    expect(big.maxLat - big.minLat).toBeGreaterThan(small.maxLat - small.minLat);
    expect(big.maxLng - big.minLng).toBeGreaterThan(small.maxLng - small.minLng);
  });

  it("widens longitude more than latitude at London's latitude (meridians converge)", () => {
    const b = bboxAround(origin, 5);
    expect(b.maxLng - b.minLng).toBeGreaterThan(b.maxLat - b.minLat);
  });
});

// 018 P5: human-readable distance + walk estimate for a result row — never a bare "0 km".
describe("humanDistance", () => {
  it("reads '<50 m' on the doorstep (never '0 km')", () => {
    expect(humanDistance(0)).toBe("<50 m");
    expect(humanDistance(0.049)).toBe("<50 m");
  });
  it("reads metres + a walk estimate under 1 km", () => {
    expect(humanDistance(0.05)).toBe("50 m · ~1-min walk");
    expect(humanDistance(0.4)).toBe("400 m · ~5-min walk");
    expect(humanDistance(0.999)).toBe("999 m · ~12-min walk");
  });
  it("reads one-decimal km + a walk estimate at 1 km and above (never '1000 m')", () => {
    expect(humanDistance(1)).toBe("1.0 km · ~12-min walk");
    expect(humanDistance(2.34)).toBe("2.3 km · ~28-min walk");
    expect(humanDistance(0.9996)).toBe("1.0 km · ~12-min walk"); // 999.6 m rounds to 1000 → km branch
  });
});
