import { describe, it, expect } from "vitest";
import { assertUsecaseDef, type UsecaseDef } from "../src/usecases";
import { runUsecase } from "../src/worker";
import type { Emitter } from "../src/trace/arize";

// A minimal valid def used as the baseline the guard should accept.
const validDef: UsecaseDef = {
  id: "x",
  title: "X",
  render: { mode: "route" },
  stages: [{ name: "plan", kind: "plan", events: [{ type: "STEP_STARTED", text: "go" }] }],
};

describe("usecases guard", () => {
  it("accepts a minimal valid def", () => {
    expect(() => assertUsecaseDef(validDef)).not.toThrow();
  });

  it("rejects empty stages", () => {
    expect(() => assertUsecaseDef({ ...validDef, stages: [] })).toThrow();
  });

  it("rejects an unknown render.mode", () => {
    expect(() => assertUsecaseDef({ ...validDef, render: { mode: "nope" } })).toThrow();
  });

  it("accepts a known stage.exec", () => {
    expect(() =>
      assertUsecaseDef({
        id: "x",
        title: "X",
        render: { mode: "founders" },
        stages: [{ name: "plan", kind: "plan", exec: "assess_stage", events: [] }],
      })
    ).not.toThrow();
  });

  it("rejects an unknown stage.exec", () => {
    expect(() =>
      assertUsecaseDef({
        id: "x",
        title: "X",
        render: { mode: "founders" },
        stages: [{ name: "plan", kind: "plan", exec: "nope", events: [] }],
      })
    ).toThrow();
  });

  // A typo'd corpus id would otherwise surface as a silently empty card batch at request time.
  const corpusDef = (corpus?: unknown): unknown => ({
    id: "x",
    title: "X",
    render: { mode: "corpus" },
    stages: [{ name: "query", kind: "tool", exec: "query_corpus", corpus, events: [] }],
  });

  it("accepts a query_corpus stage naming a registered corpus", () => {
    expect(() => assertUsecaseDef(corpusDef("care"))).not.toThrow();
  });

  it("rejects a query_corpus stage whose corpus is unregistered or missing", () => {
    expect(() => assertUsecaseDef(corpusDef("nope"))).toThrow(/query_corpus/);
    expect(() => assertUsecaseDef(corpusDef())).toThrow(/query_corpus/);
  });
});

// The one new-capability test: an arbitrary usecase def drives the engine end-to-end with zero code
// edits — the literal "swap a JSON, swap the app" proof. Uses render.mode "route" so no network.
describe("runUsecase — swap-a-JSON proof", () => {
  it("plays an arbitrary def's stages, then renders + finishes, one span per stage", async () => {
    const fixture: UsecaseDef = {
      id: "demo-x",
      title: "Demo X",
      render: { mode: "route" },
      stages: [
        { name: "tool:custom_x", kind: "tool", events: [{ type: "TOOL_CALL_START", text: "custom_x" }] },
      ],
    };
    const events: { type: string; text?: string; a2uiMessages?: unknown[] }[] = [];
    const spans: string[] = [];
    const emitter: Emitter = { span: (s) => spans.push(s.name), flush: () => Promise.resolve() };
    const ctx = { key: "", model: "", baseURL: "", prompt: "", providers: [] };

    await runUsecase(fixture, emitter, (e) => events.push(e), { usecase: "demo-x" }, ctx, 0);

    expect(events.map((e) => e.type)).toEqual([
      "RUN_STARTED",
      "TOOL_CALL_START",
      "TOOL_CALL_END",
      "USAGE", // terminal HUD frame — a canned route render reads as the deterministic "demo" mode
      "RUN_FINISHED",
    ]);
    expect(events[1]!.text).toBe("custom_x");
    const render = events[2]!;
    expect(render.text).toBe("render_ui");
    expect(render.a2uiMessages).toBeTruthy();
    expect(spans).toEqual(["run", "tool:custom_x", "render"]);
  });

  // W1's actual payoff: a corpus usecase that exists ONLY as a def — no bespoke render mode, no
  // bespoke query exec, no interpreter change — runs end-to-end and renders real corpus cards.
  it("drives a register-only corpus usecase end-to-end from its def alone", async () => {
    const fixture: UsecaseDef = {
      id: "demo-corpus",
      title: "Demo Corpus",
      render: { mode: "corpus" },
      stages: [
        {
          name: "query",
          kind: "tool",
          exec: "query_corpus",
          corpus: "care",
          events: [{ type: "TOOL_CALL_START", text: "query_corpus" }],
        },
      ],
    };
    const events: { type: string; text?: string; a2uiMessages?: unknown[] }[] = [];
    const emitter: Emitter = { span: () => undefined, flush: () => Promise.resolve() };
    const ctx = { key: "", model: "", baseURL: "", prompt: "SW9 9SL", providers: [] };

    await runUsecase(fixture, emitter, (e) => events.push(e), { usecase: "demo-corpus" }, ctx, 0);

    const render = events.find((e) => e.text === "render_ui");
    expect(render?.a2uiMessages).toBeTruthy();
    const json = JSON.stringify(render?.a2uiMessages);
    expect(json).toContain("near SW9 9SL"); // real corpus rows, resolved by id from the def
    expect(json).toContain("Always confirm with the official source");
    // Deterministic corpus workflows are honestly "demo" — nothing degraded.
    expect(events.find((e) => e.type === "USAGE")).toMatchObject({ mode: "demo" });
  });
});
