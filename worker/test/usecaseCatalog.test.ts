import { describe, it, expect } from "vitest";
import { usecaseCatalog, routableUsecases, assertCatalogEntry } from "../../shared/usecaseCatalog";

// The 6 authored usecases/*.json — the single source of truth the UI + Worker both read (018 P4).
const EXPECTED_IDS = [
  "founders-copilot",
  "sort-my-route",
  "sort-my-care",
  "sort-my-wander",
  "sort-my-scam-check",
  "sort-my-food-hygiene",
];

describe("usecaseCatalog", () => {
  it("returns exactly the 6 real usecases, each with non-empty id/title/example/blurb + a keywords array", () => {
    const cat = usecaseCatalog();
    expect(cat.map((c) => c.id).sort()).toEqual([...EXPECTED_IDS].sort());
    for (const c of cat) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.example.length).toBeGreaterThan(0);
      expect(c.blurb.length).toBeGreaterThan(0);
      expect(Array.isArray(c.keywords)).toBe(true); // possibly [] — that IS the never-auto-routed signal
    }
  });

  // 024 P0.3: the Home-screen category card needs a source name + a link to the actual official
  // register, and (where honest) a freshness key into /api/freshness. These are OPTIONAL — absent
  // for the two never-auto-routed demo flows (route, founders), present for the 4 real ones.
  it("carries source/officialLink for the 4 real corpus/scam usecases, absent for route + founders", () => {
    const cat = usecaseCatalog();
    const byId = Object.fromEntries(cat.map((c) => [c.id, c]));
    for (const id of ["sort-my-care", "sort-my-wander", "sort-my-scam-check", "sort-my-food-hygiene"]) {
      const c = byId[id]!;
      expect(c.source, `${id}.source`).toBeTruthy();
      expect(c.officialLink?.text, `${id}.officialLink.text`).toBeTruthy();
      expect(c.officialLink?.url, `${id}.officialLink.url`).toMatch(/^https:\/\//);
    }
    for (const id of ["sort-my-route", "founders-copilot"]) {
      const c = byId[id]!;
      expect(c.source, `${id}.source`).toBeUndefined();
      expect(c.officialLink, `${id}.officialLink`).toBeUndefined();
    }
  });

  it("carries freshnessKey only where a single honest ingest date exists (care, food-hygiene)", () => {
    const cat = usecaseCatalog();
    const byId = Object.fromEntries(cat.map((c) => [c.id, c]));
    expect(byId["sort-my-care"]!.freshnessKey).toBe("care");
    expect(byId["sort-my-food-hygiene"]!.freshnessKey).toBe("food-hygiene");
    // wander unions two sources with no single clean date (registry.ts dateLabel: "omit") — no key.
    expect(byId["sort-my-wander"]!.freshnessKey).toBeUndefined();
    expect(byId["sort-my-scam-check"]!.freshnessKey).toBeUndefined();
  });

  it("flags sampleData only for Scam Check (synthetic bundled sample, no D1 table)", () => {
    const cat = usecaseCatalog();
    const byId = Object.fromEntries(cat.map((c) => [c.id, c]));
    expect(byId["sort-my-scam-check"]!.sampleData).toBe(true);
    for (const id of ["sort-my-care", "sort-my-wander", "sort-my-food-hygiene", "sort-my-route", "founders-copilot"]) {
      expect(byId[id]!.sampleData, `${id}.sampleData`).toBeUndefined();
    }
  });
});

describe("routableUsecases (derived from keywords, never re-declared)", () => {
  it("includes only the keyword-carrying workflows and EXCLUDES route + founders", () => {
    const ids = routableUsecases().map((r) => r.id);
    expect(ids).toContain("sort-my-care");
    expect(ids).toContain("sort-my-wander");
    expect(ids).toContain("sort-my-scam-check");
    expect(ids).toContain("sort-my-food-hygiene");
    expect(ids).not.toContain("sort-my-route");
    expect(ids).not.toContain("founders-copilot");
    for (const r of routableUsecases()) expect(r.keywords.length).toBeGreaterThan(0);
  });
});

describe("assertCatalogEntry", () => {
  const ok = { id: "x", title: "X", example: "e", blurb: "b" };
  it("rejects a missing/empty id", () => {
    expect(() => assertCatalogEntry({ ...ok, id: "" })).toThrow(/id/);
    expect(() => assertCatalogEntry({ ...ok, id: undefined })).toThrow(/id/);
  });
  it("rejects a missing/empty title", () => {
    expect(() => assertCatalogEntry({ ...ok, title: "" })).toThrow(/title/);
  });
  it("rejects a missing/empty example", () => {
    expect(() => assertCatalogEntry({ ...ok, example: "" })).toThrow(/example/);
  });
  it("rejects a missing/empty blurb", () => {
    expect(() => assertCatalogEntry({ ...ok, blurb: "" })).toThrow(/blurb/);
  });
  it("accepts an entry with keywords ABSENT (the never-auto-routed shape)", () => {
    expect(() => assertCatalogEntry(ok)).not.toThrow();
  });
  it("rejects keywords present but not a string array", () => {
    expect(() => assertCatalogEntry({ ...ok, keywords: "gp" })).toThrow(/keywords/);
    expect(() => assertCatalogEntry({ ...ok, keywords: [1, 2] })).toThrow(/keywords/);
  });
  it("tolerates the extra render/stages keys the full usecases/*.json shape carries", () => {
    expect(() => assertCatalogEntry({ ...ok, render: { mode: "route" }, stages: [] })).not.toThrow();
  });

  it("accepts source/officialLink/freshnessKey/sampleData when present and valid", () => {
    expect(() =>
      assertCatalogEntry({
        ...ok,
        source: "Care Quality Commission",
        officialLink: { text: "Search official NHS services", url: "https://www.nhs.uk/service-search" },
        freshnessKey: "care",
        sampleData: false,
      })
    ).not.toThrow();
  });
  it("tolerates all four being absent", () => {
    expect(() => assertCatalogEntry(ok)).not.toThrow();
  });
  it("rejects an empty source", () => {
    expect(() => assertCatalogEntry({ ...ok, source: "" })).toThrow(/source/);
  });
  it("rejects a malformed officialLink", () => {
    expect(() => assertCatalogEntry({ ...ok, officialLink: "https://example.com" })).toThrow(/officialLink/);
    expect(() => assertCatalogEntry({ ...ok, officialLink: { text: "x" } })).toThrow(/officialLink/);
    expect(() => assertCatalogEntry({ ...ok, officialLink: { url: "https://x" } })).toThrow(/officialLink/);
  });
  it("rejects an empty freshnessKey", () => {
    expect(() => assertCatalogEntry({ ...ok, freshnessKey: "" })).toThrow(/freshnessKey/);
  });
  it("rejects a non-boolean sampleData", () => {
    expect(() => assertCatalogEntry({ ...ok, sampleData: "yes" })).toThrow(/sampleData/);
  });
});
