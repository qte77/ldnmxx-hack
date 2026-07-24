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
});
