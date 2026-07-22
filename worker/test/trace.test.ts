import { describe, it, expect, vi, afterEach } from "vitest";
import { spansToOtlp, exportSpans, makeEmitter, MAX_TRACE_SPANS, type Span } from "../src/trace/arize";
import worker from "../src/worker";

const arizeEnv = { ARIZE_API_KEY: "k", ARIZE_SPACE_ID: "s" };
const ctx = { waitUntil: (p: Promise<unknown>) => void p, passThroughOnException: () => undefined } as unknown as ExecutionContext;

const spans: Span[] = [
  { name: "run", attrs: { latencyMs: 5, usecase: "founders-copilot" } },
  { name: "tool:search_opportunities", attrs: { kind: "tool", latencyMs: 3 } },
  { name: "model:workers-ai", attrs: { model: "@cf/x", totalTokens: 42 } },
];

// Reach into the OTLP JSON without pulling in a schema.
function otlpSpans(payload: unknown): Record<string, unknown>[] {
  const rs = (payload as { resourceSpans: { scopeSpans: { spans: Record<string, unknown>[] }[] }[] }).resourceSpans;
  return rs[0]!.scopeSpans[0]!.spans;
}
function kindOf(span: Record<string, unknown>): string | undefined {
  const attrs = span["attributes"] as { key: string; value: { stringValue?: string } }[];
  return attrs.find((a) => a.key === "openinference.span.kind")?.value.stringValue;
}

afterEach(() => vi.restoreAllMocks());

describe("spansToOtlp", () => {
  it("maps spans to one OTLP trace with per-span ids sharing a trace id", () => {
    const out = otlpSpans(spansToOtlp(spans, arizeEnv));
    expect(out).toHaveLength(3);
    const traceIds = new Set(out.map((s) => s["traceId"]));
    expect(traceIds.size).toBe(1);
    expect(String(out[0]!["traceId"])).toMatch(/^[0-9a-f]{32}$/);
    for (const s of out) expect(String(s["spanId"])).toMatch(/^[0-9a-f]{16}$/);
  });

  it("parents non-root spans under the run span", () => {
    const out = otlpSpans(spansToOtlp(spans, arizeEnv));
    const run = out.find((s) => s["name"] === "run");
    expect(run?.["parentSpanId"]).toBeUndefined();
    for (const s of out.filter((x) => x["name"] !== "run")) {
      expect(s["parentSpanId"]).toBe(run?.["spanId"]);
    }
  });

  it("assigns OpenInference span kinds (run→CHAIN, tool→TOOL, model→LLM)", () => {
    const out = otlpSpans(spansToOtlp(spans, arizeEnv));
    expect(kindOf(out.find((s) => s["name"] === "run")!)).toBe("CHAIN");
    expect(kindOf(out.find((s) => s["name"] === "tool:search_opportunities")!)).toBe("TOOL");
    expect(kindOf(out.find((s) => s["name"] === "model:workers-ai")!)).toBe("LLM");
  });

  it("carries span attrs as typed OTLP values and end≥start nanos", () => {
    const out = otlpSpans(spansToOtlp(spans, arizeEnv));
    const model = out.find((s) => s["name"] === "model:workers-ai")!;
    const attrs = model["attributes"] as { key: string; value: Record<string, unknown> }[];
    expect(attrs.find((a) => a.key === "model")?.value["stringValue"]).toBe("@cf/x");
    expect(attrs.find((a) => a.key === "totalTokens")?.value["intValue"]).toBe("42");
    expect(BigInt(String(model["endTimeUnixNano"]))).toBeGreaterThanOrEqual(BigInt(String(model["startTimeUnixNano"])));
  });
});

describe("exportSpans", () => {
  it("POSTs OTLP JSON with space_id + api_key headers when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await exportSpans(arizeEnv, spans);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://otlp.arize.com/v1/traces");
    expect(init.method).toBe("POST");
    expect(init.headers.space_id).toBe("s");
    expect(init.headers.api_key).toBe("k");
    expect(init.headers["content-type"]).toContain("application/json");
  });

  it("no-ops when Arize is unconfigured or there are no spans", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await exportSpans({}, spans);
    await exportSpans(arizeEnv, []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows exporter errors (observability never breaks the request)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(exportSpans(arizeEnv, spans)).resolves.toBeUndefined();
  });
});

describe("makeEmitter", () => {
  it("buffers spans and exports them on flush when Arize is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const emitter = makeEmitter(arizeEnv);
    emitter.span({ name: "run", attrs: {} });
    emitter.span({ name: "render", attrs: { kind: "render" } });
    await emitter.flush();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(otlpSpans(JSON.parse(fetchMock.mock.calls[0]![1].body))).toHaveLength(2);
  });
});

describe("POST /trace forwarder", () => {
  const post = (body: unknown) =>
    new Request("https://w.example/api/trace", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://qte77.github.io" },
      body: JSON.stringify(body),
    });

  it("accepts a browser span batch and forwards it to Arize (202)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const res = await worker.fetch(post({ spans }), arizeEnv, ctx);
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns 202 but forwards nothing when Arize is unconfigured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const res = await worker.fetch(post({ spans }), { ALLOWED_ORIGINS: "https://qte77.github.io" }, ctx);
    expect(res.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps the forwarded batch at MAX_TRACE_SPANS", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const many = Array.from({ length: MAX_TRACE_SPANS + 50 }, (_, i) => ({ name: `s${String(i)}` }));
    await worker.fetch(post({ spans: many }), arizeEnv, ctx);
    expect(otlpSpans(JSON.parse(fetchMock.mock.calls[0]![1].body)).length).toBe(MAX_TRACE_SPANS);
  });

  it("rejects a non-POST /trace with 405", async () => {
    const res = await worker.fetch(new Request("https://w.example/api/trace", { method: "GET" }), arizeEnv, ctx);
    expect(res.status).toBe(405);
  });
});
