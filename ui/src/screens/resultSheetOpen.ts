// 024 P2: whether the ResultSheet should be open. NOT simply `hasSearched` — a run that fails on the
// network (no local worker, a CORS/base-URL mismatch, …) sets `error` but never appends an event to
// `eventLog`, and `isRunning` flips back to false the instant the fetch rejects. A naive
// `hasSearched = isRunning || eventLog.length > 0` would then revert to false, closing the sheet the
// moment the very error it exists to show appears. `error` therefore keeps the sheet open on its own,
// mirroring the ORIGINAL inline error block (rendered whenever `error` was set, independent of
// `hasSearched`) that this sheet replaced. An explicit dismiss always wins.
export function resultSheetOpen(state: { hasSearched: boolean; error: string | null; dismissed: boolean }): boolean {
  return (state.hasSearched || state.error !== null) && !state.dismissed;
}
