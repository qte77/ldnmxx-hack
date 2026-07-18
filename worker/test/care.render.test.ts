import { describe, it, expect } from "vitest";
import { buildCareCards } from "../src/care/render";
import type { CareQuery } from "../src/care/contract";

interface Component {
  id: string;
  component: Record<string, { child?: string; children?: { explicitList?: string[] } }>;
}
interface Batch {
  beginRendering?: { surfaceId: string; root: string };
  surfaceUpdate?: { surfaceId: string; components: Component[] };
}

// Same structural self-containment check as run.test.ts / cards.test.ts.
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

const sample: CareQuery = {
  postcode: "SW9 9SL",
  services: [
    { id: "gp", name: "Test GP", why: "register", officialUrl: "https://nhs.uk/gp", authority: "NHS A", distanceKm: 0.4, lastUpdated: "2026-06-01" },
    { id: "ph", name: "Test Pharmacy", why: "advice", officialUrl: "https://nhs.uk/ph", authority: "NHS B", distanceKm: 1.2, lastUpdated: "2026-05-01" },
  ],
};

describe("buildCareCards", () => {
  it("builds a self-contained batch: summary + one card per service + disclaimer", () => {
    const batch = buildCareCards(sample) as Batch[];
    assertSelfContained(batch);
    const list = rootList(batch);
    expect(list).toEqual(["card-summary", "card-gp", "card-ph", "card-disclaimer"]);
    const json = JSON.stringify(batch);
    expect(json).toContain("Test GP");
    expect(json).toContain("https://nhs.uk/gp");
    expect(json).toContain("data as of 2026-05-01"); // oldest lastUpdated = conservative freshness
    expect(json).toContain("https://www.nhs.uk/service-search"); // curated disclaimer link
  });

  it("shows a graceful, still-self-contained prompt (with disclaimer) for an invalid postcode", () => {
    const batch = buildCareCards({ postcode: null, services: [] }) as Batch[];
    assertSelfContained(batch);
    expect(JSON.stringify(batch)).toContain("Enter a valid UK postcode");
    expect(rootList(batch)).toContain("card-disclaimer");
  });

  it("shows a 'none nearby' state (postcode kept) when the query returned no services", () => {
    const batch = buildCareCards({ postcode: "N1 9GU", services: [] }) as Batch[];
    assertSelfContained(batch);
    expect(JSON.stringify(batch)).toContain("No sample services near N1 9GU");
  });
});
