// A live A2UI catalog: a self-contained v0_8 batch that renders one ACTUAL example of each core
// component type on the surface — so you see the real renderer output, not just a list of names.
// Same shape rules as the worker's cards.ts (root Column, typed literals, acyclic, every id defined).

interface Component {
  id: string;
  component: unknown;
}

const cmp = (id: string, component: unknown): Component => ({ id, component });
const text = (id: string, s: string, usageHint: string): Component =>
  cmp(id, { Text: { text: { literalString: s }, usageHint } });

export function buildCatalogBatch(): unknown[] {
  const components: Component[] = [
    text("cat-title", "A2UI standard catalog — rendered live", "h2"),
    cmp("cat-d0", { Divider: {} }),

    text("cat-l-text", "Text — usageHint h1 / h3 / body / caption", "caption"),
    text("cat-t-h1", "Heading (h1)", "h1"),
    text("cat-t-h3", "Heading (h3)", "h3"),
    text("cat-t-body", "Body — the default prose size.", "body"),
    text("cat-t-cap", "Caption — small, muted.", "caption"),
    cmp("cat-text-col", {
      Column: { children: { explicitList: ["cat-t-h1", "cat-t-h3", "cat-t-body", "cat-t-cap"] } },
    }),

    text("cat-l-card", "Card — elevated container with one child", "caption"),
    text("cat-card-body", "I'm the single child of a Card.", "body"),
    cmp("cat-card", { Card: { child: "cat-card-body" } }),

    text("cat-l-row", "Row — horizontal layout", "caption"),
    text("cat-row-a", "Row · A", "body"),
    text("cat-row-b", "Row · B", "body"),
    cmp("cat-row", { Row: { children: { explicitList: ["cat-row-a", "cat-row-b"] } } }),

    text("cat-l-btn", "Button — action trigger (label child)", "caption"),
    text("cat-btn-label", "Click me", "body"),
    cmp("cat-button", { Button: { child: "cat-btn-label", action: { name: "noop" } } }),

    text("cat-l-ctrl", "CheckBox · Slider", "caption"),
    cmp("cat-check", { CheckBox: { label: { literalString: "Agree" }, value: { literalBoolean: true } } }),
    cmp("cat-slider", { Slider: { value: { literalNumber: 5 }, minValue: 0, maxValue: 10 } }),
    cmp("cat-ctrl", { Column: { children: { explicitList: ["cat-check", "cat-slider"] } } }),

    cmp("cat-d1", { Divider: {} }),
  ];
  const rootChildren = [
    "cat-title", "cat-d0",
    "cat-l-text", "cat-text-col",
    "cat-l-card", "cat-card",
    "cat-l-row", "cat-row",
    "cat-l-btn", "cat-button",
    "cat-l-ctrl", "cat-ctrl",
    "cat-d1",
  ];
  return [
    { beginRendering: { surfaceId: "main", root: "cat-root" } },
    {
      surfaceUpdate: {
        surfaceId: "main",
        components: [
          cmp("cat-root", { Column: { children: { explicitList: rootChildren } } }),
          ...components,
        ],
      },
    },
  ];
}
