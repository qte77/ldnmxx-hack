// The MCP tool catalog (ADR 0007): one tool per real, deterministic, corpus/scam-backed usecase.
// The filter is mechanical, not hand-listed — `keywords.length > 0` is the same "auto-routable"
// predicate `shared/usecaseCatalog.ts`'s `routableUsecases()` and `ui/src/screens/Home.tsx`'s
// `ROUTABLE` const already use, which happens to be exactly the "real, not-demo" set too:
// sort-my-route / founders-copilot carry no keywords and never appear here.
import { usecaseCatalog } from "../usecases";

export interface McpToolInputSchema {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
  additionalProperties: false;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

// Curated per-tool input guidance — like CorpusLabels, reviewed TS, never derived from casually
// authored catalog copy, since an MCP client needs input-SHAPE guidance the human-facing blurb
// doesn't carry (e.g. the scam-check tool takes a firm name/FRN, not a location).
const PROMPT_HINTS: Record<string, string> = {
  "sort-my-care": "A UK postcode or London place name (e.g. 'SW9 9SL' or 'Camden') to find nearby NHS/care services.",
  "sort-my-wander": "A UK postcode or London place name to find nearby parks, green spaces, and heritage sites.",
  "sort-my-food-hygiene": "A UK postcode or London place name to find nearby food hygiene ratings.",
  "sort-my-scam-check": "A firm name, FCA reference number (FRN), or Companies House number to check against the FCA register.",
};

// Tool names are snake_case, mechanically derived from the usecase id (no hand-maintained id list).
export function toolName(id: string): string {
  return id.replaceAll("-", "_");
}

export function usecaseIdForTool(name: string): string {
  return name.replaceAll("_", "-");
}

export function mcpTools(): McpTool[] {
  return usecaseCatalog()
    .filter((u) => u.keywords.length > 0)
    .map((u) => ({
      name: toolName(u.id),
      description: u.blurb,
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: PROMPT_HINTS[u.id] ?? u.example },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
    }));
}
