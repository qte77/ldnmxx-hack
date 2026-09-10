// 024 P1: Home's "Common questions" card order. Pure so the ordering + flags (e.g. `sampleData`) are
// unit-tested directly, without needing to render the list — rendering/wiring stays e2e's job, per this
// repo's convention.
import type { CatalogEntry } from "../../../shared/usecaseCatalog";

// Real, routable usecases first (the ones a typed ask can actually reach, ADR 0004) — then the 2
// never-auto-routed demo flows (empty `keywords`) last, each group in its catalog-authored order.
export function categoryCards(catalog: CatalogEntry[]): CatalogEntry[] {
  const routable = catalog.filter((u) => u.keywords.length > 0);
  const demo = catalog.filter((u) => u.keywords.length === 0);
  return [...routable, ...demo];
}
