import { makeEmitter, exportSpans, MAX_TRACE_SPANS, type Emitter, type Span } from "./trace/arize";
import { withIncorporate } from "./a2ui/cards";
import { registry } from "./workflows";
import { callRenderModel, extractToolArgs, type ToolSpec } from "./agent/model";
import { buildProviders, renderFree, runChain, type Provider } from "./agent/providers";
import { getUsecase, usecaseIds, type UsecaseDef, type RenderDef, type AgentEvent, type StageExec } from "./usecases";
import {
  FOUNDERS_SYSTEM,
  foundersUser,
  ASSESS_STAGE_SYSTEM,
  assessUser,
  SEARCH_SYSTEM,
  searchUser,
} from "../../shared/prompt";
import { ASSESS_STAGE_TOOL, isValidAssessResult, type AssessResult } from "../../shared/assessTool";
import { SEARCH_OPPORTUNITIES_TOOL, isValidSearchResult, type SearchResult, type OpportunityMatch } from "../../shared/searchTool";
import { detectInjection } from "../../shared/guard";
import opportunitiesData from "../../data/demo/opportunities.sample.json";

export interface Env {
  ARIZE_API_KEY?: string;
  ARIZE_SPACE_ID?: string; // with ARIZE_API_KEY, enables the real OTLP export (else console only)
  ARIZE_PROJECT?: string; // OTLP resource service.name
  ALLOWED_ORIGINS?: string;
  OPENROUTER_KEY?: string; // Worker secret; feeds the keyless free chain (:free ids), never a paid call
  AI_GATEWAY_URL?: string; // optional OpenAI-compatible base (Cloudflare AI Gateway); else OpenRouter
  DEFAULT_MODEL?: string;
  PACE_MS?: string; // per-step reveal delay for the keyless path (default 450; set "0" in tests)
  RATE_LIMITER?: RateLimit; // per-IP limiter (wrangler [[ratelimits]]); absent in tests → skipped
  AI?: Ai; // Cloudflare Workers AI binding (first keyless free provider); absent → skipped
  WORKERS_AI_MODEL?: string; // override the default Workers AI model id
  OPENROUTER_FREE_MODEL?: string; // override the OpenRouter :free model (single)
  OPENROUTER_FREE_MODELS?: string; // override the OpenRouter :free fallback list (comma-separated)
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

// Render the card batch, dispatched by the usecase's render mode via the workflows.ts registry.
// Deterministic modes (`route`, `corpus`) build purely from bundled data — meta null (a model-invented
// route or care listing would hallucinate). `founders` is the one model-backed mode: it generates the
// cards grounded in the demo data — a BYOK key calls the chosen model directly (keyed path), otherwise the
// keyless free chain runs; either falls back to the deterministic stub when there's nothing to call or it errors.
// `meta` describes the model that produced a live render (model/provider/usage); null for the canned route
// cards and the deterministic stub. runUsecase reads it to derive the honest mode + accumulate tokens.
interface RenderMeta {
  model: string;
  provider: string;
  usage: { promptTokens?: number | undefined; completionTokens?: number | undefined; totalTokens?: number | undefined };
}

async function renderBatch(
  render: RenderDef,
  emitter: Emitter,
  ctx: ModelCtx,
  matches?: OpportunityMatch[],
  queryData?: unknown
): Promise<{ batch: unknown[]; meta: RenderMeta | null }> {
  // Deterministic modes (route, care, …) build purely from bundled data via the registry — no model,
  // meta null. `founders` is the one model-backed mode (below); its registry entry is the stub/fallback.
  if (render.mode !== "founders") return { batch: registry.render[render.mode](queryData), meta: null };
  const stub = registry.render.founders();
  if (!ctx.key && ctx.providers.length === 0) return { batch: stub, meta: null };
  const ac = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => { ac.abort(); }, 20000);
  try {
    // Ground the render in the model's own ranked matches when search_opportunities produced them;
    // otherwise fall back to the raw pre-scored corpus.
    const grounded = matches && matches.length > 0 ? groundOpps(matches) : opportunitiesData;
    const args = {
      system: FOUNDERS_SYSTEM,
      user: foundersUser(ctx.prompt, grounded),
      signal: ac.signal,
    };
    if (ctx.key) {
      const result = await callRenderModel({ apiKey: ctx.key, model: ctx.model, baseURL: ctx.baseURL, ...args });
      if (!result) return { batch: stub, meta: null };
      emitter.span({ name: "model:openrouter", attrs: { model: result.model, ...result.usage } });
      return { batch: withIncorporate(result.batch), meta: { model: result.model, provider: "openrouter", usage: result.usage } };
    }
    const free = await renderFree(ctx.providers, args);
    if (!free) return { batch: stub, meta: null };
    emitter.span({ name: `model:${free.provider}`, attrs: { model: free.result.model, ...free.result.usage } });
    return {
      batch: withIncorporate(free.result.batch),
      meta: { model: free.result.model, provider: free.provider, usage: free.result.usage },
    };
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
  // Fail closed: reflect the request origin only when it's in the allowlist; otherwise fall back to the
  // first configured origin, or the "null" deny sentinel if ALLOWED_ORIGINS is empty/misconfigured —
  // NEVER "*" (which would grant any origin credentialed-ish read access on a misconfigured deploy).
  const allow = allowed.includes(origin) ? origin : (allowed[0] ?? "null");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    Vary: "Origin",
  };
}

