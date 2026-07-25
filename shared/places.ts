// Place-name → anchor-coords resolver for the corpus workflows (020 P1/#1). When the user types a
// London place instead of a postcode ("wander nearby tower", "GP near Camden"), resolve it to an
// approximate anchor point so nearest-N can still answer. Fetch-free (ADR 0002): a static in-memory
// lookup over the committed data/places.json — NO external geocoder on the hot path. Returns plain
// numbers (not the worker-only Coords type) so this stays in shared/ with no worker import.

import { matchesWholeWord } from "./text-match";
import placesData from "../data/places.json";

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

interface PlaceEntry extends Place {
  aliases: string[];
}

// Only `places` is read; the JSON's `_note` documents provenance.
const PLACES = (placesData as { places: PlaceEntry[] }).places;

// The LONGEST alias that appears as a whole word/phrase wins, so "tower bridge" beats "tower" and a
// borough phrase ("tower hamlets") beats a bare landmark token. Null when the ask names no known place.
export function resolvePlace(prompt: string): Place | null {
  const text = prompt.toLowerCase();
  let best: Place | null = null;
  let bestLen = 0;
  for (const p of PLACES) {
    for (const alias of p.aliases) {
      if (alias.length > bestLen && matchesWholeWord(text, alias)) {
        best = { label: p.label, lat: p.lat, lng: p.lng };
        bestLen = alias.length;
      }
    }
  }
  return best;
}
