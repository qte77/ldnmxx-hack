import { describe, it, expect } from "vitest";
import { queryCorpus, queryCorpusDef } from "../src/corpus/query";
import { getCorpus, type CorpusDef } from "../src/corpus/registry";
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
    attribution: [],
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

// --- W6 (#13, ADR 0002): the D1-backed corpus source ---------------------------------------------

// Minimal D1 stub routed by METHOD shape, not SQL: the origin lookup goes .bind().first(), the
// seeded-probe goes .first() unbound, the view read goes .all(). The unknown-cast is test
// scaffolding only, never production narrowing.
interface StubStmt {
  bind: () => { first: () => Promise<unknown> };
  first: () => Promise<unknown>;
  all: () => Promise<unknown>;
}

function stubDb(opts: {
  origin?: { lat: number; lng: number } | null;
  rows?: unknown[];
  fail?: boolean;
  gazetteerEmpty?: boolean;
}): D1Database {
  const down = (): Promise<never> => Promise.reject(new Error("d1 down"));
  const stmt: StubStmt = {
    bind: () => ({
      first: () => (opts.fail ? down() : Promise.resolve(opts.origin ?? null)),
    }),
    first: () =>
      opts.fail
        ? down()
        : Promise.resolve(opts.gazetteerEmpty ? null : { postcode: "probe" }),
    all: () => (opts.fail ? down() : Promise.resolve({ results: opts.rows ?? [] })),
  };
  return { prepare: () => stmt } as unknown as D1Database;
}

const d1Row = {
  id: "d1-near",
  name: "D1 GP",
  authority: "NHS D1",
  why: "register",
  officialUrl: "https://nhs.uk/d1",
  lastUpdated: "2026-07-01",
  lat: 51.5,
  lng: -0.1,
};

describe("queryCorpus over a D1 source (care carries a d1View)", () => {
  it("reads rows from D1 when ctx.db is bound", async () => {
    const db = stubDb({ origin: { lat: 51.5, lng: -0.1 }, rows: [d1Row] });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "care" }, { db });
    expect(q.rows.map((r) => r.id)).toEqual(["d1-near"]);
  });

  it("keeps the postcode but returns no rows when the D1 gazetteer misses", async () => {
    const db = stubDb({ origin: null, rows: [d1Row] });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "care" }, { db });
    expect(q.query).toBe("SW9 9SL");
    expect(q.rows).toEqual([]);
  });

  it("filters malformed D1 rows instead of throwing (frozen-contract guard)", async () => {
    const db = stubDb({
      origin: { lat: 51.5, lng: -0.1 },
      rows: [{ ...d1Row, id: "d1-bad", lat: "oops" }, d1Row],
    });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "care" }, { db });
    expect(q.rows.map((r) => r.id)).toEqual(["d1-near"]);
  });

  it("falls back to the bundled sample when the gazetteer is EMPTY (provisioned before seeded)", async () => {
    const db = stubDb({ origin: null, rows: [d1Row], gazetteerEmpty: true });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "care" }, { db });
    expect(q.rows.length).toBeGreaterThan(0);
    expect(q.rows.some((r) => r.id === "d1-near")).toBe(false);
  });

  it("falls back to the bundled sample when the VIEW is empty (gazetteer seeded, corpus not yet swapped)", async () => {
    // P1 (#182): the cron seeds the gazetteer before any corpus swaps in. The swap gate refuses
    // <50 rows, so a live view is never legitimately empty — empty view ⇔ unswapped corpus ⇒ bundled.
    const db = stubDb({ origin: { lat: 51.5, lng: -0.1 }, rows: [] });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "care" }, { db });
    expect(q.rows.length).toBeGreaterThan(0);
    expect(q.rows.some((r) => r.id === "d1-near")).toBe(false);
  });

  it("falls back to the bundled sample when D1 errors (an outage never breaks Care)", async () => {
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "care" }, { db: stubDb({ fail: true }) });
    expect(q.rows.length).toBeGreaterThan(0);
    expect(q.rows.some((r) => r.id === "d1-near")).toBe(false);
  });

  it("wander reads D1 when ctx.db is bound (P2 #182 — real NHLE/greenspace via wander_places)", async () => {
    // P2 flips wander to d1View; the no-d1View branch in queryCorpus stays as a guard for future
    // bundled-only corpora (its live representative left with this flip).
    const db = stubDb({ origin: { lat: 51.5, lng: -0.1 }, rows: [d1Row] });
    const q = await queryCorpus({ prompt: "SW9 9SL", corpus: "wander" }, { db });
    expect(q.rows.map((r) => r.id)).toEqual(["d1-near"]);
  });

  it("wander registry carries non-empty attribution (the licence swap-gate precondition)", () => {
    const labels = getCorpus("wander")?.labels;
    expect(labels?.attribution.length).toBeGreaterThan(0);
    const joined = (labels?.attribution ?? []).join(" ");
    expect(joined).toContain("Historic England");
    expect(joined).toContain("Crown copyright");
  });

  it("care registry carries the CQC attribution + coverage-honest empty hint (P3 #182)", () => {
    const labels = getCorpus("care")?.labels;
    const joined = (labels?.attribution ?? []).join(" ");
    expect(joined).toContain("CQC information");
    expect(joined).toContain("Open Government Licence");
    // Coverage honesty: the CQC directory has no community pharmacies — say so where it matters.
    expect(labels?.emptyUnknownHint).toContain("pharmac");
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
