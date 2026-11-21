// #353: the ask a category card or suggestion chip submits. A canned example names someone else's
// area ("GP near E8 3GT"), and withLocationAnchor (locationAnchor.ts) only anchors asks that name no
// location, so without this a tap ignored the saved area. With an area set, the example's trailing
// "near <place>" becomes "near <area>"; the Worker resolves the borough via shared/places.resolvePlace.
// `isExample` is true while the submitted ask still names the example's own place, so the UI can
// label it as an example. Pure, so it is unit-tested directly (rendering stays e2e's job).
import type { CatalogEntry } from "../../../shared/usecaseCatalog";
import { normalisePostcode } from "../../../shared/sanitize";
import { resolvePlace } from "../../../shared/places";

export interface AreaAsk {
  text: string;
  isExample: boolean;
}

const NEAR_PLACE = /\bnear .+$/i;

export function areaAsk(entry: Pick<CatalogEntry, "example">, area: string | null): AreaAsk {
  const { example } = entry;
  const namesPlace = normalisePostcode(example) !== null || resolvePlace(example) !== null;
  if (area && namesPlace && NEAR_PLACE.test(example)) {
    return { text: example.replace(NEAR_PLACE, `near ${area}`), isExample: false };
  }
  return { text: example, isExample: namesPlace };
}
