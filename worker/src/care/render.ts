import { cardsBatch, appendDisclaimer, type CardSpec } from "../a2ui/cards";
import type { CareQuery } from "./contract";

// Build the Sort My Care A2UI batch from a deterministic query result. Reuses cardsBatch (one card builder,
// every workflow) + appendDisclaimer (the generic "confirm with the official source" caveat). Corpus
// freshness is shown IN the summary card (from lastUpdated) — honest about staleness at the point of use.
export function buildCareCards(q: CareQuery): unknown[] {
  if (q.services.length === 0) {
    const empty: CardSpec = {
      key: "empty",
      title: q.postcode ? `No sample services near ${q.postcode}` : "Enter a valid UK postcode",
      lines: [
        q.postcode
          ? "We don't have sample data for that postcode yet — try SW9 9SL, E1 6AN or N1 9GU."
          : "Try a London postcode like SW9 9SL.",
      ],
    };
    return appendDisclaimer(cardsBatch([empty]));
  }
  // Oldest lastUpdated = the conservative freshness to advertise across the shown services.
  const asOf = q.services.map((s) => s.lastUpdated).sort()[0];
  const summary: CardSpec = {
    key: "summary",
    title: `${q.services.length} service${q.services.length > 1 ? "s" : ""} near ${q.postcode}`,
    lines: [`Nearest public-service signposts · data as of ${asOf}`],
  };
  const cards: CardSpec[] = q.services.map((s) => ({
    key: s.id,
    title: s.name,
    lines: [`${s.authority} · ${s.distanceKm} km`, s.why, `[Official service page](${s.officialUrl})`],
  }));
  return appendDisclaimer(cardsBatch([summary, ...cards]));
}
