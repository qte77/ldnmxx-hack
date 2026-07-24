import { describe, it, expect } from "vitest";
import { buildNoMatchCards, buildOpportunityCards, withIncorporate } from "../src/a2ui/cards";

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
    const card = comp.component["Card"];
    if (card) {
      expect(typeof card.child).toBe("string");
      if (card.child) expect(ids.has(card.child)).toBe(true);
    }
    const list = comp.component["Column"]?.children?.explicitList;
    if (Array.isArray(list)) for (const id of list) expect(ids.has(id)).toBe(true);
  }
}

function rootList(batch: Batch[]): string[] {
  const update = batch.find((m) => m.surfaceUpdate)?.surfaceUpdate;
  const root = update?.components.find((c) => c.id === "root");
  return root?.component["Column"]?.children?.explicitList ?? [];
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

// 018 P5b: the no-match discovery card offers TWO affordances — a routable workflow invites TYPING (it
// is reachable from the single input), while a never-auto-routed one (founders/route, no keywords) gets
// an "open →" ?usecase= link, NEVER a fake typed keyword that would itself no-match (the SE1 trap).
describe("buildNoMatchCards", () => {
  const routable = {
    id: "sort-my-care",
    title: "Sort My Care",
    keywords: ["gp", "nhs"],
    example: "GP near E8 3GT",
    blurb: "Find NHS and public health services near a postcode.",
  };
  const nonRoutable = {
    id: "founders-copilot",
    title: "Founder's Copilot",
    keywords: [],
    example: "an AI copilot for London founders",
    blurb: "A demo copilot for London startup founders.",
  };

  it("is a self-contained batch: the header + one option per usecase, each showing its blurb", () => {
    const batch = buildNoMatchCards([routable, nonRoutable]) as Batch[];
    assertSelfContained(batch);
    expect(rootList(batch)).toEqual(["card-nomatch", "card-opt-sort-my-care", "card-opt-founders-copilot"]);
    const json = JSON.stringify(batch);
    expect(json).toContain("I didn't understand");
    expect(json).toContain(routable.blurb);
    expect(json).toContain(nonRoutable.blurb);
  });

  it("invites TYPING a routable workflow's own example — and never a ?usecase= bypass link for it", () => {
    const json = JSON.stringify(buildNoMatchCards([routable]));
    expect(json).toContain("GP near E8 3GT");
    expect(json).not.toContain("?usecase=");
  });

  it("offers a never-auto-routed workflow an OPEN ?usecase= link, never its (unroutable) example", () => {
    const json = JSON.stringify(buildNoMatchCards([nonRoutable]));
    expect(json).toContain("?usecase=founders-copilot");
    expect(json).toContain("Open Founder's Copilot");
    // its example must NOT be shown as something to type — typing it would no-match (no keywords).
    expect(json).not.toContain("an AI copilot for London founders");
  });
});
