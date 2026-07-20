import { describe, it, expect } from "vitest";
import { queryCorpus, queryCorpusDef } from "../src/corpus/query";
import type { CorpusDef } from "../src/corpus/registry";
import type { CorpusRecord } from "../src/corpus/contract";
import type { Coords } from "../src/geo";

const records: CorpusRecord[] = [
  { id: "near", name: "Near GP", authority: "NHS A", why: "register", officialUrl: "https://nhs.uk/near", lat: 51.501, lng: -0.14, lastUpdated: "2026-06-01" },
  { id: "mid", name: "Mid Pharmacy", authority: "NHS B", why: "advice", officialUrl: "https://nhs.uk/mid", lat: 51.52, lng: -0.12, lastUpdated: "2026-05-01" },
  { id: "far", name: "Far Dentist", authority: "NHS C", why: "checkup", officialUrl: "https://nhs.uk/far", lat: 51.6, lng: -0.3, lastUpdated: "2026-04-01" },
];
const postcodes: Record<string, Coords> = { "SW1A 1AA": { lat: 51.501, lng: -0.141 } };
const def: CorpusDef = {
  records,
  postcodes,
  labels: {
    noun: "service",
    summaryLine: "Nearest public-service signposts",
    officialLink: { text: "Search official NHS services", url: "https://www.nhs.uk/service-search" },
    emptyInvalidHint: "Try a London postcode like SW9 9SL.",
    emptyUnknownHint: "We don't have sample data for that postcode yet.",
  },
};

describe("queryCorpusDef", () => {
  it("returns the nearest-N rows, sorted, in the generic row shape", () => {
    const q = queryCorpusDef(def, "SW1A 1AA", 2);
    expect(q.query).toBe("SW1A 1AA");
    expect(q.rows.map((r) => r.id)).toEqual(["near", "mid"]);
    // The render must know nothing about distance/coords — a row carries only pre-formatted display data.
    expect(Object.keys(q.rows[0]!).sort()).toEqual(["id", "line", "officialUrl", "title", "why"].sort());
  });

  it("pre-formats the retrieval-specific secondary line (authority + rounded distance)", () => {
    const q = queryCorpusDef(def, "SW1A 1AA", 1);
    expect(q.rows[0]!.line).toMatch(/^NHS A · \d+(\.\d)? km$/);
  });

  it("advertises the OLDEST lastUpdated as asOf (conservative freshness)", () => {
    const q = queryCorpusDef(def, "SW1A 1AA", 3);
    expect(q.asOf).toBe("2026-04-01");
  });

  it("extracts the postcode from a longer prompt", () => {
    const q = queryCorpusDef(def, "services near SW1A 1AA thanks", 1);
    expect(q.query).toBe("SW1A 1AA");
    expect(q.rows).toHaveLength(1);
  });

  it("returns a null-query empty result for an invalid postcode (graceful, no throw)", () => {
    const q = queryCorpusDef(def, "not a postcode");
    expect(q.query).toBeNull();
    expect(q.rows).toEqual([]);
    expect(q.asOf).toBeNull();
  });

  it("keeps the postcode but returns no rows for a valid-but-unknown postcode", () => {
    const q = queryCorpusDef(def, "N1 9GU");
    expect(q.query).toBe("N1 9GU");
    expect(q.rows).toEqual([]);
  });

  it("always carries the corpus labels through to the render", () => {
    expect(queryCorpusDef(def, "nonsense").labels).toEqual(def.labels);
  });
});

describe("queryCorpus (async seam over the registry)", () => {
  it("resolves a registered corpus by id and wires up against the bundled data", async () => {
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "care" });
    expect(q.query).toBe("SW9 9SL");
    expect(q.rows.length).toBeGreaterThan(0);
    expect(q.rows.length).toBeLessThanOrEqual(3);
    expect(typeof q.rows[0]!.line).toBe("string");
  });

  it("rejects an unregistered corpus id (unreachable via the load guard — fail loud, not silently empty)", async () => {
    await expect(queryCorpus({ prompt: "SW9 9SL", corpus: "nope" })).rejects.toThrow(/nope/);
  });

  it("rejects a missing corpus id", async () => {
    await expect(queryCorpus({ prompt: "SW9 9SL" })).rejects.toThrow();
  });
});
