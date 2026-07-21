import { cardsBatch, appendDisclaimer, type CardSpec } from "../a2ui/cards";
import type { ScamQuery } from "./query";

// Build the A2UI batch for the scam-check MATCH workflow. Reuses the shared cardsBatch / appendDisclaimer
// primitives (one card builder, one disclaimer) but keeps its OWN copy: buildCorpusCards' titles are
// geo-worded ("…near {q}", "Enter a valid UK postcode"), which read wrong — and, for a fraud flag,
// unsafe — for a firm lookup. This render is a FLAG, never a verdict: every state routes the user to
// the FCA register, and no status is ever presented as "safe" / a green check.
export function buildScamCards(q: ScamQuery): unknown[] {
  const { labels } = q;
  if (q.rows.length === 0) {
    const empty: CardSpec = {
      key: "empty",
      title: q.query
        ? `No ${labels.noun} matches '${q.query}'`
        : "Enter a firm name or FCA reference (FRN)",
      lines: [q.query ? labels.emptyUnknownHint : labels.emptyInvalidHint],
    };
    return appendDisclaimer(cardsBatch([empty]), labels.officialLink);
  }
  const count = q.rows.length;
  const summary: CardSpec = {
    key: "summary",
    title: `${String(count)} ${labels.noun}${count > 1 ? "s" : ""} matching '${q.query ?? ""}'`,
    lines: [`${labels.summaryLine} · data as of ${q.asOf ?? ""}`],
  };
  const rowCards: CardSpec[] = q.rows.map((r) => ({
    key: r.id,
    title: r.title,
    lines: [r.line, r.why, `[${labels.officialLink.text}](${r.officialUrl})`],
  }));
  const cards: CardSpec[] = [summary, ...rowCards];
  // The deterministic clone flag (query.ts) — a neutral note, only when the results themselves contain
  // an authorised firm and a not-on-register look-alike.
  if (q.cloneCaution) {
    cards.push({ key: "clone-caution", title: "⚠ Similar name in our sample", lines: [q.cloneCaution] });
  }
  return appendDisclaimer(cardsBatch(cards), labels.officialLink);
}