// The keyless free chain, built from whatever bindings/secrets are present (cheapest-first). The
// OpenRouter :free tier walks a fallback list — OPENROUTER_FREE_MODELS (csv) wins, else the single
// OPENROUTER_FREE_MODEL, else the built-in defaults.
function freeChain(env: Env): Provider[] {
  const openRouterFreeModels = env.OPENROUTER_FREE_MODELS
    ? env.OPENROUTER_FREE_MODELS.split(",").map((s) => s.trim()).filter(Boolean)
    : env.OPENROUTER_FREE_MODEL
      ? [env.OPENROUTER_FREE_MODEL]
      : undefined;
  return buildProviders({
    ai: env.AI,
    openRouterKey: env.OPENROUTER_KEY,
    workersAiModel: env.WORKERS_AI_MODEL,
    openRouterFreeModels,
  });
}

// The "run" span's informational model label: the paid model, the free chain, or the stub.
function modelLabel(def: UsecaseDef, key: string, providerCount: number, model: string): string {
  if (def.render.mode !== "founders") return "(stub)";
  if (key) return model;
  return providerCount > 0 ? "free-chain" : "(stub)";
}

// Validate + cap a browser-posted span batch for the /trace forwarder (each element must have a name).
async function readSpans(request: Request): Promise<Span[]> {
  try {
    const body = await request.json<{ spans?: unknown }>();
    const spans: unknown[] = Array.isArray(body.spans) ? body.spans : [];
    return spans
      .filter((s): s is Span => !!s && typeof (s as Span).name === "string")
      .slice(0, MAX_TRACE_SPANS);
  } catch {
    return [];
  }
}

// First non-empty string (an empty "" must fall through to the next default — hence not ??).
const firstNonEmpty = (...vals: (string | undefined)[]): string =>
  vals.find((v) => v !== undefined && v.length > 0) ?? "";

// Parse the optional JSON body (prompt + model), tolerating a missing/invalid one.
async function readRunBody(request: Request): Promise<{ prompt: string; bodyModel: string }> {
  try {
    const body = await request.json<{ prompt?: unknown; model?: unknown }>();
    return {
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      bodyModel: typeof body.model === "string" ? body.model : "",
    };
  } catch {
    return { prompt: "", bodyModel: "" }; // missing/invalid body is fine
  }
}

