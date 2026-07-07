// Keyless free-fallback render chain: try each provider in order, first VALID render_ui batch wins;
// null if none produce one (caller → deterministic stub). Every provider reuses the shared render tool +
// structural validator, so a malformed/empty/errored batch from any tier just falls through — never
// worse than the stub. The chain is built only from the bindings/secrets actually present, cheapest-first
// (Cloudflare Workers AI → OpenRouter :free using our key → GitHub Models → stub). No spend on our part:
// Workers AI is free, OpenRouter runs :free model ids, GitHub Models is free-tier (and retires 2026-07-30).

import { RENDER_UI_TOOL, isSelfContainedBatch } from "../../../shared/renderTool";
import { callRenderModel, extractBatch, type ModelResult, type ORResponse } from "./model";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GITHUB_MODELS_BASE = "https://models.github.ai/inference"; // OpenAI-compatible; retires 2026-07-30

// Defaults are tuning knobs (overridable via env) — the guard makes a wrong pick non-fatal (falls through).
export const DEFAULT_WORKERS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
export const DEFAULT_OPENROUTER_FREE_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
export const DEFAULT_GITHUB_MODEL = "openai/gpt-4o-mini";

export interface RenderArgs {
  system: string;
  user: string;
  signal?: AbortSignal;
}
export interface Provider {
  name: string; // span suffix → model:<name>
  tryRender(args: RenderArgs): Promise<ModelResult | null>;
}

// Cloudflare Workers AI (free, no key) via the AI binding. Use a ChatCompletions-typed model so the
// output matches the OpenAI tool-call shape (choices[0].message.tool_calls[0].function.arguments).
export function workersAiProvider(ai: Ai, model: string = DEFAULT_WORKERS_AI_MODEL): Provider {
  return {
    name: "workers-ai",
    async tryRender({ system, user, signal }) {
      try {
        const run = ai.run as unknown as (
          m: string,
          inputs: unknown,
          options?: { signal?: AbortSignal }
        ) => Promise<unknown>;
        const out = (await run(
          model,
          {
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            tools: [RENDER_UI_TOOL],
            tool_choice: { type: "function", function: { name: "render_ui" } },
            temperature: 0.2,
            max_tokens: 8000,
          },
          { signal }
        )) as ORResponse;
        return toResult(out, model);
      } catch {
        return null;
      }
    },
  };
}

// OpenRouter restricted to a :free model id — uses our OPENROUTER_KEY but never spends. Reuses the
// hand-rolled OpenAI-compatible fetch (callRenderModel already extracts + validates + returns usage).
export function openRouterFreeProvider(key: string, model: string = DEFAULT_OPENROUTER_FREE_MODEL): Provider {
  return {
    name: "openrouter-free",
    tryRender: ({ system, user, signal }) =>
      callRenderModel({ apiKey: key, model, baseURL: OPENROUTER_BASE, system, user, signal }),
  };
}

// GitHub Models (free tier), OpenAI-compatible, called server-side. Last in the chain; the service
// retires 2026-07-30, after which it 404s and simply falls through to the stub — drop it then.
export function githubModelsProvider(token: string, model: string = DEFAULT_GITHUB_MODEL): Provider {
  return {
    name: "github-models",
    tryRender: ({ system, user, signal }) =>
      callRenderModel({ apiKey: token, model, baseURL: GITHUB_MODELS_BASE, system, user, signal }),
  };
}

// extract → structural-validate → usage for the binding-based provider (fetch providers use callRenderModel).
function toResult(out: ORResponse, model: string): ModelResult | null {
  const batch = extractBatch(out);
  if (!batch || !isSelfContainedBatch(batch)) return null;
  return {
    batch,
    model,
    usage: {
      promptTokens: out.usage?.prompt_tokens,
      completionTokens: out.usage?.completion_tokens,
      totalTokens: out.usage?.total_tokens,
    },
  };
}

// First provider to return a valid batch wins; returns which one so the caller can span model:<name>.
export async function renderFree(
  providers: Provider[],
  args: RenderArgs
): Promise<{ result: ModelResult; provider: string } | null> {
  for (const p of providers) {
    const result = await p.tryRender(args);
    if (result) return { result, provider: p.name };
  }
  return null;
}

// Build the chain from whatever bindings/secrets are present, cheapest-first.
export function buildProviders(opts: {
  ai?: Ai;
  openRouterKey?: string;
  githubToken?: string;
  workersAiModel?: string;
  openRouterFreeModel?: string;
  githubModel?: string;
}): Provider[] {
  const list: Provider[] = [];
  if (opts.ai) list.push(workersAiProvider(opts.ai, opts.workersAiModel || DEFAULT_WORKERS_AI_MODEL));
  if (opts.openRouterKey)
    list.push(openRouterFreeProvider(opts.openRouterKey, opts.openRouterFreeModel || DEFAULT_OPENROUTER_FREE_MODEL));
  if (opts.githubToken) list.push(githubModelsProvider(opts.githubToken, opts.githubModel || DEFAULT_GITHUB_MODEL));
  return list;
}
