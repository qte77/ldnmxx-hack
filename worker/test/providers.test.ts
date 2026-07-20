import { describe, it, expect, vi, afterEach } from "vitest";
import {
  workersAiProvider,
  openRouterFreeProvider,
  renderFree,
  runChain,
  buildProviders,
  RENDER_SPEC,
  type Provider,
} from "../src/agent/providers";
import { extractToolArgs, type ToolSpec } from "../src/agent/model";

const goodBatch = [
  { beginRendering: { surfaceId: "main", root: "root" } },
  {
    surfaceUpdate: {
      surfaceId: "main",
      components: [
        { id: "root", component: { Column: { children: { explicitList: ["c1"] } } } },
        { id: "c1", component: { Card: { child: "t1" } } },
        { id: "t1", component: { Text: { text: { literalString: "Hi" }, usageHint: "h3" } } },
      ],
    },
  },
];

// OpenAI-compatible tool-call response (OpenRouter :free / Workers AI ChatCompletions share it).
function toolOutput(batch: unknown): unknown {
  return {
    choices: [
      { message: { tool_calls: [{ function: { name: "render_ui", arguments: JSON.stringify({ messages: batch }) } }] } },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

const fakeAi = (out: unknown): Ai => ({ run: vi.fn().mockResolvedValue(out) }) as unknown as Ai;

afterEach(() => vi.restoreAllMocks());

describe("workersAiProvider", () => {
  it("returns a validated batch from a good ai.run output", async () => {
    const r = await workersAiProvider(fakeAi(toolOutput(goodBatch)), "@cf/x").tryRender({ system: "s", user: "u" });
    expect(r?.batch).toEqual(goodBatch);
    expect(r?.usage.totalTokens).toBe(30);
  });
  it("returns null when ai.run throws", async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error("boom")) } as unknown as Ai;
    expect(await workersAiProvider(ai, "m").tryRender({ system: "s", user: "u" })).toBeNull();
  });
  it("returns null on an invalid (dangling-root) batch", async () => {
    const bad = [{ beginRendering: { surfaceId: "main", root: "nope" } }];
    expect(await workersAiProvider(fakeAi(toolOutput(bad)), "m").tryRender({ system: "s", user: "u" })).toBeNull();
  });
  it("invokes ai.run BOUND to the binding (regression: real Workers AI run() reads this.#options)", async () => {
    // A binding whose run() reads `this`. An unbound call sees this=undefined and throws — exactly the
    // real binding's "Cannot set properties of undefined (setting '#options')". Only .bind(ai) fixes it.
    const ai = {
      _out: toolOutput(goodBatch),
      run(this: { _out: unknown }) {
        return Promise.resolve(this._out);
      },
    } as unknown as Ai;
    const r = await workersAiProvider(ai, "m").tryRender({ system: "s", user: "u" });
    expect(r?.batch).toEqual(goodBatch);
  });
});

describe("renderFree (first-valid-wins)", () => {
  const ok = (name: string): Provider => ({
    name,
    tryRender: async () => ({ batch: goodBatch, model: name, usage: {} }),
    tryCall: async () => null, // unused by renderFree (which goes via tryRender)
  });
  const fail = (name: string): Provider => ({ name, tryRender: async () => null, tryCall: async () => null });

  it("returns the first provider that yields a batch", async () => {
    const r = await renderFree([fail("a"), ok("b"), ok("c")], { system: "s", user: "u" });
    expect(r?.provider).toBe("b");
    expect(r?.result.batch).toEqual(goodBatch);
  });
  it("returns null when every provider fails", async () => {
    expect(await renderFree([fail("a"), fail("b")], { system: "s", user: "u" })).toBeNull();
  });
  it("returns null for an empty chain", async () => {
    expect(await renderFree([], { system: "s", user: "u" })).toBeNull();
  });
});

