import { describe, it, expect } from "vitest";
import { handleMcp } from "../../src/mcp/dispatch";
import type { Env } from "../../src/worker";

const CORS = { "access-control-allow-origin": "*" };
const ENV = {} as Env;

interface JsonRpcResult {
  serverInfo?: { name: string };
  capabilities?: unknown;
  tools?: { name: string; description: string; inputSchema: { required: string[]; additionalProperties: boolean } }[];
  isError?: boolean;
  content?: { type: "text"; text: string }[];
}
interface JsonRpcResponseBody {
  result?: JsonRpcResult;
  error?: { code: number; message: string };
}

function rpcRequest(body: unknown): Request {
  return new Request("https://worker.example/api/mcp", { method: "POST", body: JSON.stringify(body) });
}

async function rpc(body: unknown, env: Env = ENV): Promise<{ status: number; json: JsonRpcResponseBody }> {
  const response = await handleMcp(rpcRequest(body), env, CORS);
  const json: JsonRpcResponseBody = await response.json();
  return { status: response.status, json };
}

// Both helpers throw with the full body on a shape mismatch, so a failing assertion still shows
// exactly what came back instead of a bare "possibly undefined" type error.
function result(json: JsonRpcResponseBody): JsonRpcResult {
  if (!json.result) throw new Error(`expected a result, got: ${JSON.stringify(json)}`);
  return json.result;
}
function errorOf(json: JsonRpcResponseBody): NonNullable<JsonRpcResponseBody["error"]> {
  if (!json.error) throw new Error(`expected an error, got: ${JSON.stringify(json)}`);
  return json.error;
}
function toolPayload(json: JsonRpcResponseBody): { isError: boolean | undefined; parsed: unknown } {
  const first = result(json).content?.[0];
  if (!first) throw new Error(`expected tool content, got: ${JSON.stringify(json)}`);
  return { isError: result(json).isError, parsed: JSON.parse(first.text) };
}

describe("handleMcp — protocol", () => {
  it("answers a parse error for invalid JSON", async () => {
    const response = await handleMcp(
      new Request("https://worker.example/api/mcp", { method: "POST", body: "{not json" }),
      ENV,
      CORS
    );
    const body: JsonRpcResponseBody = await response.json();
    expect(errorOf(body).code).toBe(-32700);
  });

  it("answers initialize with server info", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(result(json).serverInfo?.name).toBeTypeOf("string");
    expect(result(json).capabilities).toEqual({ tools: {} });
  });

  it("answers tools/list with exactly the 4 real, deterministic usecases (ADR 0007)", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tools = result(json).tools ?? [];
    const names = tools.map((t) => t.name);
    expect(names).toEqual(["sort_my_care", "sort_my_wander", "sort_my_scam_check", "sort_my_food_hygiene"]);
    // sort-my-route / founders-copilot never appear — no keywords, never fabricate a demo as real.
    expect(names).not.toContain("sort_my_route");
    expect(names).not.toContain("founders_copilot");
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.required).toEqual(["prompt"]);
      expect(tool.inputSchema.additionalProperties).toBe(false);
    }
  });

  it("answers an unknown method with -32601", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 3, method: "nope" });
    expect(errorOf(json).code).toBe(-32601);
  });

  it("answers an unknown tool with -32602", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "delete_everything", arguments: {} },
    });
    expect(errorOf(json).code).toBe(-32602);
  });

  it("accepts notifications/initialized with a bare 202", async () => {
    const response = await handleMcp(
      rpcRequest({ jsonrpc: "2.0", method: "notifications/initialized" }),
      ENV,
      CORS
    );
    expect(response.status).toBe(202);
  });
});

describe("handleMcp — tools/call, malformed args", () => {
  it("fails closed with isError when prompt is missing", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "sort_my_care", arguments: {} },
    });
    expect(result(json).isError).toBe(true);
    expect(result(json).content?.[0]?.text).toMatch(/prompt.*required/iu);
  });
});

describe("handleMcp — tools/call, corpus-backed tools (bundled sample, no D1 bound)", () => {
  it("sort_my_care returns real nearest-N rows for a known sample postcode", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "sort_my_care", arguments: { prompt: "SW9 9SL" } },
    });
    const payload = toolPayload(json).parsed as { query: string | null; rows: { officialUrl: string }[] };
    expect(payload.query).toBe("SW9 9SL");
    expect(payload.rows.length).toBeGreaterThan(0);
    expect(payload.rows[0]).toHaveProperty("officialUrl");
  });

  it("sort_my_wander returns real rows for the same known postcode", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "sort_my_wander", arguments: { prompt: "SW9 9SL" } },
    });
    const payload = toolPayload(json).parsed as { rows: unknown[] };
    expect(payload.rows.length).toBeGreaterThan(0);
  });

  it("sort_my_food_hygiene returns real rows for the same known postcode", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "sort_my_food_hygiene", arguments: { prompt: "SW9 9SL" } },
    });
    const payload = toolPayload(json).parsed as { rows: unknown[] };
    expect(payload.rows.length).toBeGreaterThan(0);
  });

  it("an unresolvable location returns an empty (not fabricated) result, not an error", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "sort_my_care", arguments: { prompt: "not a real place at all" } },
    });
    const payload = toolPayload(json).parsed as { query: string | null; rows: unknown[] };
    expect(payload.query).toBeNull();
    expect(payload.rows).toEqual([]);
  });
});

describe("handleMcp — tools/call, sort_my_scam_check (bundled sample)", () => {
  it("returns a real match with the mandatory FCA-register signpost, never a verdict", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "sort_my_scam_check", arguments: { prompt: "Thames Capital Partners" } },
    });
    const payload = toolPayload(json).parsed as { rows: { officialUrl: string }[] };
    expect(payload.rows.length).toBeGreaterThan(0);
    expect(payload.rows[0]?.officialUrl).toMatch(/fca/iu);
  });

  it("a too-short query returns an empty result, not an error", async () => {
    const { json } = await rpc({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "sort_my_scam_check", arguments: { prompt: "a" } },
    });
    const payload = toolPayload(json).parsed as { query: string | null; rows: unknown[] };
    expect(payload.query).toBeNull();
    expect(payload.rows).toEqual([]);
  });
});
