// Pure geo helpers for the deterministic corpus workflows: great-circle distance + nearest-N. No I/O, no
// state — trivially testable and reusable by any workflow that ranks a bundled corpus by proximity.

export interface Coords {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

// Great-circle distance in km between two lat/lng points (haversine).
export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// A lat/lng bounding box of half-width `km` around `origin` (P2b, 017). Used to PREFILTER a D1 corpus
// read to a latitude band (`WHERE lat BETWEEN …`) so the query seeks an index instead of scanning the
// whole view. 1° latitude ≈ 111.32 km; 1° longitude shrinks by cos(latitude) as meridians converge, so
// the box is wider in longitude at London's latitude. London-only: no antimeridian/pole wrap handling.
// The box is a SUPERSET of the `km`-radius circle (its edges are exactly `km` away, corners farther), so
// a point within `km` of the origin is always inside — the prefilter can never drop a genuine nearest.
export function bboxAround(origin: Coords, km: number): BBox {
  // Great-circle km per degree of latitude, SAME Earth model as haversineKm (R·π/180) so the box edge
  // lines up with the distance metric nearestN ranks by. 1.01 safety margin makes the box a strict
  // SUPERSET of the km-radius circle (edge ≥ km even after float error), so a genuine sub-km result
  // can never fall outside the prefilter. Over-sizing by 1 % costs a negligible handful of extra rows.
  const KM_PER_DEG_LAT = (EARTH_RADIUS_KM * Math.PI) / 180;
  const SAFETY = 1.01;
  const dLat = (km * SAFETY) / KM_PER_DEG_LAT;
  // Guard cos→0 near the poles (not a London case, but keeps dLng finite instead of Infinity/NaN).
  const cosLat = Math.max(Math.cos(toRad(origin.lat)), 0.01);
  const dLng = (km * SAFETY) / (KM_PER_DEG_LAT * cosLat);
  return {
    minLat: origin.lat - dLat,
    maxLat: origin.lat + dLat,
    minLng: origin.lng - dLng,
    maxLng: origin.lng + dLng,
  };
}

// The `n` items closest to `origin`, each tagged with its `distanceKm`, sorted nearest-first. Ties keep
// input order (stable sort). `n <= 0` returns [].
export function nearestN<T extends Coords>(
  origin: Coords,
  items: readonly T[],
  n: number
): (T & { distanceKm: number })[] {
  if (n <= 0) return [];
  return items
    .map((it) => ({ ...it, distanceKm: haversineKm(origin, it) }))
    .sort((x, y) => x.distanceKm - y.distanceKm)
    .slice(0, n);
}

// Human-readable distance + walk estimate for a corpus result row (018 P5). Walking pace ≈ 12 min/km
// (~5 km/h). Branches on the ROUNDED metres (not raw km) so a value that rounds up to 1000 m always
// reads "1.0 km" (never "1000 m"), and a doorstep result reads "<50 m" instead of a bare "0 km".
export function humanDistance(km: number): string {
  const walkMin = Math.max(1, Math.round(km * 12));
  const metres = Math.round(km * 1000);
  if (metres < 50) return "<50 m";
  if (metres < 1000) return `${String(metres)} m · ~${String(walkMin)}-min walk`;
  return `${km.toFixed(1)} km · ~${String(walkMin)}-min walk`;
}
