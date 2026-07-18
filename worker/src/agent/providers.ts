// Keyless free-fallback chain: try each provider in order, first VALID tool result wins; null if none
// produce one (caller → deterministic fallback). Generic over the tool (a ToolSpec): render_ui, plus the
// Phase-2 assess_stage / search_opportunities stages all run through the SAME plumbing, each reusing its
// dependency-free validator so a malformed/empty/errored result from any tier just falls through — never
// worse than the fallback. The chain is built only from bindings/secrets present, cheapest-first
// (Cloudflare Workers AI → OpenRouter :free using our key → GitHub Models). No spend on our part: Workers
// AI is free, OpenRouter runs :free model ids, GitHub Models is free-tier (retires 2026-07-30). The
// OpenRouter tier walks a LIST of :free models (they rate-limit / rotate), logging each fall-through for
// `wrangler tail`; the winning model id lands in the span's `model` attr.

import { RENDER_UI_TOOL, isSelfContainedBatch } from "../../../shared/renderTool";
import {
  callModelTool,
  extractBatch,
  type ModelResult,
  type ModelToolResult,
  type ORResponse,
  type ToolSpec,
} from "./model";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GITHUB_MODELS_BASE = "https://models.github.ai/inference"; // OpenAI-compatible; retires 2026-07-30

// Defaults are tuning knobs (overridable via env) — the guard makes a wrong pick non-fatal (falls through).
export const DEFAULT_WORKERS_AI_MODEL = "@cf/openai/gpt-oss-120b"; // verified 2026-07-08; @cf/zai-org/glm-4.7-flash hits capacity 429
export const DEFAULT_GITHUB_MODEL = "openai/gpt-4o-mini";
// A LIST of currently-live free + tool-capable OpenRouter models (verified 2026-07-08). :free models
// rate-limit (HTTP 429) and rotate often, so we fall through several before giving up to the next tier.
export const DEFAULT_OPENROUTER_FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export interface CallArgs {
  system: string;
  user: string;
  signal?: AbortSignal;
}

// The render_ui spec: force render_ui, pull the batch, structurally validate self-containment.
export const RENDER_SPEC: ToolSpec<unknown[]> = {
  tool: RENDER_UI_TOOL,
  toolName: "render_ui",
  extract: extractBatch,
  validate: isSelfContainedBatch,
};

export interface Provider {
  name: string; // span suffix → model:<name>
  // Generic core: run any forced tool through this provider.
  tryCall<T>(spec: ToolSpec<T>, args: CallArgs): Promise<ModelToolResult<T> | null>;
  // Render specialisation (value → batch), kept for the render caller + its tests.
  tryRender(args: CallArgs): Promise<ModelResult | null>;
}

const usageOf = (out: ORResponse): ModelResult["usage"] => ({
  promptTokens: out.usage?.prompt_tokens,
  completionTokens: out.usage?.completion_tokens,
  totalTokens: out.usage?.total_tokens,
});

// value → batch, so tryRender/renderFree keep returning ModelResult (worker renderBatch is unchanged).
const asRender = (r: ModelToolResult<unknown[]> | null): ModelResult | null =>
  r && { batch: r.value, model: r.model, usage: r.usage };