describe("buildProviders", () => {
  it("includes only providers whose binding/secret is present, cheapest-first", () => {
    const ai = { run: vi.fn() } as unknown as Ai;
    expect(buildProviders({ ai, openRouterKey: "k" }).map((p) => p.name)).toEqual([
      "workers-ai",
      "openrouter-free",
    ]);
    expect(buildProviders({ openRouterKey: "k" }).map((p) => p.name)).toEqual(["openrouter-free"]);
    expect(buildProviders({}).map((p) => p.name)).toEqual([]);
  });
});

describe("fetch-based providers reuse callRenderModel", () => {
  it("openrouter-free returns a validated batch on a good response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(toolOutput(goodBatch)) }));
    const r = await openRouterFreeProvider("k", ["x:free"]).tryRender({ system: "s", user: "u" });
    expect(r?.batch).toEqual(goodBatch);
  });

  it("openrouter-free walks the fallback list: first valid wins, misses logged, winner in result.model", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      const model = JSON.parse(init.body).model as string;
      return model === "m1:free"
        ? { ok: false, json: () => Promise.resolve({}) }
        : { ok: true, json: () => Promise.resolve(toolOutput(goodBatch)) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await openRouterFreeProvider("k", ["m1:free", "m2:free"]).tryRender({ system: "s", user: "u" });
    expect(r?.batch).toEqual(goodBatch);
    expect(r?.model).toBe("m2:free");
    expect(warn).toHaveBeenCalledWith("openrouter-free: fell through", "m1:free");
  });

  it("openrouter-free returns null when every model in the list fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    expect(await openRouterFreeProvider("k", ["a:free", "b:free"]).tryRender({ system: "s", user: "u" })).toBeNull();
  });
});

// A trivial non-render tool proves the chain is generic (not render_ui-specific).
const echoSpec: ToolSpec<{ ok?: boolean }> = {
  tool: { type: "function", function: { name: "echo" } },
  toolName: "echo",
  extract: (d) => extractToolArgs(d, "echo"),
  validate: (v) => v.ok === true,
};
function echoOut(args: unknown): unknown {
  return {
    choices: [{ message: { tool_calls: [{ function: { name: "echo", arguments: JSON.stringify(args) } }] } }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  };
}

describe("tryCall (generic tool through any provider)", () => {
  it("openrouter-free runs a non-render tool and returns its validated value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(echoOut({ ok: true })) }));
    const r = await openRouterFreeProvider("k", ["m:free"]).tryCall(echoSpec, { system: "s", user: "u" });
    expect(r?.value).toEqual({ ok: true });
    expect(r?.usage.totalTokens).toBe(3);
  });
  it("workers-ai runs a non-render tool via the binding", async () => {
    const r = await workersAiProvider(fakeAi(echoOut({ ok: true })), "m").tryCall(echoSpec, { system: "s", user: "u" });
    expect(r?.value).toEqual({ ok: true });
  });
  it("returns null when the tool result fails validation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(echoOut({ ok: false })) }));
    expect(await openRouterFreeProvider("k", ["m:free"]).tryCall(echoSpec, { system: "s", user: "u" })).toBeNull();
  });
});

describe("runChain (generic first-valid-wins)", () => {
  const p = (name: string, val: unknown): Provider => ({
    name,
    tryRender: async () => null,
    tryCall: async () => val as never,
  });
  it("returns the first provider that yields a non-null result", async () => {
    const r = await runChain(
      [p("a", null), p("b", { v: 1 }), p("c", { v: 2 })],
      (x) => x.tryCall(RENDER_SPEC, { system: "s", user: "u" })
    );
    expect(r?.provider).toBe("b");
    expect(r?.result).toEqual({ v: 1 });
  });
  it("returns null when every provider yields null", async () => {
    const r = await runChain([p("a", null), p("b", null)], (x) => x.tryCall(RENDER_SPEC, { system: "s", user: "u" }));
    expect(r).toBeNull();
  });
});
