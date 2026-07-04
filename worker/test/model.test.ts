import { describe, it, expect, vi, afterEach } from "vitest";
import { extractBatch, isValidBatch, callRenderModel } from "../src/agent/model";

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

function toolResponse(batch: unknown): unknown {
  return {
    choices: [
      { message: { tool_calls: [{ function: { name: "render_ui", arguments: JSON.stringify({ messages: batch }) } }] } },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("extractBatch", () => {
  it("pulls the batch from a render_ui tool call", () => {
    expect(extractBatch(toolResponse(goodBatch) as never)).toEqual(goodBatch);
  });
  it("returns null when there is no tool call", () => {
    expect(extractBatch({ choices: [{ message: {} }] } as never)).toBeNull();
  });
  it("returns null on non-JSON arguments", () => {
    const r = { choices: [{ message: { tool_calls: [{ function: { name: "render_ui", arguments: "{bad" } }] } }] };
    expect(extractBatch(r as never)).toBeNull();
  });
});

describe("isValidBatch", () => {
  it("accepts a self-contained batch", () => {
    expect(isValidBatch(goodBatch)).toBe(true);
  });
  it("rejects a dangling child reference", () => {
    const bad = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      { surfaceUpdate: { surfaceId: "main", components: [{ id: "root", component: { Card: { child: "missing" } } }] } },
    ];
    expect(isValidBatch(bad)).toBe(false);
  });
  it("rejects a missing root", () => {
    expect(isValidBatch([{ surfaceUpdate: { surfaceId: "main", components: [] } }])).toBe(false);
  });
});

describe("callRenderModel", () => {
  it("returns the validated batch + usage on a good response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(toolResponse(goodBatch)) }));
    const r = await callRenderModel({ apiKey: "k", model: "m", baseURL: "https://x/v1", system: "s", user: "u" });
    expect(r?.batch).toEqual(goodBatch);
    expect(r?.usage.totalTokens).toBe(150);
  });
  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    expect(await callRenderModel({ apiKey: "k", model: "m", baseURL: "https://x/v1", system: "s", user: "u" })).toBeNull();
  });
  it("returns null when fetch throws (network/timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await callRenderModel({ apiKey: "k", model: "m", baseURL: "https://x/v1", system: "s", user: "u" })).toBeNull();
  });
  it("returns null when the model emits an invalid batch", async () => {
    const invalid = [{ beginRendering: { surfaceId: "main", root: "nope" } }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(toolResponse(invalid)) }));
    expect(await callRenderModel({ apiKey: "k", model: "m", baseURL: "https://x/v1", system: "s", user: "u" })).toBeNull();
  });
});
