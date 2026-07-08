import { describe, it, expect } from "vitest";
import { streamPartToEvent } from "../src/agent/liveAgent";

// The load-bearing seam: AI SDK fullStream part → AG-UI event vocabulary that applyA2UIEvent consumes.
describe("streamPartToEvent", () => {
  it("maps start → RUN_STARTED and finish → RUN_FINISHED", () => {
    expect(streamPartToEvent({ type: "start" })).toEqual({ type: "RUN_STARTED" });
    expect(streamPartToEvent({ type: "finish" })).toEqual({ type: "RUN_FINISHED" });
  });

  it("maps a non-empty text-delta to TEXT_MESSAGE_CONTENT, and skips an empty one", () => {
    expect(streamPartToEvent({ type: "text-delta", text: "hi" })).toEqual({
      type: "TEXT_MESSAGE_CONTENT",
      text: "hi",
    });
    expect(streamPartToEvent({ type: "text-delta", text: "" })).toBeNull();
  });

  it("maps tool-input-start to TOOL_CALL_START with the tool name", () => {
    expect(streamPartToEvent({ type: "tool-input-start", toolName: "render_ui" })).toEqual({
      type: "TOOL_CALL_START",
      text: "render_ui",
    });
  });

  it("carries the A2UI batch on a completed render_ui tool call", () => {
    const messages = [{ beginRendering: { surfaceId: "main", root: "root" } }];
    expect(streamPartToEvent({ type: "tool-call", toolName: "render_ui", input: { messages } })).toEqual({
      type: "TOOL_CALL_END",
      text: "render_ui",
      a2uiMessages: messages,
    });
  });

  it("appends the verified incorporate card when the render_ui batch has a Column root", () => {
    const messages = [
      { beginRendering: { surfaceId: "main", root: "root" } },
      {
        surfaceUpdate: {
          surfaceId: "main",
          components: [
            { id: "root", component: { Column: { children: { explicitList: ["card-x"] } } } },
            { id: "card-x", component: { Card: { child: "t-x" } } },
            { id: "t-x", component: { Text: { text: { literalString: "hi" }, usageHint: "h3" } } },
          ],
        },
      },
    ];
    const ev = streamPartToEvent({ type: "tool-call", toolName: "render_ui", input: { messages } });
    const json = JSON.stringify(ev?.a2uiMessages);
    expect(json).toContain("card-incorporate");
    expect(json).toContain("https://www.gov.uk/set-up-limited-company");
  });

  it("defaults a render_ui call with no messages to an empty batch", () => {
    expect(streamPartToEvent({ type: "tool-call", toolName: "render_ui", input: {} })).toEqual({
      type: "TOOL_CALL_END",
      text: "render_ui",
      a2uiMessages: [],
    });
  });

  it("maps a non-render tool call to a bare TOOL_CALL_END", () => {
    expect(streamPartToEvent({ type: "tool-call", toolName: "other" })).toEqual({
      type: "TOOL_CALL_END",
      text: "other",
    });
  });

  it("maps error → RUN_ERROR with a friendlier connection message", () => {
    const ev = streamPartToEvent({ type: "error", error: new Error("Failed to fetch") });
    expect(ev?.type).toBe("RUN_ERROR");
    expect(ev?.text).toContain("Failed to fetch");
    expect(ev?.text).toContain("blocked or could not connect");
  });

  it("returns null for parts it does not surface", () => {
    expect(streamPartToEvent({ type: "tool-input-delta" })).toBeNull();
  });
});
