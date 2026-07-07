import { makeEmitter, type Emitter } from "./trace/arize";
import { buildOpportunityCards, buildRouteCards, withIncorporate } from "./a2ui/cards";
import { callRenderModel } from "./agent/model";
import { buildProviders, renderFree, type Provider } from "./agent/providers";
import { getUsecase, usecaseIds, type UsecaseDef, type RenderDef, type AgentEvent } from "./usecases";
import { FOUNDERS_SYSTEM, foundersUser } from "../../shared/prompt";
import { detectInjection } from "../../shared/guard";
import opportunitiesData from "../../data/demo/opportunities.sample.json";

export interface Env {
  ARIZE_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  OPENROUTER_KEY?: string; // Worker secret; feeds the keyless free chain (:free ids), never a paid call
  AI_GATEWAY_URL?: string; // optional OpenAI-compatible base (Cloudflare AI Gateway); else OpenRouter
  DEFAULT_MODEL?: string;
  PACE_MS?: string; // per-step reveal delay for the keyless path (default 450; set "0" in tests)
  RATE_LIMITER?: RateLimit; // per-IP limiter (wrangler [[ratelimits]]); absent in tests → skipped
  AI?: Ai; // Cloudflare Workers AI binding (first keyless free provider); absent → skipped
  GITHUB_MODELS_TOKEN?: string; // GitHub Models free-tier token (last free provider; retires 2026-07-30)
  WORKERS_AI_MODEL?: string; // override the default Workers AI model id
  OPENROUTER_FREE_MODEL?: string; // override the default OpenRouter :free model id
  GITHUB_MODEL?: string; // override the default GitHub Models model id
}

