import { cardsBatch, appendDisclaimer, type CardSpec } from "../a2ui/cards";
import type { CorpusQuery } from "./contract";

// Build the A2UI batch for ANY deterministic corpus workflow from its query result. Reuses cardsBatch
// (one card builder, every workflow) + appendDisclaimer (the "confirm with the official source"
// caveat, pointed at THIS corpus's curated link). Corpus freshness is shown IN the summary card —
// honest about staleness at the point of use.
//
// Shape-agnostic by design: each row supplies its own pre-formatted `line`, so a match-shaped
// workflow (Scam) reuses this render verbatim rather than forcing a refactor.
export function buildCorpusCards(q: CorpusQuery): unknown[] {
  const { labels } = q;
  if (q.rows.length === 0) {
    const empty: CardSpec = {
      key: "empty",
      title: q.query ? `No sample ${labels.noun}s near ${q.query}` : "Enter a valid UK postcode",
      lines: [q.query ? labels.emptyUnknownHint : labels.emptyInvalidHint],
    };
    return appendDisclaimer(cardsBatch([empty]), labels.officialLink);
  }
  const count = q.rows.length;
  const summary: CardSpec = {
    key: "summary",
    title: `${String(count)} ${labels.noun}${count > 1 ? "s" : ""} near ${q.query ?? ""}`,
    lines: [`${labels.summaryLine} · data as of ${q.asOf ?? ""}`],
  };
  const cards: CardSpec[] = q.rows.map((r) => ({
    key: r.id,
    title: r.title,
    lines: [r.line, r.why, `[Official page](${r.officialUrl})`],
  }));
  return appendDisclaimer(cardsBatch([summary, ...cards]), labels.officialLink);
}
