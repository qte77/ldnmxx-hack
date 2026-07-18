// Server-side forced-tool model calls: the model answers by calling a single forced tool (e.g. `render_ui`,
// `assess_stage`, `search_opportunities`), grounded in the provided data. Hand-rolled OpenAI-compatible
// fetch (no SDK) to stay light on Workers. `callModelTool` is the generic core (any tool + extractor +
// validator); `callRenderModel` is the render_ui wrapper. Every call returns a validated value + usage, or
// null on ANY failure so the caller falls back to its deterministic default — the demo can never break.

import { RENDER_UI_TOOL, isSelfContainedBatch } from "../../../shared/renderTool";

export interface ModelCall {
  apiKey: string;
  model: string;
  baseURL: string; // OpenAI-compatible base, e.g. https://openrouter.ai/api/v1
  system: string;
  user: string;
  signal?: AbortSignal;
}
export interface ModelResult {
  batch: unknown[];
  model: string;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}
// Generic forced-tool result: the parsed + validated tool arguments as `value`, plus the model id and
// usage. ModelResult (render) is the `value = batch` specialisation, kept for the existing render callers.
export interface ModelToolResult<T> {
  value: T;
  model: string;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

// The OpenAI-compatible chat-completions response shape we consume (OpenRouter, GitHub Models, and —
// same shape — Cloudflare Workers AI's ChatCompletions output).
export interface ORResponse {
  choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

// Pull the named tool's parsed arguments object out of an OpenAI-compatible tool-call response. Null if the
// first tool call is absent, is a different tool, or has non-JSON arguments.
export function extractToolArgs(data: ORResponse, toolName: string): Record<string, unknown> | null {
  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call) return null;
  if (call.name !== toolName || typeof call.arguments !== "string") return null;
  try {
    return JSON.parse(call.arguments) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Pull the render_ui batch (its `messages` array) out of a tool-call response. Null if absent/malformed.
export function extractBatch(data: ORResponse): unknown[] | null {
  const args = extractToolArgs(data, "render_ui");
  return args && Array.isArray(args.messages) ? (args.messages as unknown[]) : null;
}

// Structural self-containment guard, extracted to dependency-free shared/renderTool so both the Worker
// and the browser-BYOK path validate identically. Re-exported under the original name so callers
// and worker/test/model.test.ts keep importing `isValidBatch` from here.
export const isValidBatch = isSelfContainedBatch;

// A forced tool + how to pull and validate its structured output. Reused by callModelTool and every
// provider (render_ui, assess_stage, search_opportunities, …) so one plumbing runs any tool.
export interface ToolSpec<T> {
  tool: unknown; // JSON tool schema, e.g. RENDER_UI_TOOL
  toolName: string; // forced tool_choice name + the arguments key to extract
  extract: (data: ORResponse) => T | null;
  validate: (value: T) => boolean;
}

// Generic forced-tool call: POST a single forced tool_choice, then extract + validate its arguments.
// Returns the validated value + usage, or null on ANY failure (HTTP, no/empty tool call, invalid, throw) so
// the caller falls back to its deterministic default. `callRenderModel` and the provider chain build on it.
export async function callModelTool<T>(opts: ModelCall & ToolSpec<T>): Promise<ModelToolResult<T> | null> {
  try {
    const res = await fetch(`${opts.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        "content-type": "application/json",
        "x-title": "Groundwork",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        tools: [opts.tool],
        tool_choice: { type: "function", function: { name: opts.toolName } },
        temperature: 0.2,
        max_tokens: 8000, // tool JSON can be large (esp. the A2UI batch); too low truncates it → fallback
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      console.warn("model fallback: HTTP", res.status);
      return null;
    }
    const data = await res.json<ORResponse>();
    const value = opts.extract(data);
    if (value == null) {
      console.warn(`model fallback: no/empty ${opts.toolName} tool call (raise max_tokens if truncated)`);
      return null;
    }
    if (!opts.validate(value)) {
      console.warn(`model fallback: invalid ${opts.toolName} result`);
      return null;
    }
    return {
      value,
      model: opts.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  } catch {
    return null; // network error, timeout (AbortSignal), bad JSON — caller uses its default
  }
}

// The render_ui specialisation: force render_ui, extract the batch, structurally validate self-containment.
export async function callRenderModel(opts: ModelCall): Promise<ModelResult | null> {
  const r = await callModelTool<unknown[]>({
    ...opts,
    tool: RENDER_UI_TOOL,
    toolName: "render_ui",
    extract: extractBatch,
    validate: isValidBatch,
  });
  return r && { batch: r.value, model: r.model, usage: r.usage };
}