interface ModelCtx {
  key: string; // BYOK paid key (Authorization header) → keyed path; empty ⇒ keyless free chain / stub
  model: string;
  baseURL: string;
  prompt: string;
  providers: Provider[]; // keyless free chain (empty when keyed or forcing the stub)
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const FALLBACK_MODEL = "anthropic/claude-haiku-4.5";
const DEFAULT_PACE_MS = 450;

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

// Render the card batch, dispatched by the usecase's render mode. `route` stays canned (a model-invented
// step-free route would hallucinate; real routing is Phase 3). `founders` generates the cards grounded in
// the demo data: a BYOK key calls the chosen model directly (keyed path), otherwise the keyless free
// chain runs; either falls back to the deterministic stub when there's nothing to call or it errors.
async function renderBatch(render: RenderDef, emitter: Emitter, ctx: ModelCtx): Promise<unknown[]> {
  if (render.mode === "route") return buildRouteCards();
  const stub = withIncorporate(buildOpportunityCards());
  if (!ctx.key && ctx.providers.length === 0) return stub;
  const ac = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => { ac.abort(); }, 20000);
  try {
    const args = {
      system: FOUNDERS_SYSTEM,
      user: foundersUser(ctx.prompt, opportunitiesData),
      signal: ac.signal,
    };
    if (ctx.key) {
      const result = await callRenderModel({ apiKey: ctx.key, model: ctx.model, baseURL: ctx.baseURL, ...args });
      if (!result) return stub;
      emitter.span({ name: "model:openrouter", attrs: { model: result.model, ...result.usage } });
      return withIncorporate(result.batch);
    }
    const free = await renderFree(ctx.providers, args);
    if (!free) return stub;
    emitter.span({ name: `model:${free.provider}`, attrs: { model: free.result.model, ...free.result.usage } });
    return withIncorporate(free.result.batch);
  } finally {
    clearTimeout(timer);
  }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const allow = allowed.includes(origin) ? origin : (allowed[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    Vary: "Origin",
  };
}

// Resolve model access + the span attrs + pacing. Keyed (paid) path = a BYOK header only; our
// OPENROUTER_KEY feeds the keyless free chain (:free ids) instead of a paid call, so the Worker never
// spends. A demo/auto-run or a flagged prompt forces the deterministic stub.
async function resolveRun(
  request: Request,
  env: Env,
  def: UsecaseDef,
  demo: boolean
): Promise<{ modelCtx: ModelCtx; runAttrs: Record<string, unknown>; paceMs: number }> {
  let prompt = "";
  let bodyModel = "";
  try {
    const body = (await request.json()) as { prompt?: string; model?: string };
    prompt = body.prompt ?? "";
    bodyModel = body.model ?? "";
  } catch {
    // missing/invalid body is fine
  }
  const auth = request.headers.get("Authorization") ?? "";
  const byokKey = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  // Prompt-injection guard: a flagged prompt (or a demo/auto-run) forces the deterministic stub — never
  // worse than today, and page loads / bots can't drive any model.
  const injection = detectInjection(prompt);
  if (injection.flagged) console.warn("guard: prompt-injection flagged →", injection.reason);
  const forceStub = demo || injection.flagged;
  const key = forceStub ? "" : byokKey;
  // Free chain: only when there's no BYOK key and we're not forcing the stub. Built from whatever
  // bindings/secrets are present (Workers AI → OpenRouter :free → GitHub Models), cheapest-first.
  const providers =
    !forceStub && !key
      ? buildProviders({
          ai: env.AI,
          openRouterKey: env.OPENROUTER_KEY,
          githubToken: env.GITHUB_MODELS_TOKEN,
          workersAiModel: env.WORKERS_AI_MODEL,
          openRouterFreeModel: env.OPENROUTER_FREE_MODEL,
          githubModel: env.GITHUB_MODEL,
        })
      : [];
  const modelCtx: ModelCtx = {
    key,
    model: bodyModel || env.DEFAULT_MODEL || FALLBACK_MODEL,
    baseURL: env.AI_GATEWAY_URL || OPENROUTER_BASE,
    prompt,
    providers,
  };
  const runAttrs = {
    usecase: def.id,
    reqId: crypto.randomUUID(),
    model:
      def.render.mode !== "founders" ? "(stub)" : key ? modelCtx.model : providers.length ? "free-chain" : "(stub)",
    byok: byokKey.length > 0,
    blocked: injection.flagged,
  };
  // Pace the pure-stub path so it "streams" like an agent working; a real model path (keyed or free
  // chain) is paced by its own latency. Overridable via PACE_MS (tests set "0").
  const realModel = key.length > 0 || providers.length > 0;
  const paceMs = env.PACE_MS !== undefined ? Number(env.PACE_MS) : realModel ? 0 : DEFAULT_PACE_MS;
  return { modelCtx, runAttrs, paceMs };
}

// The data-driven interpreter: play each stage's events (paced) with one span per stage, then render.
// Exported so an arbitrary UsecaseDef can be driven directly in tests ("swap a JSON, swap the app").
export async function runUsecase(
  def: UsecaseDef,
  emitter: Emitter,
  write: (e: AgentEvent) => void,
  runAttrs: Record<string, unknown>,
  ctx: ModelCtx,
  paceMs: number
): Promise<void> {
  emitter.span({ name: "run", attrs: runAttrs });
  write({ type: "RUN_STARTED" });
  for (const stage of def.stages) {
    const t0 = Date.now();
    for (const e of stage.events) {
      await sleep(paceMs);
      write(e);
    }
    emitter.span({ name: stage.span, attrs: { kind: stage.kind, latencyMs: Date.now() - t0 } });
  }
  await sleep(paceMs);
  const t0 = Date.now();
  const batch = await renderBatch(def.render, emitter, ctx);
  write({ type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: batch });
  emitter.span({ name: "render", attrs: { kind: "render", latencyMs: Date.now() - t0 } });
  write({ type: "RUN_FINISHED" });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== "/run") return new Response("Not found", { status: 404, headers: cors });
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    // Per-IP rate-limit (wrangler [[ratelimits]] binding). Absent in unit tests → skipped.
    if (env.RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return new Response("Too Many Requests", { status: 429, headers: cors });
    }

    const usecase = url.searchParams.get("usecase") ?? "";
    const def = getUsecase(usecase);
    if (!def) {
      return new Response(
        JSON.stringify({ error: `unknown usecase: ${usecase || "(none)"}; valid: ${usecaseIds.join(", ")}` }),
        { status: 400, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    const demo = url.searchParams.get("demo") === "1";
    const { modelCtx, runAttrs, paceMs } = await resolveRun(request, env, def, demo);
    const emitter = makeEmitter(env);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (e: AgentEvent): void => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        };
        await runUsecase(def, emitter, write, runAttrs, modelCtx, paceMs);
        controller.close();
      },
    });
    ctx.waitUntil(emitter.flush());

    return new Response(stream, {
      status: 200,
      headers: {
        ...cors,
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  },
};
