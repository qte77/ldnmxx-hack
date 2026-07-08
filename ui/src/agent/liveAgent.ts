import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { A2UIMessageBatchSchema } from "./contract";
import type { AgentEvent } from "./applyA2UIEvent";
import { toConnectionError } from "./useAgentSSE";
import { FOUNDERS_SYSTEM, foundersUser } from "../../../shared/prompt";
import { RENDER_UI_TOOL } from "../../../shared/renderTool";
import { appendIncorporate } from "../../../shared/incorporate";
import opportunitiesData from "../../../data/demo/opportunities.sample.json";

// Browser-BYOK: the founders model call runs DIRECTLY from the browser (the user's key never touches
// our Worker), reusing the SAME shared prompt/tool + the ldnmxx A2UI contract the Worker uses. Ported
// near-verbatim from agenthud's liveAgent. Founders-only, single-turn: it renders the model's raw grants
// (no staged events / no incorporate card — that stays a Worker-side concern; documented tradeoff).

// Any OpenAI-compatible endpoint; BYOK targets OpenRouter (no baseURL field in the UI).
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface LiveSettings {
  apiKey: string;
  model: string;
  baseURL?: string;
}

/** Loose view of an AI SDK v6 `fullStream` part — only the fields we read. */
export interface StreamPart {
  type: string;
  text?: string;
  toolName?: string;
  input?: unknown;
  error?: unknown;
}

/**
 * Pure seam: map one Vercel AI SDK `fullStream` part to the AG-UI event vocabulary the `applyA2UIEvent`
 * render+log seam already consumes (the SAME one the Worker SSE path drives). A completed `render_ui`
 * tool call carries the A2UI batch (re-validated downstream by the contract). Null for parts we skip.
 */
export function streamPartToEvent(part: StreamPart): AgentEvent | null {
  switch (part.type) {
    case "start":
      return { type: "RUN_STARTED" };
    case "text-delta":
      return part.text ? { type: "TEXT_MESSAGE_CONTENT", text: part.text } : null;
    case "tool-input-start":
      return { type: "TOOL_CALL_START", text: part.toolName };
    case "tool-call": {
      if (part.toolName === "render_ui") {
        const messages = (part.input as { messages?: unknown[] } | undefined)?.messages;
        // Append the verified incorporate card so the browser-BYOK founders render matches the Worker's
        // (guarded: only appends when the model's batch has a Column root, else returns it unchanged).
        return {
          type: "TOOL_CALL_END",
          text: part.toolName,
          a2uiMessages: appendIncorporate(Array.isArray(messages) ? messages : []),
        };
      }
      return { type: "TOOL_CALL_END", text: part.toolName };
    }
    case "finish":
      return { type: "RUN_FINISHED" };
    case "error":
      return { type: "RUN_ERROR", text: toConnectionError(part.error) };
    default:
      return null;
  }
}

// The agent's single tool: the zod A2UI contract as inputSchema so the SDK validates (and can repair)
// the model's output — the same schema `applyA2UIEvent` re-validates. Description reused from shared/.
const renderUiInput = z.object({ messages: A2UIMessageBatchSchema });

/**
 * Run a BYOK founders agent in the browser and stream AG-UI events to `onEvent`. Single forced
 * `render_ui` call (toolChoice + stepCountIs(1)) removes the "print the batch as prose" failure.
 */
export async function runLiveAgent(
  settings: LiveSettings,
  prompt: string,
  onEvent: (event: AgentEvent) => void,
  opts?: { signal?: AbortSignal }
): Promise<void> {
  const openai = createOpenAI({
    baseURL: settings.baseURL ?? OPENROUTER_BASE,
    apiKey: settings.apiKey,
  });

  const result = streamText({
    model: openai.chat(settings.model),
    system: FOUNDERS_SYSTEM,
    messages: [{ role: "user", content: foundersUser(prompt, opportunitiesData) }],
    tools: {
      render_ui: tool({
        description: RENDER_UI_TOOL.function.description,
        inputSchema: renderUiInput,
        // The UI is carried by the call arguments; nothing meaningful to return.
        execute: () => "rendered",
      }),
    },
    toolChoice: { type: "tool", toolName: "render_ui" },
    stopWhen: stepCountIs(1),
    // exactOptionalPropertyTypes: only include abortSignal when defined
    ...(opts?.signal ? { abortSignal: opts.signal } : {}),
  });

  for await (const part of result.fullStream) {
    const event = streamPartToEvent(part);
    if (event) onEvent(event);
  }
}
