import { describe, it, expect } from "vitest";
import { buildOpportunityCards, withIncorporate } from "../src/a2ui/cards";

interface Component {
  id: string;
  component: Record<string, { child?: string; children?: { explicitList?: string[] } }>;
}
interface Batch {
  beginRendering?: { surfaceId: string; root: string };
  surfaceUpdate?: { surfaceId: string; components: Component[] };
}

// The verified how-to-pack links (curated, never LLM-generated) that MUST survive any refactor.
const VERIFIED_URLS = [
  "https://find-and-update.company-information.service.gov.uk",
  "https://resources.companieshouse.gov.uk/sic/",
  "https://identity.company-information.service.gov.uk",
  "https://www.gov.uk/limited-company-formation/register-your-company",
  "https://www.gov.uk/set-up-limited-company",
];

// Structural self-containment check (same shape as run.test.ts): root defined, Card.child a defined
// string, every explicitList id defined.
function assertSelfContained(batch: Batch[]): void {
  const begin = batch.find((m) => m.beginRendering)?.beginRendering;
  const update = batch.find((m) => m.surfaceUpdate)?.surfaceUpdate;
  expect(begin).toBeTruthy();
  expect(update).toBeTruthy();
  if (!begin || !update) return;
  const ids = new Set(update.components.map((c) => c.id));
  expect(ids.has(begin.root)).toBe(true);
  for (const comp of update.components) {
    const card = comp.component.Card;
    if (card) {
      expect(typeof card.child).toBe("string");
      if (card.child) expect(ids.has(card.child)).toBe(true);
    }
    const list = comp.component.Column?.children?.explicitList;
    if (Array.isArray(list)) for (const id of list) expect(ids.has(id)).toBe(true);
  }
}

function rootList(batch: Batch[]): string[] {
  const update = batch.find((m) => m.surfaceUpdate)?.surfaceUpdate;
  const root = update?.components.find((c) => c.id === "root");
  return root?.component.Column?.children?.explicitList ?? [];
}

describe("withIncorporate", () => {
  it("appends a self-contained incorporate card with all five verified links (stub path)", () => {
    const batch = withIncorporate(buildOpportunityCards()) as Batch[];
    assertSelfContained(batch);
    expect(rootList(batch)).toContain("card-incorporate");
    const json = JSON.stringify(batch);
    for (const url of VERIFIED_URLS) expect(json).toContain(url);
    expect(json).toContain("Ready to incorporate");
  });

  it("appends incorporate to a model-shaped batch (root Column + one card)", () => {
    const modelBatch: Batch[] = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "root", component: { Column: { children: { explicitList: ["card-x"] } } } },
            { id: "card-x", component: { Card: { child: "body-x" } } },
            { id: "body-x", component: { Column: { children: { explicitList: ["t-x"] } } } },
            { id: "t-x", component: { Text: {} } },
          ],
        },
      },
    ];
    const out = withIncorporate(modelBatch) as Batch[];
    assertSelfContained(out);
    expect(rootList(out)).toEqual(["card-x", "card-incorporate"]);
    const json = JSON.stringify(out);
    for (const url of VERIFIED_URLS) expect(json).toContain(url);
  });

  it("leaves the batch unchanged when the root is not a Column list (guard)", () => {
    const oddBatch: Batch[] = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "root", component: { Card: { child: "t" } } },
            { id: "t", component: { Text: {} } },
          ],
        },
      },
    ];
    const before = JSON.stringify(oddBatch);
    const out = withIncorporate(oddBatch);
    expect(JSON.stringify(out)).toBe(before);
  });
});
