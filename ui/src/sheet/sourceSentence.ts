// 024 P6b (design re-sync): the design's dialog-body meta line reads as ONE sentence — "This is the
// same information your council publishes — {source}, updated {date}." — not two floating "Source: X"
// / "Updated Y" labels (SortMyLondon.dc.html, re-pulled 2026-09-19). Our usecases aren't council
// registers (CQC/FSA/Historic England/OS/FCA), so "your council" is swapped for the actual source name
// rather than ported verbatim — same sentence STRUCTURE, honest content.
//
// Pure text assembly, mirrors freshnessLookup.ts's pattern: tested here, the JSX call site stays a
// one-line render.
export function sourceSentence(source: string | undefined, asOf: string | null): string | null {
  if (source && asOf) return `This is the same information ${source} publishes, updated ${asOf}.`;
  if (source) return `This is the same information ${source} publishes.`;
  if (asOf) return `Updated ${asOf}.`;
  return null;
}
