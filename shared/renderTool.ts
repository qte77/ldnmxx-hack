// The forced `render_ui` tool schema + a dependency-free structural validator for the A2UI batch the
// model returns. Shared by the Worker model call and (PR-4) the browser-BYOK path. Plain TS — no zod.
// The validator is the safety invariant: reject a malformed batch here so callers fall back to the
// deterministic stub instead of surfacing a broken UI.

export const RENDER_UI_TOOL = {
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

// Structural self-containment guard: root defined + in ids, every referenced child id (Card.child +
// Column explicitList) defined. Mirrors worker/test's assertSelfContained and ui/'s contract re-check.
export function isSelfContainedBatch(batch: unknown): batch is unknown[] {
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
