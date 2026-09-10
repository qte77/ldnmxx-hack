// ui/src/boroughs.ts (024 P3) — the borough list for the Settings "Your area" selector. Reuses the
// committed data/places.json gazetteer directly (imported the same relative way shared/places.ts
// does, from ../../data/places.json) rather than hand-authoring a duplicate borough-name list, which
// could drift from the real data.
//
// The gazetteer has no `type` field distinguishing a borough from a neighbourhood/landmark entry, but
// its documented curation order does: the 32 London boroughs + the City of London are listed FIRST,
// as exactly 33 entries ("City of London" .. "Hillingdon"), before any neighbourhood/landmark entry
// (Shoreditch, Tower of London, Hyde Park, ...) appears. This derives the split from that ordering.
// The exact 33-label set is pinned by ui/tests/boroughs.test.ts's literal expectation — a future
// reorder of data/places.json fails that test loudly instead of silently admitting a landmark or
// dropping a real borough.
import placesData from "../../data/places.json";

const LONDON_BOROUGH_COUNT = 33; // 32 London boroughs + City of London

interface RawPlace {
  label: string;
}

const PLACES = (placesData as { places: RawPlace[] }).places;

/** Borough labels for the Settings borough <select>, alphabetically sorted for scanability. Each
 *  label matches a data/places.json alias verbatim (its lower-cased form), so it round-trips through
 *  `shared/places.ts`'s resolvePlace() when used as a Home-screen location anchor (row 4). */
export function boroughLabels(): string[] {
  return PLACES.slice(0, LONDON_BOROUGH_COUNT)
    .map((p) => p.label)
    .sort((a, b) => a.localeCompare(b));
}
