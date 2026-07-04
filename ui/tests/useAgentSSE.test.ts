import { describe, it, expect, vi } from "vitest";
import { parseSSE } from "../src/agent/useAgentSSE";
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
