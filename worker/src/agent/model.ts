// Server-side render-stage model call: the model emits the A2UI card batch via a forced `render_ui`
// tool, grounded in the provided data. Hand-rolled OpenAI-compatible fetch (no SDK) to stay light on
// Workers. Returns a validated batch + usage, or null on ANY failure so the caller falls back to the
// deterministic stub — the demo can never break.

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

interface ORResponse {
  choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

// Pull the render_ui batch out of an OpenAI-compatible tool-call response. Null if absent/malformed.
export function extractBatch(data: ORResponse): unknown[] | null {
  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call || call.name !== "render_ui" || typeof call.arguments !== "string") return null;
  try {
    const args = JSON.parse(call.arguments) as { messages?: unknown };
    return Array.isArray(args.messages) ? args.messages : null;
  } catch {
    return null;
  }
}

// Structural self-containment guard, extracted to dependency-free shared/renderTool so both the Worker
// and the browser-BYOK path (PR-4) validate identically. Re-exported under the original name so callers
// and worker/test/model.test.ts keep importing `isValidBatch` from here.
export const isValidBatch = isSelfContainedBatch;

export async function callRenderModel(opts: ModelCall): Promise<ModelResult | null> {
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
        tools: [RENDER_UI_TOOL],
        tool_choice: { type: "function", function: { name: "render_ui" } },
        temperature: 0.2,
        max_tokens: 8000, // the A2UI batch is a large JSON; too low truncates the tool call → fallback
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      console.warn("model fallback: HTTP", res.status);
      return null;
    }
    const data = (await res.json()) as ORResponse;
    const batch = extractBatch(data);
    if (!batch) {
      console.warn("model fallback: no/empty render_ui tool call (raise max_tokens if truncated)");
      return null;
    }
    if (!isValidBatch(batch)) {
      console.warn("model fallback: invalid batch");
      return null;
    }
    return {
      batch,
      model: opts.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  } catch {
    return null; // network error, timeout (AbortSignal), bad JSON — caller uses the stub
  }
}
