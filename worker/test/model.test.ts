import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractBatch,
  extractToolArgs,
  isValidBatch,
  callRenderModel,
  callModelTool,
  describeModelStatus,
  retryAfterMs,
  type ORResponse,
} from "../src/agent/model";

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
    expect(extractBatch({ choices: [{ message: {} }] })).toBeNull();
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

// A tiny non-render tool to exercise the generic path without coupling to render_ui.
const echoTool = { type: "function", function: { name: "echo" } };
function echoResponse(args: unknown): unknown {
  return {
    choices: [{ message: { tool_calls: [{ function: { name: "echo", arguments: JSON.stringify(args) } }] } }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  };
}

describe("extractToolArgs", () => {
  it("parses the named tool's arguments object", () => {
    expect(extractToolArgs(echoResponse({ text: "hi" }) as ORResponse, "echo")).toEqual({ text: "hi" });
  });
  it("returns null when the first tool call is a different tool", () => {
    expect(extractToolArgs(echoResponse({ text: "hi" }) as ORResponse, "other")).toBeNull();
  });
  it("returns null on non-JSON arguments", () => {
    const r = { choices: [{ message: { tool_calls: [{ function: { name: "echo", arguments: "{bad" } }] } }] };
    expect(extractToolArgs(r as ORResponse, "echo")).toBeNull();
  });
});

describe("callModelTool (generic forced-tool core)", () => {
  const base = { apiKey: "k", model: "m", baseURL: "https://x/v1", system: "s", user: "u" };
  const extract = (d: ORResponse): { text?: unknown } | null => extractToolArgs(d, "echo");
  const validate = (v: { text?: unknown }): boolean => typeof v.text === "string";

  it("returns the validated value + usage on a good response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(echoResponse({ text: "hi" })) }));
    const r = await callModelTool({ ...base, tool: echoTool, toolName: "echo", extract, validate });
    expect(r?.value).toEqual({ text: "hi" });
    expect(r?.usage.totalTokens).toBe(3);
  });
  it("returns null when validation fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(echoResponse({ text: 123 })) }));
    expect(await callModelTool({ ...base, tool: echoTool, toolName: "echo", extract, validate })).toBeNull();
  });
  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    expect(await callModelTool({ ...base, tool: echoTool, toolName: "echo", extract, validate })).toBeNull();
  });
  it("returns null when fetch throws (network/timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await callModelTool({ ...base, tool: echoTool, toolName: "echo", extract, validate })).toBeNull();
  });
});

describe("callModelTool — transient retry + status taxonomy (H3/H4)", () => {
  const base = { apiKey: "k", model: "m", baseURL: "https://x/v1", system: "s", user: "u", retryBackoffMs: 0 };
  const extract = (d: ORResponse): { text?: unknown } | null => extractToolArgs(d, "echo");
  const validate = (v: { text?: unknown }): boolean => typeof v.text === "string";
  const spec = { tool: echoTool, toolName: "echo", extract, validate };

  it("retries once on a transient status, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(echoResponse({ text: "hi" })) });
    vi.stubGlobal("fetch", fetchMock);
    const r = await callModelTool({ ...base, ...spec });
    expect(r?.value).toEqual({ text: "hi" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails fast on a fatal status (no retry)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);
    expect(await callModelTool({ ...base, ...spec })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after one retry when a transient status persists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);
    expect(await callModelTool({ ...base, ...spec })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a thrown fetch (network / aborted timeout)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("aborted"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await callModelTool({ ...base, ...spec })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("describeModelStatus", () => {
  it("labels transient + fatal statuses for one concise warn", () => {
    expect(describeModelStatus(429)).toBe("rate-limited");
    expect(describeModelStatus(401)).toBe("auth");
    expect(describeModelStatus(407)).toBe("auth");
    expect(describeModelStatus(404)).toBe("gone");
    expect(describeModelStatus(410)).toBe("gone");
    expect(describeModelStatus(451)).toBe("legal");
    expect(describeModelStatus(503)).toBe("server");
    expect(describeModelStatus(418)).toBe("http");
  });
});

describe("retryAfterMs", () => {
  it("parses delta-seconds, caps at 60s, ignores junk", () => {
    expect(retryAfterMs("5")).toBe(5000);
    expect(retryAfterMs("120")).toBe(60000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs("soon")).toBeNull();
  });
});
