import { normalisePostcode } from "../../../shared/sanitize";
import { nearestN, type Coords } from "../geo";
import type { CareService, CareQuery } from "./contract";
import servicesJson from "../../../data/care/services.sample.json";
import postcodesJson from "../../../data/care/postcodes.sample.json";

// One row of the bundled corpus: the public fields plus lat/lng for the proximity sort. `category`/coords
// are internal — the CareService returned to the render drops them (why carries the plain-language reason).
export interface CareServiceRecord extends Coords {
  id: string;
  name: string;
  authority: string;
  category: string;
  why: string;
  officialUrl: string;
  lastUpdated: string;
}

const corpus = servicesJson as CareServiceRecord[];
const postcodeCoords = postcodesJson as Record<string, Coords>;

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Deterministic, model-free, fetch-free query: normalise the postcode, look up its coords in the bundled
// sample, return the nearest-N services (each tagged with distanceKm), mapped to the local CareService
// contract. Graceful, never-throwing fallbacks: an invalid postcode ⇒ { postcode: null, services: [] };
// a valid but unknown postcode ⇒ { postcode, services: [] }. Corpus is injectable for tests.
export function queryCareServices(
  prompt: string,
  services: CareServiceRecord[] = corpus,
  postcodes: Record<string, Coords> = postcodeCoords,
  n = 3
): CareQuery {
  const postcode = normalisePostcode(prompt);
  if (!postcode) return { postcode: null, services: [] };
  const origin = postcodes[postcode];
  if (!origin) return { postcode, services: [] };
  const nearest = nearestN(origin, services, n).map(
    (s): CareService => ({
      id: s.id,
      name: s.name,
      why: s.why,
      officialUrl: s.officialUrl,
      authority: s.authority,
      distanceKm: round1(s.distanceKm),
      lastUpdated: s.lastUpdated,
    })
  );
  return { postcode, services: nearest };
}
