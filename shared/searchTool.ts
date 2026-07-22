// The forced `search_opportunities` tool schema + a dependency-free validator for its structured output.
// Shared (repo-root, no deps) like renderTool.ts. The model ranks/filters/explains over the candidate
// corpus and returns ONLY ids drawn from it — the validator rejects invented ids so the downstream render
// stays grounded in real opportunities. Its `reasoning` streams to the HUD as one message.

export interface OpportunityMatch {
  id: string;
  score: number;
  whyItFits: string;
  stageFit?: string;
}
export interface SearchResult {
  reasoning: string;
  matches: OpportunityMatch[];
}

export const SEARCH_OPPORTUNITIES_TOOL = {
  type: "function",
  function: {
    name: "search_opportunities",
    description:
      "Rank and explain which of the PROVIDED candidate opportunities best match the idea. Use ONLY the given ids — never invent one; omit any that don't fit.",
    parameters: {
      type: "object",
      properties: {
        reasoning: { type: "string", description: "One or two sentences: how you ranked and filtered." },
        matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "An id copied verbatim from a provided candidate." },
              score: { type: "number", description: "0-100 fit score for THIS idea." },
              whyItFits: { type: "string" },
              stageFit: { type: "string", description: "How it fits the founder's assessed stage." },
            },
            required: ["id", "score", "whyItFits"],
          },
        },
      },
      required: ["reasoning", "matches"],
    },
  },
};

// Structural guard: reasoning + a NON-EMPTY matches array whose every id is in the candidate set (rejects
// invented ids), each with a numeric score + a whyItFits string. An empty/invalid result falls back to the
// canned pre-scored cards (never worse than today).
// Narrow to unknown[], not the any[] Array.isArray infers (which would defeat the type-safety lints).
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

export function isValidSearchResult(value: unknown, allowedIds: readonly string[]): value is SearchResult {
  // Narrow to a plain object, then read every property as `unknown` — see assessTool.ts for why
  // casting to Partial<SearchResult> here would be circular.
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v["reasoning"] !== "string" || !isArray(v["matches"]) || v["matches"].length === 0) {
    return false;
  }
  const allowed = new Set(allowedIds);
  return v["matches"].every((m) => {
    // Each element is untrusted too: a null/primitive here used to throw on `.id` rather than
    // reject, because the Partial<OpportunityMatch> cast asserted it could never be null.
    if (typeof m !== "object" || m === null) return false;
    const mm = m as Record<string, unknown>;
    return (
      typeof mm["id"] === "string" &&
      allowed.has(mm["id"]) &&
      typeof mm["score"] === "number" &&
      typeof mm["whyItFits"] === "string" &&
      (mm["stageFit"] === undefined || typeof mm["stageFit"] === "string")
    );
  });
}
