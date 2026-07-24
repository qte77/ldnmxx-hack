// The forced `route_query` tool schema + a dependency-free validator for its structured output. Shared
// (repo-root, no deps) like assessTool.ts / searchTool.ts, so any model path validates identically. The
// model picks the single best civic workflow for a free-text ask, or the "none" sentinel when nothing
// fits — the validator rejects any id outside the allowed set, mirroring searchTool's invented-id guard,
// so the router can NEVER route to a workflow the caller didn't offer (e.g. sort-my-route / founders).

// The sentinel the model returns when no workflow genuinely fits → the caller renders the no-match card.
export const ROUTE_NONE = "none";

export const ROUTE_TOOL = {
  type: "function",
  function: {
    name: "route_query",
    description:
      "Choose the single civic workflow that best matches the user's request from the provided list, or 'none' if none genuinely fits. Never guess — prefer 'none' over a weak match.",
    parameters: {
      type: "object",
      properties: {
        reasoning: { type: "string", description: "One sentence explaining the choice." },
        usecase: {
          type: "string",
          description: "The chosen workflow id, copied VERBATIM from the list, or 'none'.",
        },
      },
      required: ["reasoning", "usecase"],
    },
  },
};

export interface RouteResult {
  reasoning: string;
  usecase: string;
}

// Structural guard: reasoning + a usecase that is either the "none" sentinel or one of the allowed ids
// (rejects an invented / never-auto-routed id). Reject anything else so the caller renders the no-match
// card rather than a fabricated route. Reads every field as `unknown` — casting to Partial<RouteResult>
// would assert the very shapes this verifies (see assessTool.ts).
export function isValidRouteResult(value: unknown, allowedIds: readonly string[]): value is RouteResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v["reasoning"] !== "string" || typeof v["usecase"] !== "string") return false;
  return v["usecase"] === ROUTE_NONE || allowedIds.includes(v["usecase"]);
}
