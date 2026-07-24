// Query-driven auto-router (017 P2, ADR 0004): pick the civic workflow that matches a free-text ask.
// Hybrid + keyless-first — a pure keyword heuristic decides the common cases with NO model call; only a
// genuinely unsure ask escalates to the free chain. No silent default: an unconfident result is `null`,
// which the caller renders as the no-match card (never a fabricated route).
//
// Register-only (ADR 0001): the routable catalog is DATA read from the usecase registry
// (routableUsecases()) — this module hard-codes no ids. A workflow with no keywords (sort-my-route,
// founders-copilot) is absent from the catalog and therefore can never be auto-routed.

import { normalisePostcode } from "../../../shared/sanitize";
import { detectInjection } from "../../../shared/guard";
import { ROUTE_TOOL, ROUTE_NONE, isValidRouteResult, type RouteResult } from "../../../shared/routerTool";
import { CLASSIFY_SYSTEM, classifyUser } from "../../../shared/prompt";
import { extractToolArgs, type ToolSpec } from "./model";
import { runChain, type Provider } from "./providers";

// One routable workflow: its id, its human title, and the keyword set that routes to it. Structurally
// what routableUsecases() yields — kept as a local shape so this module never imports the registry.
export interface Routable {
  id: string;
  title: string;
  keywords: string[];
}

export type RouteSource = "heuristic" | "model" | "none";

// Keyless, pure, deterministic. Score each workflow by how many of its keywords appear (case-insensitive
// substring) in the ask; the unique top scorer wins. Zero hits, or a tie between workflows, returns null
// — an honestly ambiguous ask escalates to the model rather than guessing. normalisePostcode is NOT used
// to decide the id here (a bare postcode fits care/wander/food-hygiene equally); it informs the model
// escalation instead (classifyUser).
export function classifyHeuristic(prompt: string, routables: Routable[]): string | null {
  const text = prompt.toLowerCase();
  let bestId: string | null = null;
  let bestScore = 0;
  let tie = false;
  for (const u of routables) {
    const score = u.keywords.reduce((n, k) => (text.includes(k.toLowerCase()) ? n + 1 : n), 0);
    if (score > bestScore) {
      bestScore = score;
      bestId = u.id;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  return bestScore > 0 && !tie ? bestId : null;
}

// The hybrid decision. Heuristic first (keyless); on a miss, escalate to the model ONLY when there is a
// provider chain to call AND the text is not a flagged injection — the router gates user text through
// detectInjection before any model call (mirrors resolveRun), so a jailbreak ask never reaches a model.
// The model must return an allowed id or "none" (routerTool validator), so it can never invent a route.
export async function classifyUsecase(
  prompt: string,
  providers: Provider[],
  routables: Routable[],
  signal?: AbortSignal,
): Promise<{ id: string | null; source: RouteSource }> {
  const heuristic = classifyHeuristic(prompt, routables);
  if (heuristic !== null) return { id: heuristic, source: "heuristic" };

  if (providers.length === 0 || detectInjection(prompt).flagged) return { id: null, source: "none" };

  const allowedIds = routables.map((u) => u.id);
  const spec: ToolSpec<RouteResult> = {
    tool: ROUTE_TOOL,
    toolName: "route_query",
    extract: (d) => extractToolArgs(d, "route_query") as RouteResult | null,
    validate: (v) => isValidRouteResult(v, allowedIds),
  };
  const hasPostcode = normalisePostcode(prompt) !== null;
  const r = await runChain(providers, (p) =>
    p.tryCall(spec, { system: CLASSIFY_SYSTEM, user: classifyUser(prompt, routables, hasPostcode), signal }),
  );
  if (!r || r.result.value.usecase === ROUTE_NONE) return { id: null, source: "none" };
  return { id: r.result.value.usecase, source: "model" };
}
