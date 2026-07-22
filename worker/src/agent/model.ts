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
  signal?: AbortSignal | undefined;
  retryBackoffMs?: number | undefined; // base backoff for the one transient retry (default 250; tests pass 0)
}
export interface ModelResult {
  batch: unknown[];
  model: string;
  usage: { promptTokens?: number | undefined; completionTokens?: number | undefined; totalTokens?: number | undefined };
}
// Generic forced-tool result: the parsed + validated tool arguments as `value`, plus the model id and
// usage. ModelResult (render) is the `value = batch` specialisation, kept for the existing render callers.
export interface ModelToolResult<T> {
  value: T;
  model: string;
  usage: { promptTokens?: number | undefined; completionTokens?: number | undefined; totalTokens?: number | undefined };
}

// The OpenAI-compatible chat-completions response shape we consume (OpenRouter :free/BYOK, and —
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
  return args && Array.isArray(args["messages"]) ? (args["messages"] as unknown[]) : null;
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

// Transient HTTP statuses worth ONE retry (rate-limit + transient server errors). Everything else is
// fatal — fail fast with one concise warn (401/407 auth, 404/410 gone, 451 legal, …).
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

// A short human label for an HTTP status, so the fallback warn says WHY (aligns azure core/errors +
// polyfetch-scrape's typed taxonomy). Used in the single console.warn — never surfaced to the user.
export function describeModelStatus(status: number): string {
  if (status === 429) return "rate-limited";
  if (status === 401 || status === 407) return "auth";
  if (status === 404 || status === 410) return "gone";
  if (status === 451) return "legal";
  if (status >= 500) return "server";
  return "http";
}

// Honor a `Retry-After` header when present: delta-seconds only (HTTP-date form is ignored), capped at
// 60 s so a hostile header can't stall the Worker's render budget. Null ⇒ use the default backoff.
export function retryAfterMs(header: string | null): number | null {
  if (header === null) return null;
  const secs = Number(header);
  if (!Number.isFinite(secs) || secs < 0) return null;
  return Math.min(secs, 60) * 1000;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

// Retry ONLY a transient HTTP status, only while attempts remain, and never once the caller aborted.
function shouldRetryStatus(status: number, attempt: number, maxAttempts: number, signal?: AbortSignal): boolean {
  return TRANSIENT_STATUSES.has(status) && attempt < maxAttempts && signal?.aborted !== true;
}

// Parse + validate a 2xx tool-call body into the typed result, or null (with a concise warn) if the
// model returned no/empty/invalid tool arguments. Extracted so callModelTool stays within complexity.
async function processToolResponse<T>(
  res: Response,
  opts: ToolSpec<T> & { model: string }
): Promise<ModelToolResult<T> | null> {
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
}

// Generic forced-tool call: POST a single forced tool_choice, then extract + validate its arguments.
// Returns the validated value + usage, or null on ANY failure (HTTP, no/empty tool call, invalid, throw) so
// the caller falls back to its deterministic default. `callRenderModel` and the provider chain build on it.
//
// Robustness (H3/H4): ONE bounded retry on a transient HTTP status (429/5xx) — the Worker render has a
// ~20 s abort budget and the free tier walks ≤6 models, so the retry stays small. A thrown fetch
// (network error, or an AbortSignal timeout) is NEVER retried; the `| null` fallback contract is
// unchanged (callers rely on null = fallback), the retry is purely internal.
export async function callModelTool<T>(opts: ModelCall & ToolSpec<T>): Promise<ModelToolResult<T> | null> {
  const maxAttempts = 2; // one retry
  const baseBackoff = opts.retryBackoffMs ?? 250;
  const init: RequestInit = {
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
    signal: opts.signal ?? null,
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${opts.baseURL}/chat/completions`, init);
      if (res.ok) return await processToolResponse(res, opts);
      const label = describeModelStatus(res.status);
      if (shouldRetryStatus(res.status, attempt, maxAttempts, opts.signal)) {
        const delay = retryAfterMs(res.headers.get("retry-after")) ?? baseBackoff;
        console.warn(`model retry: ${label} (HTTP ${String(res.status)}), attempt ${String(attempt)}/${String(maxAttempts)}`);
        await sleep(delay, opts.signal);
        continue;
      }
      console.warn(`model fallback: ${label} (HTTP ${String(res.status)})`);
      return null;
    } catch {
      return null; // network error, timeout (AbortSignal), bad JSON — caller uses its default, no retry
    }
  }
  return null; // exhausted the transient retry
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