// Extract a BYOK bearer token from the Authorization header (empty when absent).
function readBearer(request: Request): string {
  const auth = request.headers.get("Authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

// Pace only the pure-stub path so it "streams" like an agent working; a real model path (keyed or free
// chain) is paced by its own latency. Overridable via PACE_MS (tests set "0").
function resolvePace(env: Env, hasModel: boolean): number {
  if (env.PACE_MS !== undefined) return Number(env.PACE_MS);
  return hasModel ? 0 : DEFAULT_PACE_MS;
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
  const { prompt, bodyModel } = await readRunBody(request);
  const byokKey = readBearer(request);
  // Prompt-injection guard: a flagged prompt (or a demo/auto-run) forces the deterministic stub — never
  // worse than today, and page loads / bots can't drive any model.
  const injection = detectInjection(prompt);
  if (injection.flagged) console.warn("guard: prompt-injection flagged →", injection.reason);
  const forceStub = demo || injection.flagged;
  const key = forceStub ? "" : byokKey;
  // Free chain only when there's no BYOK key and we're not forcing the stub.
  const providers = !forceStub && !key ? freeChain(env) : [];
  const modelCtx: ModelCtx = {
    key,
    model: firstNonEmpty(bodyModel, env.DEFAULT_MODEL, FALLBACK_MODEL),
    baseURL: firstNonEmpty(env.AI_GATEWAY_URL, OPENROUTER_BASE),
    prompt,
    providers,
  };
  const runAttrs = {
    usecase: def.id,
    reqId: crypto.randomUUID(),
    model: modelLabel(def, key, providers.length, modelCtx.model),
    byok: byokKey.length > 0,
    blocked: injection.flagged,
    demo, // lets runUsecase tell an explicit DEMO run from a STUB fallback for the USAGE mode
  };
  const paceMs = resolvePace(env, key.length > 0 || providers.length > 0);
  return { modelCtx, runAttrs, paceMs };
}

// Merge the model's ranked matches with the deterministic opportunity facts (title/org/deadline/
// eligibility), ordered by the ranking, so the render draws the model's picks — not the raw corpus. An
// invented id (already rejected by the validator) that somehow slips through is dropped here too.
function groundOpps(matches: OpportunityMatch[]): unknown[] {
  const corpus = opportunitiesData as { id: string }[];
  return matches
    .map((m) => {
      const o = corpus.find((x) => x.id === m.id);
      return o ? { ...o, score: m.score, whyItFits: m.whyItFits, stageFit: m.stageFit } : null;
    })
    .filter((o) => o !== null);
}

interface StageOutcome {
  reasoning: string;
  model: string;
  usage: { promptTokens?: number | undefined; completionTokens?: number | undefined; totalTokens?: number | undefined };
  matches?: OpportunityMatch[];
}

// Run a model-backed stage over the free chain (first valid wins). Returns the structured outcome, or null
// on any miss so the caller plays the canned events instead (never worse than today).
async function runStageModel(exec: StageExec, ctx: ModelCtx, signal: AbortSignal): Promise<StageOutcome | null> {
  if (exec === "assess_stage") {
    const spec: ToolSpec<AssessResult> = {
      tool: ASSESS_STAGE_TOOL,
      toolName: "assess_stage",
      extract: (d) => extractToolArgs(d, "assess_stage") as AssessResult | null,
      validate: isValidAssessResult,
    };
    const r = await runChain(ctx.providers, (p) =>
      p.tryCall(spec, { system: ASSESS_STAGE_SYSTEM, user: assessUser(ctx.prompt), signal })
    );
    return r && { reasoning: r.result.value.reasoning, model: r.result.model, usage: r.result.usage };
  }
  const ids = (opportunitiesData as { id: string }[]).map((o) => o.id);
  const spec: ToolSpec<SearchResult> = {
    tool: SEARCH_OPPORTUNITIES_TOOL,
    toolName: "search_opportunities",
    extract: (d) => extractToolArgs(d, "search_opportunities") as SearchResult | null,
    validate: (v) => isValidSearchResult(v, ids),
  };
  const r = await runChain(ctx.providers, (p) =>
    p.tryCall(spec, { system: SEARCH_SYSTEM, user: searchUser(ctx.prompt, opportunitiesData), signal })
  );
  return (
    r && { reasoning: r.result.value.reasoning, model: r.result.model, usage: r.result.usage, matches: r.result.value.matches }
  );
}

// The terminal HUD event: emitted ONCE per run, immediately before RUN_FINISHED. Carries the honest 3-state
// mode (live | demo | stub), the answering model/provider (live only), and the run's summed token usage.
// useAgentSSE intercepts it in dispatch to drive the status chip — it is never rendered as an A2UI card.
interface UsageEvent extends AgentEvent {
  mode: "live" | "demo" | "stub";
  model?: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface TokenTotals { promptTokens: number; completionTokens: number; totalTokens: number }

// Fold one stage/render usage into the running totals (each field is optional per provider → default 0).
function addUsage(totals: TokenTotals, u?: { promptTokens?: number | undefined; completionTokens?: number | undefined; totalTokens?: number | undefined }): void {
  if (!u) return;
  totals.promptTokens += u.promptTokens ?? 0;
  totals.completionTokens += u.completionTokens ?? 0;
  totals.totalTokens += u.totalTokens ?? 0;
}

// Play a stage's canned events (paced) — the narration for query, plain, and model-fallback stages.
async function playCanned(
  stage: UsecaseDef["stages"][number],
  write: (e: AgentEvent) => void,
  paceMs: number
): Promise<void> {
  for (const e of stage.events) {
    await sleep(paceMs);
    write(e);
  }
}

// Run a model-backed stage under a 20s abort timeout; null on any miss (caller plays canned events).
async function runStageWithTimeout(exec: StageExec, ctx: ModelCtx): Promise<StageOutcome | null> {
  const ac = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => { ac.abort(); }, 20000);
  return runStageModel(exec, ctx, ac.signal).finally(() => { clearTimeout(timer); });
}

// Play one stage and emit its span: a deterministic query stage computes render data then narrates; a
// model-backed stage streams its reasoning (free-chain path) or falls back to canned; a plain stage just
// narrates. Returns any query data / model matches for the render.
async function playStage(
  stage: UsecaseDef["stages"][number],
  ctx: ModelCtx,
  write: (e: AgentEvent) => void,
  emitter: Emitter,
  paceMs: number,
  usage: TokenTotals
): Promise<{ queryData?: unknown; matches?: OpportunityMatch[] }> {
  const t0 = Date.now();
  const queryFn = stage.exec ? registry.query[stage.exec] : undefined;
  if (queryFn) {
    // Deterministic query stage (model-free, fetch-free): compute render data over the bundled corpus, then
    // narrate via the canned events regardless of whether a model provider exists. Awaited so a
    // D1-backed corpus source can slot in at W4 without changing this dispatch.
    const queryData = await queryFn({ prompt: ctx.prompt, corpus: stage.corpus });
    await playCanned(stage, write, paceMs);
    emitter.span({ name: stage.name, attrs: { kind: stage.kind, latencyMs: Date.now() - t0 } });
    return { queryData };
  }
  // Model-backed stage on the keyless free-chain path (ctx.providers is empty when keyed / stub-forced).
  if (stage.exec && ctx.providers.length > 0) {
    const outcome = await runStageWithTimeout(stage.exec, ctx);
    if (outcome) {
      write({ type: "TOOL_CALL_START", text: stage.exec });
      write({ type: "TEXT_MESSAGE_CONTENT", text: outcome.reasoning });
      write({ type: "TOOL_CALL_END", text: stage.exec });
      addUsage(usage, outcome.usage);
      emitter.span({ name: `model:${stage.exec}`, attrs: { model: outcome.model, ...outcome.usage } });
      return outcome.matches ? { matches: outcome.matches } : {};
    }
  }
  // Canned stage (default, or model fallback) — never worse than today.
  await playCanned(stage, write, paceMs);
  emitter.span({ name: stage.name, attrs: { kind: stage.kind, latencyMs: Date.now() - t0 } });
  return {};
}

// The data-driven interpreter: play each stage (a model-backed stage runs its forced tool and streams the
// reasoning + an LLM span; otherwise the canned events play), then render. One span per stage. Exported so
// an arbitrary UsecaseDef can be driven directly in tests ("swap a JSON, swap the app").
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
  let matches: OpportunityMatch[] | undefined;
  let queryData: unknown;
  const usage: TokenTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  for (const stage of def.stages) {
    const r = await playStage(stage, ctx, write, emitter, paceMs, usage);
    if (r.queryData !== undefined) queryData = r.queryData;
    if (r.matches) matches = r.matches;
  }
  await sleep(paceMs);
  const t0 = Date.now();
  const { batch, meta } = await renderBatch(def.render, emitter, ctx, matches, queryData);
  write({ type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: batch });
  emitter.span({ name: "render", attrs: { kind: "render", latencyMs: Date.now() - t0 } });
  addUsage(usage, meta?.usage);
  // Honest 3-state: a live model answered ⇒ "live"; else a deterministic path (explicit ?demo=1 or a
  // canned route usecase) ⇒ "demo"; else the model path was asked for but degraded to the stub ⇒ "stub".
  // Deterministic workflows (route, care, …) are honestly "demo" — nothing degraded; only founders, which
  // asked for a model and got none, is "stub".
  const deterministic = def.render.mode !== "founders";
  const mode: UsageEvent["mode"] = meta ? "live" : runAttrs["demo"] === true || deterministic ? "demo" : "stub";
  const usageEvent: UsageEvent = { type: "USAGE", mode, ...usage };
  if (meta) {
    usageEvent.model = meta.model;
    usageEvent.provider = meta.provider;
  }
  write(usageEvent);
  write({ type: "RUN_FINISHED" });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const isRun = url.pathname === "/api/run";
    const isTrace = url.pathname === "/api/trace";
    if (!isRun && !isTrace) return new Response("Not found", { status: 404, headers: cors });
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    // Per-IP rate-limit (wrangler [[ratelimits]] binding) for both endpoints. Absent in unit tests → skipped.
    if (env.RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return new Response("Too Many Requests", { status: 429, headers: cors });
    }

    // /trace: forward a browser-collected span batch to Arize (keeps ARIZE_API_KEY Worker-only).
    if (isTrace) {
      ctx.waitUntil(exportSpans(env, await readSpans(request)));
      return new Response(null, { status: 202, headers: cors });
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
