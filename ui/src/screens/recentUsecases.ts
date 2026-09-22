// 026 P2: "Recently looked up" ring buffer. Pure so dedup/max-3/most-recent-first is unit-tested
// directly (rendering stays e2e's job, mirroring categoryCards.ts's own pure/tested split). Matches
// the design mock's own reducer verbatim (SortMyLondon.dc.html's `recentIds` state):
// `[id, ...prev.filter(x=>x!==id)].slice(0,3)`.
export function pushRecent(ids: readonly string[], id: string, max = 3): string[] {
  return [id, ...ids.filter((x) => x !== id)].slice(0, max);
}
