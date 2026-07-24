// 018 P4: the ONE shared usecase catalog. The 6 usecases/*.json files are the single authored source of
// truth for every workflow's id/title/example/blurb (+ optional router keywords); this module loads +
// validates them and derives the views BOTH the Worker (routableUsecases/usecaseCatalog, re-exported
// from worker/src/usecases.ts) and the SPA (ui/src/App.tsx) consume — no second, drifting UI copy.
//
// Dependency-free + repo-root, like shared/sanitize.ts, so the browser bundle never pulls in worker-only
// modules (the corpus registry etc.). The 6-file list is wired HERE rather than derived from the worker
// registry precisely to keep that import direction one-way (shared/ must never import worker/).
import founders from "../usecases/founders-copilot.json";
import route from "../usecases/sort-my-route.json";
import care from "../usecases/sort-my-care.json";
import wander from "../usecases/sort-my-wander.json";
import scam from "../usecases/sort-my-scam-check.json";
import foodHygiene from "../usecases/sort-my-food-hygiene.json";

// The normalised catalog entry. `keywords` is always an array ([] when the source omits it — that
// absence IS the never-auto-routed signal for sort-my-route / founders-copilot). The source files also
// carry render/stages/exec, which this catalog neither reads nor validates (that stays
// worker/src/usecases.ts's assertUsecaseDef's job).
export interface CatalogEntry {
  id: string;
  title: string;
  keywords: string[];
  example: string;
  blurb: string;
}
export type Routable = Pick<CatalogEntry, "id" | "title" | "keywords">;

// Validate ONLY the 5 fields this catalog owns (throws on any bad one). Extras (render/stages) are
// ignored by construction, so this composes with the full usecases/*.json shape with no duplicate
// "reject unknown keys" pass. Exported for direct unit testing.
function requireNonEmptyString(label: string, val: unknown): string {
  if (typeof val !== "string" || val.length === 0) throw new Error(`${label} must be a non-empty string`);
  return val;
}

export function assertCatalogEntry(x: unknown): void {
  if (typeof x !== "object" || x === null) throw new Error("catalog entry: must be an object");
  const d = x as Record<string, unknown>;
  const id = requireNonEmptyString("catalog entry: id", d["id"]);
  requireNonEmptyString(`catalog ${id}: title`, d["title"]);
  const keywords = d["keywords"];
  if (keywords !== undefined && (!Array.isArray(keywords) || !keywords.every((k) => typeof k === "string"))) {
    throw new Error(`catalog ${id}: keywords must be a string array when present`);
  }
  requireNonEmptyString(`catalog ${id}: example`, d["example"]);
  requireNonEmptyString(`catalog ${id}: blurb`, d["blurb"]);
}

function load(raw: unknown): CatalogEntry {
  assertCatalogEntry(raw);
  const d = raw as Record<string, unknown>;
  const kw = d["keywords"];
  return {
    id: d["id"] as string,
    title: d["title"] as string,
    keywords: Array.isArray(kw) ? (kw as string[]) : [],
    example: d["example"] as string,
    blurb: d["blurb"] as string,
  };
}

const CATALOG: CatalogEntry[] = [founders, route, care, wander, scam, foodHygiene].map(load);

export function usecaseCatalog(): CatalogEntry[] {
  return CATALOG;
}

// routable = keywords present — DERIVED, never re-declared by a caller. sort-my-route / founders-copilot
// carry no keywords, so they are absent here and can never be auto-routed (ADR 0004: reachability is DATA).
export function routableUsecases(): Routable[] {
  return CATALOG.filter((u) => u.keywords.length > 0).map(({ id, title, keywords }) => ({ id, title, keywords }));
}
