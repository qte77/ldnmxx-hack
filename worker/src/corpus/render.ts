import { cardsBatch, appendDisclaimer, type CardSpec } from "../a2ui/cards";
import type { CorpusQuery } from "./contract";
import { formatDateLabel } from "../dates";

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
      title: q.query ? `No sample ${labels.noun}s near ${q.query}` : "Enter a London postcode or place",
      lines: [q.query ? labels.emptyUnknownHint : labels.emptyInvalidHint],
    };
    return appendDisclaimer(cardsBatch([empty]), labels.officialLink, labels.attribution);
  }
  const count = q.rows.length;
  // P3 (#225): word the date claim per THIS corpus's date semantics (a genuine freshness date vs a
  // record's own listing/inspection age), and drop the " · " separator entirely when there is no
  // honest claim — never a dangling "summaryLine · data as of ".
  const dateClaim = formatDateLabel(labels.dateLabel, q.asOf);
  const summary: CardSpec = {
    key: "summary",
    // 018 P5: a per-workflow glyph on the title; the shared authority (de-duped off every row by
    // query.ts) tagged here as its own line — only when the whole result set truly shares one.
    title: `${labels.glyph} ${String(count)} ${labels.noun}${count > 1 ? "s" : ""} near ${q.query ?? ""}`,
    lines: [
      dateClaim ? `${labels.summaryLine} · ${dateClaim}` : labels.summaryLine,
      ...(q.sharedAuthority ? [q.sharedAuthority] : []),
    ],
  };
  // 018 P5: the card TITLE is now the official-source link — drops the separate "[Official page]" row
  // (one destination per card, less clutter). The markdown link renders as an anchor; its text = title.
  const cards: CardSpec[] = q.rows.map((r) => ({
    key: r.id,
    title: `[${r.title}](${r.officialUrl})`,
    lines: [r.line, r.why],
  }));
  return appendDisclaimer(cardsBatch([summary, ...cards]), labels.officialLink, labels.attribution);
}
