// Server-side render-stage model call: the model emits the A2UI card batch via a forced `render_ui`
// tool, grounded in the provided data. Hand-rolled OpenAI-compatible fetch (no SDK) to stay light on
// Workers. Returns a validated batch + usage, or null on ANY failure so the caller falls back to the
// deterministic stub — the demo can never break.

export interface ModelCall {
  apiKey: string;
  model: string;
  baseURL: string; // OpenAI-compatible base, e.g. https://openrouter.ai/api/v1
  system: string;
  user: string;
  signal?: AbortSignal;
}
export interface ModelResult {
  batch: unknown[];
  model: string;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

interface ORResponse {
  choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

const RENDER_UI_TOOL = {
  type: "function",
  function: {
    name: "render_ui",
    description:
      "Draw the on-screen UI by emitting a batch of A2UI messages on the 'main' surface.",
    parameters: {
      type: "object",
      properties: { messages: { type: "array", items: { type: "object" } } },
      required: ["messages"],
    },
  },
};

// Pull the render_ui batch out of an OpenAI-compatible tool-call response. Null if absent/malformed.
export function extractBatch(data: ORResponse): unknown[] | null {
  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call || call.name !== "render_ui" || typeof call.arguments !== "string") return null;
  try {
    const args = JSON.parse(call.arguments) as { messages?: unknown };
    return Array.isArray(args.messages) ? args.messages : null;
  } catch {
    return null;
  }
}

// Structural self-containment guard (the UI's contract.ts re-checks, but reject a bad model batch here
// so we fall back to the stub instead of surfacing a HUD error): root defined, every referenced child
// id defined. Mirrors worker/test's assertSelfContained.
export function isValidBatch(batch: unknown): batch is unknown[] {
  if (!Array.isArray(batch)) return false;
  let root: string | undefined;
  const ids = new Set<string>();
  const refs: string[] = [];
  for (const msg of batch) {
    const m = msg as {
      beginRendering?: { root?: unknown };
      surfaceUpdate?: { components?: unknown };
    };
    if (typeof m.beginRendering?.root === "string") root = m.beginRendering.root;
    const comps = m.surfaceUpdate?.components;
    if (!Array.isArray(comps)) continue;
    for (const comp of comps) {
      const c = comp as {
        id?: unknown;
        component?: Record<string, { child?: unknown; children?: { explicitList?: unknown } }>;
      };
      if (typeof c.id === "string") ids.add(c.id);
      if (!c.component) continue;
      const props = Object.values(c.component)[0];
      const card = c.component.Card;
      if (card && typeof card.child === "string") refs.push(card.child);
      const list = props?.children?.explicitList;
      if (Array.isArray(list)) for (const x of list) if (typeof x === "string") refs.push(x);
    }
  }
  if (!root || !ids.has(root)) return false;
  return refs.every((r) => ids.has(r));
}

export async function callRenderModel(opts: ModelCall): Promise<ModelResult | null> {
  try {
    const res = await fetch(`${opts.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        "content-type": "application/json",
        "x-title": "Groundwork",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        tools: [RENDER_UI_TOOL],
        tool_choice: { type: "function", function: { name: "render_ui" } },
        temperature: 0.2,
        max_tokens: 1500,
      }),
      signal: opts.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ORResponse;
    const batch = extractBatch(data);
    if (!batch || !isValidBatch(batch)) return null;
    return {
      batch,
      model: opts.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  } catch {
    return null; // network error, timeout (AbortSignal), bad JSON — caller uses the stub
  }
}

// A2UI catalog-authoring rules (condensed from the agenthud SYSTEM_PROMPT — the proven shape).
export const A2UI_RULES = `Answer by calling the \`render_ui\` tool to draw the UI on the "main" surface — never prose. Make exactly ONE render_ui call with the COMPLETE interface.

An A2UI batch is an array of messages:
- { "beginRendering": { "surfaceId": "main", "root": "root" } }   (send first; "root" = id of your TOP component)
- { "surfaceUpdate": { "surfaceId": "main", "components": [ ...Component ] } }
A Component is { "id": string, "component": { <Type>: <props> } } with exactly one Type. Exactly ONE component must have id "root".
Shapes: Text { "Text": { "text": { "literalString": "Hi" }, "usageHint": "h3|body|caption" } } · Card { "Card": { "child": "id" } } (ONE child id) · Column { "Column": { "children": { "explicitList": ["id1","id2"] } } }.
Values are TYPED literals: { "literalString": "..." }. RULES: define EVERY id you reference in the same call (no dangling refs); the tree must be ACYCLIC; never leave an explicitList empty. Use Column, not List.`;
