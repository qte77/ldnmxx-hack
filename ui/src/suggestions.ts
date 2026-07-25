// 020 P3 (#3): which suggestion surface to show, given the search state. The empty state shows the full
// hero chips; while a run streams, nothing (results lead); once results are in, a compact "try another"
// row so the user can always pivot to another workflow. Pure — mirrors useRotatingPlaceholder's gate.

export type SuggestionMode = "hero" | "tryAnother" | "none";

export function suggestionMode(state: { hasSearched: boolean; isRunning: boolean }): SuggestionMode {
  if (state.isRunning) return "none";
  if (!state.hasSearched) return "hero";
  return "tryAnother";
}
