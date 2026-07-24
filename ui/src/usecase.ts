// Resolve the ?usecase= BYPASS from the query string (017 P3). An explicit, known id skips the
// server-side router (deep links + the founders demo keep working); anything else — absent, empty, or
// unknown — returns null so the router decides from the typed prompt. There is NO mount-time flagship
// fallback any more: the app has one input, and forcing a default workflow before the user asks would
// re-introduce the silent default P2's no-match card exists to avoid.
export function readUsecase(search: string, knownIds: readonly string[]): string | null {
  const requested = new URLSearchParams(search).get("usecase");
  return requested !== null && knownIds.includes(requested) ? requested : null;
}
