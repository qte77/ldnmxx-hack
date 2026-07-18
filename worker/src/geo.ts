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
