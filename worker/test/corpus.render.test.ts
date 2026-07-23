import { describe, it, expect } from "vitest";
import { buildCorpusCards } from "../src/corpus/render";
import type { CorpusLabels, CorpusQuery } from "../src/corpus/contract";

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

const labels: CorpusLabels = {
  noun: "service",
  summaryLine: "Nearest public-service signposts",
  officialLink: { text: "Search official NHS services", url: "https://www.nhs.uk/service-search" },
  emptyInvalidHint: "Try a London postcode like SW9 9SL.",
  emptyUnknownHint: "We don't have sample data for that postcode yet — try SW9 9SL, E1 6AN or N1 9GU.",
  attribution: [],
};

const sample: CorpusQuery = {
  query: "SW9 9SL",
  asOf: "2026-05-01",
  labels,
  rows: [
    { id: "gp", title: "Test GP", line: "NHS A · 0.4 km", why: "register", officialUrl: "https://nhs.uk/gp" },
    { id: "ph", title: "Test Pharmacy", line: "NHS B · 1.2 km", why: "advice", officialUrl: "https://nhs.uk/ph" },
  ],
};

describe("buildCorpusCards", () => {
  it("builds a self-contained batch: summary + one card per row + disclaimer", () => {
    const batch = buildCorpusCards(sample) as Batch[];
    assertSelfContained(batch);
    expect(rootList(batch)).toEqual(["card-summary", "card-gp", "card-ph", "card-disclaimer"]);
    const json = JSON.stringify(batch);
    expect(json).toContain("2 services near SW9 9SL");
    expect(json).toContain("Test GP");
    expect(json).toContain("https://nhs.uk/gp");
    expect(json).toContain("data as of 2026-05-01");
  });

  it("renders the row's pre-formatted line verbatim — the render knows nothing about distance", () => {
    expect(JSON.stringify(buildCorpusCards(sample))).toContain("NHS A · 0.4 km");
  });

  it("takes the disclaimer link from the corpus labels, not a hardcoded NHS url", () => {
    const wander: CorpusQuery = {
      ...sample,
      labels: {
        ...labels,
        noun: "place",
        summaryLine: "Nearest free places to explore",
        officialLink: { text: "Historic England", url: "https://historicengland.org.uk/listing" },
      },
    };
    const json = JSON.stringify(buildCorpusCards(wander));
    expect(json).toContain("https://historicengland.org.uk/listing");
    expect(json).not.toContain("nhs.uk/service-search");
    expect(json).toContain("2 places near SW9 9SL");
  });

  it("singularises the noun for a single row", () => {
    const one: CorpusQuery = { ...sample, rows: [sample.rows[0]!] };
    expect(JSON.stringify(buildCorpusCards(one))).toContain("1 service near SW9 9SL");
  });

  it("shows a graceful, still-self-contained prompt (with disclaimer) for an invalid postcode", () => {
    const batch = buildCorpusCards({ query: null, rows: [], asOf: null, labels }) as Batch[];
    assertSelfContained(batch);
    const json = JSON.stringify(batch);
    expect(json).toContain("Enter a valid UK postcode");
    expect(json).toContain("Try a London postcode like SW9 9SL.");
    expect(rootList(batch)).toContain("card-disclaimer");
  });

  // P1 (#182): licence obligations (data/sources.json redistribute_note) render as extra caption
  // lines on the disclaimer card — from the corpus's reviewed labels, never from ingested data.
  it("renders the corpus attribution strings on the disclaimer card", () => {
    const attributed: CorpusQuery = {
      ...sample,
      labels: {
        ...labels,
        attribution: [
          "© Historic England 2026",
          "Contains OS data © Crown copyright and database right 2026",
        ],
      },
    };
    const batch = buildCorpusCards(attributed) as Batch[];
    assertSelfContained(batch);
    const json = JSON.stringify(batch);
    expect(json).toContain("© Historic England 2026");
    expect(json).toContain("Contains OS data © Crown copyright and database right 2026");
    // On the DISCLAIMER card: title + caveat + link + 2 attribution lines.
    const update = batch.find((m) => m.surfaceUpdate)?.surfaceUpdate;
    const body = update?.components.find((c) => c.id === "body-disclaimer");
    expect(body?.component["Column"]?.children?.explicitList).toHaveLength(5);
  });

  it("renders no attribution lines for a sample corpus (empty attribution)", () => {
    const batch = buildCorpusCards(sample) as Batch[];
    const update = batch.find((m) => m.surfaceUpdate)?.surfaceUpdate;
    const body = update?.components.find((c) => c.id === "body-disclaimer");
    expect(body?.component["Column"]?.children?.explicitList).toHaveLength(3);
  });

  it("shows a 'none nearby' state (postcode kept) when the query returned no rows", () => {
    const batch = buildCorpusCards({ query: "N1 9GU", rows: [], asOf: null, labels }) as Batch[];
    assertSelfContained(batch);
    const json = JSON.stringify(batch);
    expect(json).toContain("No sample services near N1 9GU");
    expect(json).toContain("We don't have sample data for that postcode yet");
  });
});