// Cloudflare Workers AI (free, no key) via the AI binding. Use a ChatCompletions-typed model so the output
// matches the OpenAI tool-call shape (choices[0].message.tool_calls[0].function.arguments).
export function workersAiProvider(ai: Ai, model: string = DEFAULT_WORKERS_AI_MODEL): Provider {
  const tryCall = async <T>(spec: ToolSpec<T>, { system, user, signal }: CallArgs): Promise<ModelToolResult<T> | null> => {
    try {
      // Bind to `ai` — the binding's run() uses private fields (this.#options), so a detached call throws
      // "Cannot set properties of undefined (setting '#options')". (Unit tests use a plain fn, so they miss it.)
      const run = (ai.run as unknown as (
        m: string,
        inputs: unknown,
        options?: { signal?: AbortSignal }
      ) => Promise<unknown>).bind(ai);
      const out = (await run(
        model,
        {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          tools: [spec.tool],
          tool_choice: { type: "function", function: { name: spec.toolName } },
          temperature: 0.2,
          max_tokens: 8000,
        },
        { signal }
      )) as ORResponse;
      const value = spec.extract(out);
      if (value == null || !spec.validate(value)) return null;
      return { value, model, usage: usageOf(out) };
    } catch {
      return null;
    }
  };
  return { name: "workers-ai", tryCall, tryRender: (args) => tryCall(RENDER_SPEC, args).then(asRender) };
}

// OpenRouter restricted to :free model ids — uses our OPENROUTER_KEY but never spends. Walks the model list
// (first valid result wins), logging each fall-through for `wrangler tail`; the winning model id rides back
// in ModelToolResult.model → the span's `model` attr.
export function openRouterFreeProvider(
  key: string,
  models: string[] = DEFAULT_OPENROUTER_FREE_MODELS
): Provider {
  const tryCall = async <T>(spec: ToolSpec<T>, { system, user, signal }: CallArgs): Promise<ModelToolResult<T> | null> => {
    for (const model of models) {
      const result = await callModelTool<T>({ apiKey: key, model, baseURL: OPENROUTER_BASE, system, user, signal, ...spec });
      if (result) return result;
      console.warn("openrouter-free: fell through", model);
    }
    return null;
  };
  return { name: "openrouter-free", tryCall, tryRender: (args) => tryCall(RENDER_SPEC, args).then(asRender) };
}

// GitHub Models (free tier), OpenAI-compatible, called server-side. Last in the chain; the service retires
// 2026-07-30, after which it 404s and simply falls through — drop it then.
export function githubModelsProvider(token: string, model: string = DEFAULT_GITHUB_MODEL): Provider {
  const tryCall = <T>(spec: ToolSpec<T>, { system, user, signal }: CallArgs): Promise<ModelToolResult<T> | null> =>
    callModelTool<T>({ apiKey: token, model, baseURL: GITHUB_MODELS_BASE, system, user, signal, ...spec });
  return { name: "github-models", tryCall, tryRender: (args) => tryCall(RENDER_SPEC, args).then(asRender) };
}

// Generic first-valid-wins chain: run `call` on each provider until one returns non-null; returns which
// provider won so the caller can span model:<name>.
export async function runChain<T>(
  providers: Provider[],
  call: (p: Provider) => Promise<T | null>
): Promise<{ result: T; provider: string } | null> {
  for (const p of providers) {
    const result = await call(p);
    if (result) return { result, provider: p.name };
  }
  return null;
}

// Render specialisation of runChain: first provider to return a valid batch wins.
export function renderFree(
  providers: Provider[],
  args: CallArgs
): Promise<{ result: ModelResult; provider: string } | null> {
  return runChain(providers, (p) => p.tryRender(args));
}

// Build the chain from whatever bindings/secrets are present, cheapest-first.
export function buildProviders(opts: {
  ai?: Ai;
  openRouterKey?: string;
  githubToken?: string;
  workersAiModel?: string;
  openRouterFreeModels?: string[];
  githubModel?: string;
}): Provider[] {
  const list: Provider[] = [];
  if (opts.ai) list.push(workersAiProvider(opts.ai, opts.workersAiModel ?? DEFAULT_WORKERS_AI_MODEL));
  if (opts.openRouterKey)
    list.push(openRouterFreeProvider(opts.openRouterKey, opts.openRouterFreeModels ?? DEFAULT_OPENROUTER_FREE_MODELS));
  if (opts.githubToken) list.push(githubModelsProvider(opts.githubToken, opts.githubModel ?? DEFAULT_GITHUB_MODEL));
  return list;
}
