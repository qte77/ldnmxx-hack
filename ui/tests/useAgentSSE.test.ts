import { describe, it, expect, vi, afterEach } from "vitest";
import { parseSSE, toStatus, runWorkerPath } from "../src/agent/useAgentSSE";
import { applyA2UIEvent, type AgentEvent } from "../src/agent/applyA2UIEvent";
import { A2UIMessageBatchSchema } from "../src/agent/contract";

describe("parseSSE", () => {
  it("parses complete data frames into AgentEvents", () => {
    const buf =
      `data: ${JSON.stringify({ type: "TEXT_MESSAGE_CONTENT", text: "hi" })}\n\n` +
      `data: ${JSON.stringify({ type: "RUN_FINISHED" })}\n\n`;
    const { events, rest } = parseSSE(buf);
    expect(events.map((e) => e.type)).toEqual(["TEXT_MESSAGE_CONTENT", "RUN_FINISHED"]);
    expect(events[0]?.text).toBe("hi");
    expect(rest).toBe("");
  });

  it("buffers a trailing partial frame as rest", () => {
    const buf = `data: ${JSON.stringify({ type: "RUN_STARTED" })}\n\ndata: {"type":"TEXT`;
    const { events, rest } = parseSSE(buf);
    expect(events.map((e) => e.type)).toEqual(["RUN_STARTED"]);
    expect(rest).toContain(`data: {"type":"TEXT`);
  });

  it("skips a malformed frame without throwing", () => {
    const buf = `data: not-json\n\ndata: ${JSON.stringify({ type: "RUN_FINISHED" })}\n\n`;
    expect(() => parseSSE(buf)).not.toThrow();
    const { events } = parseSSE(buf);
    expect(events.map((e) => e.type)).toEqual(["RUN_FINISHED"]);
  });

  it("maps an error event", () => {
    const { events } = parseSSE(
      `data: ${JSON.stringify({ type: "RUN_ERROR", text: "boom" })}\n\n`
    );
    expect(events[0]).toEqual({ type: "RUN_ERROR", text: "boom" });
  });

  it("round-trips a terminal USAGE frame, preserving its mode/model/token fields", () => {
    const usage = {
      type: "USAGE",
      mode: "live",
      model: "@cf/openai/gpt-oss-120b",
      provider: "workers-ai",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    };
    const { events } = parseSSE(`data: ${JSON.stringify(usage)}\n\n`);
    expect(events[0]).toEqual(usage);
  });
});

describe("toStatus", () => {
  it("maps a live USAGE frame to mode + model + summed tokens", () => {
    const s = toStatus({
      type: "USAGE",
      mode: "live",
      model: "@cf/openai/gpt-oss-120b",
      totalTokens: 20,
    } as AgentEvent);
    expect(s).toEqual({ mode: "live", model: "@cf/openai/gpt-oss-120b", tokens: 20 });
  });

  it("maps a demo USAGE frame (no model, zero tokens)", () => {
    const s = toStatus({ type: "USAGE", mode: "demo", totalTokens: 0 } as AgentEvent);
    expect(s).toEqual({ mode: "demo", model: undefined, tokens: 0 });
  });

  it("defaults an unknown/missing mode to stub — never claims live", () => {
    const s = toStatus({ type: "USAGE" });
    expect(s.mode).toBe("stub");
    expect(s.tokens).toBe(0);
  });
});

describe("applyA2UIEvent with a Column/Card/Text batch", () => {
  const batch = [
    { beginRendering: { surfaceId: "main", root: "root" } },
    {
      surfaceUpdate: {
        surfaceId: "main",
        components: [
          { id: "root", component: { Column: { children: { explicitList: ["card-1"] } } } },
          { id: "card-1", component: { Card: { child: "body-1" } } },
          { id: "body-1", component: { Column: { children: { explicitList: ["t-1"] } } } },
          { id: "t-1", component: { Text: { text: { literalString: "Hello" }, usageHint: "h3" } } },
        ],
      },
    },
  ];

  it("passes the real contract schema (self-contained, acyclic)", () => {
    expect(A2UIMessageBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("renders a valid batch and logs its component types", () => {
    const render = vi.fn();
    const event: AgentEvent = { type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: batch };
    const entry = applyA2UIEvent(event, 12, render);
    expect(render).toHaveBeenCalledTimes(1);
    expect(entry.a2uiComponentTypes).toContain("Card");
  });

  it("surfaces a contract violation instead of rendering (never-silent-blank)", () => {
    const render = vi.fn();
    const bad: AgentEvent = {
      type: "TOOL_CALL_END",
      a2uiMessages: [
        {
          surfaceUpdate: {
            surfaceId: "main",
            components: [{ id: "x", component: { Card: { children: "y" } } }],
          },
        },
      ],
    };
    const entry = applyA2UIEvent(bad, 1, render);
    expect(render).not.toHaveBeenCalled();
    expect(entry.text).toContain("contract violation");
  });
});

// Security invariant (item A): the browser has exactly ONE transport — the Worker `/api/run` SSE stream.
// There is no direct-to-model path. A BYOK key is forwarded to the Worker as an Authorization header and
// resolved server-side (resolveRun); it must NEVER be sent to a model host from the browser.
describe("runWorkerPath — the only browser transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fetchMock(record: { url: string; init: RequestInit | undefined }[]) {
    return vi.fn((url: string | URL, init?: RequestInit) => {
      record.push({ url: String(url), init });
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: "RUN_FINISHED" })}\n\n`)
          );
          c.close();
        },
      });
      return Promise.resolve({ ok: true, body } as unknown as Response);
    });
  }

  it("POSTs to the Worker /api/run and never a model host, forwarding a BYOK key as a Worker header", async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    const mock = fetchMock(seen);
    vi.stubGlobal("fetch", mock);

    const events: AgentEvent[] = [];
    await runWorkerPath(
      "founders-copilot",
      "an idea",
      { apiKey: "sk-secret-key", model: "gpt-x" },
      false,
      (e) => events.push(e),
      new AbortController().signal
    );

    expect(mock).toHaveBeenCalledTimes(1);
    expect(seen[0]?.url).toContain("/api/run?usecase=founders-copilot");
    expect(seen[0]?.url).not.toMatch(/openrouter|api\.openai|googleapis|anthropic/i);
    const headers = seen[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-secret-key"); // key → Worker, resolved server-side
    expect(events.at(-1)?.type).toBe("RUN_FINISHED");
  });

  it("omits the Authorization header on a keyless run", async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    vi.stubGlobal("fetch", fetchMock(seen));
    await runWorkerPath(
      "sort-my-care",
      "SW9 9SL",
      undefined,
      false,
      () => undefined,
      new AbortController().signal
    );
    const headers = seen[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });
});
