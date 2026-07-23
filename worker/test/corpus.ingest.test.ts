import { describe, it, expect } from "vitest";
import {
  INGEST_TARGETS,
  chunkRows,
  gazetteerRows,
  ingestArtifact,
  swapGate,
  type IngestTarget,
} from "../src/corpus/ingest";

// --- P1 (#182): the cron's pure validate -> swap planner ------------------------------------------

const gazetteerTarget: IngestTarget = {
  corpus: "gazetteer",
  artifact: "postcodes.json",
  table: "postcodes",
  kind: "gazetteer",
  minRows: 1000,
};

const corpusTarget: IngestTarget = {
  corpus: "care",
  artifact: "cqc.json",
  table: "cqc_locations",
  kind: "corpus",
  minRows: 50,
};

const gazRow = { postcode: "SW9 9SL", lat: 51.4626, lng: -0.1146 };

describe("gazetteerRows (shape guard over an untrusted artifact)", () => {
  it("keeps well-formed rows", () => {
    expect(gazetteerRows([gazRow])).toEqual([gazRow]);
  });

  it("drops malformed rows instead of throwing (bad lat, missing lng, non-string postcode)", () => {
    const rows = gazetteerRows([
      gazRow,
      { ...gazRow, postcode: "E8 3PB", lat: "oops" },
      { postcode: "N1 9GU", lat: 51.53 },
      { postcode: 42, lat: 51.5, lng: -0.1 },
    ]);
    expect(rows).toEqual([gazRow]);
  });

  it("excludes NI/BT postcodes (separate non-commercial licence — never served)", () => {
    const rows = gazetteerRows([gazRow, { postcode: "BT1 1AA", lat: 54.6, lng: -5.93 }]);
    expect(rows.map((r) => r.postcode)).toEqual(["SW9 9SL"]);
  });

  it("dedupes by postcode (first row wins)", () => {
    const rows = gazetteerRows([gazRow, { postcode: "SW9 9SL", lat: 0, lng: 0 }]);
    expect(rows).toEqual([gazRow]);
  });

  it("returns [] for a non-array payload", () => {
    expect(gazetteerRows({ nope: true })).toEqual([]);
    expect(gazetteerRows(null)).toEqual([]);
  });
});

describe("swapGate (the gate that keeps a bad artifact out of the live store)", () => {
  it("refuses below minRows, naming the counts", () => {
    const gate = swapGate(gazetteerTarget, 3, []);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/3.*1000|1000.*3/);
  });

  it("passes a gazetteer at minRows (attribution not required)", () => {
    expect(swapGate(gazetteerTarget, 1000, []).ok).toBe(true);
  });

  it("refuses a CORPUS whose registry attribution is empty (licence obligation as a hard gate)", () => {
    const gate = swapGate(corpusTarget, 5000, []);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/attribution/);
  });

  it("passes a corpus with rows and attribution", () => {
    expect(swapGate(corpusTarget, 5000, ["© Care Quality Commission"]).ok).toBe(true);
  });
});

describe("chunkRows (D1 bound-parameter batching arithmetic)", () => {
  it("keeps every chunk within the parameter budget and preserves order", () => {
    const rows = Array.from({ length: 250 }, (_, i) => i);
    const chunks = chunkRows(rows, 3, 90);
    for (const c of chunks) expect(c.length * 3).toBeLessThanOrEqual(90);
    expect(chunks.flat()).toEqual(rows);
  });

  it("one small chunk for a small artifact", () => {
    expect(chunkRows([1, 2], 3, 90)).toEqual([[1, 2]]);
  });
});

// --- the shadow -> validate -> swap sequence against a recording D1 stub --------------------------

interface RecordingDb {
  db: D1Database;
  sql: string[];
}

function recordingDb(counts: Record<string, number> = {}): RecordingDb {
  const sql: string[] = [];
  const stmt = (s: string): unknown => ({
    bind: () => stmt(s),
    run: () => Promise.resolve({ success: true }),
    all: () => Promise.resolve({ results: [] }),
    first: () => {
      const hit = Object.entries(counts).find(([table]) => s.includes(table));
      return Promise.resolve(hit ? { n: hit[1] } : null);
    },
  });
  const db = {
    prepare: (s: string) => {
      sql.push(s);
      return stmt(s);
    },
    batch: (stmts: unknown[]) => Promise.resolve(stmts.map(() => ({ success: true }))),
  } as unknown as D1Database;
  return { db, sql };
}

describe("ingestArtifact (shadow -> validate -> swap, atomic, gate-refusable)", () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    postcode: `E${String(i)} 1AA`,
    lat: 51.5,
    lng: -0.1,
  }));

  it("loads a shadow table, then swaps atomically (DELETE + INSERT..SELECT + DROP + meta stamp)", async () => {
    const { db, sql } = recordingDb({ postcodes_shadow: 1000 });
    const res = await ingestArtifact(db, gazetteerTarget, rows, []);
    expect(res.swapped).toBe(true);
    expect(res.rowCount).toBe(1000);
    const all = sql.join("\n");
    expect(all).toContain("postcodes_shadow");
    expect(all).toContain("DELETE FROM postcodes");
    expect(all).toContain("INSERT INTO postcodes SELECT");
    expect(all).toContain("corpus_meta");
  });

  it("REFUSES the swap when the shadow count is under the gate — live table untouched", async () => {
    const { db, sql } = recordingDb({ postcodes_shadow: 3 });
    const res = await ingestArtifact(db, gazetteerTarget, rows.slice(0, 3), []);
    expect(res.swapped).toBe(false);
    expect(sql.join("\n")).not.toContain("DELETE FROM postcodes");
  });

  it("REFUSES a corpus swap without attribution — live table untouched", async () => {
    const { db, sql } = recordingDb({ cqc_locations_shadow: 5000 });
    const res = await ingestArtifact(db, corpusTarget, rows, []);
    expect(res.swapped).toBe(false);
    if (!res.swapped) expect(res.reason).toMatch(/attribution/);
    expect(sql.join("\n")).not.toContain("DELETE FROM cqc_locations");
  });
});

describe("INGEST_TARGETS (the closed, reviewable set the cron may touch)", () => {
  it("P4 ships the gazetteer + wander + care + food-hygiene targets", () => {
    expect(INGEST_TARGETS.map((t) => t.corpus)).toEqual([
      "gazetteer",
      "wander-nhle",
      "wander-greenspace",
      "care",
      "food-hygiene",
    ]);
    const fh = INGEST_TARGETS.find((t) => t.corpus === "food-hygiene")!;
    expect(fh.table).toBe("fhrs_establishments");
    expect(fh.kind).toBe("corpus");
    expect(fh.minRows).toBeGreaterThanOrEqual(1000);
    const care = INGEST_TARGETS.find((t) => t.corpus === "care")!;
    expect(care.table).toBe("cqc_locations");
    expect(care.kind).toBe("corpus");
    expect(care.minRows).toBeGreaterThanOrEqual(1000);
    const gaz = INGEST_TARGETS[0]!;
    expect(gaz.table).toBe("postcodes");
    expect(gaz.minRows).toBeGreaterThanOrEqual(1000);
  });

  it("both wander targets are corpus-kind (licence-gated) and take attribution from the wander registry", () => {
    const wander = INGEST_TARGETS.filter((t) => t.corpus.startsWith("wander-"));
    expect(wander.map((t) => t.table)).toEqual(["nhle_places", "greenspace_places"]);
    for (const t of wander) {
      expect(t.kind).toBe("corpus");
      expect(t.attributionOf).toBe("wander");
      expect(t.minRows).toBeGreaterThanOrEqual(500);
    }
  });
});
