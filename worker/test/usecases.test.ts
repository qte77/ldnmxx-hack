import { describe, it, expect } from "vitest";
import { assertUsecaseDef, type UsecaseDef } from "../src/usecases";
import { runUsecase } from "../src/worker";
import type { Emitter } from "../src/trace/arize";

// A minimal valid def used as the baseline the guard should accept.
const validDef: UsecaseDef = {
  id: "x",
  title: "X",
  render: { mode: "route" },
  stages: [{ span: "plan", kind: "plan", events: [{ type: "STEP_STARTED", text: "go" }] }],
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
        { span: "tool:custom_x", kind: "tool", events: [{ type: "TOOL_CALL_START", text: "custom_x" }] },
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
      "RUN_FINISHED",
    ]);
    expect(events[1].text).toBe("custom_x");
    const render = events[2];
    expect(render.text).toBe("render_ui");
    expect(render.a2uiMessages).toBeTruthy();
    expect(spans).toEqual(["run", "tool:custom_x", "render"]);
  });
});
