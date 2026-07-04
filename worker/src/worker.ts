import { makeEmitter, type Emitter } from "./trace/arize";
import { buildOpportunityCards, buildRouteCards } from "./a2ui/cards";
import { callRenderModel, A2UI_RULES } from "./agent/model";
import opportunitiesData from "../../data/demo/opportunities.sample.json";

export interface Env {
  ARIZE_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  OPENROUTER_KEY?: string; // Worker secret; the keyless default falls back to the stub
  AI_GATEWAY_URL?: string; // optional OpenAI-compatible base (Cloudflare AI Gateway); else OpenRouter
  DEFAULT_MODEL?: string;
  PACE_MS?: string; // per-step reveal delay for the keyless path (default 450; set "0" in tests)
}

interface AgentEvent {
  type: string;
  text?: string;
  a2uiMessages?: unknown[];
}
interface StageDef {
  span: string;
  kind: string;
  events: AgentEvent[];
}
interface ModelCtx {
  key: string;
  model: string;
  baseURL: string;
  prompt: string;
}

const USECASES = new Set(["founders-copilot", "on-it"]);
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const FALLBACK_MODEL = "anthropic/claude-haiku-4.5";
const DEFAULT_PACE_MS = 450;

const FOUNDERS_SYSTEM = `You are Groundwork's Founder's Copilot. Given a founder's idea and a JSON list of candidate funding opportunities, pick the best-matched ones and render OPPORTUNITY CARDS. For each matched opportunity: a Card whose child is a Column of Text — the title (usageHint "h3"), "<org> · <category>" (caption), one line on why it fits THIS idea (body), and "Score <n> · deadline <d> · <eligibility>" (caption). Use ONLY the provided opportunities — never invent grants.

${A2UI_RULES}`;

function foundersUser(idea: string): string {
  return `Idea: ${idea || "(not provided)"}\n\nCandidate opportunities (JSON):\n${JSON.stringify(opportunitiesData)}\n\nRender the matched opportunity cards.`;
}

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

// Canned plan/tool stages per usecase (the render stage is handled separately, possibly by the model).
function preRenderStages(usecase: string): StageDef[] {
  if (usecase === "on-it") {
    return [
      { span: "plan", kind: "plan", events: [
        { type: "STEP_STARTED", text: "parse origin + destination" },
        { type: "TEXT_MESSAGE_CONTENT", text: "Finding a step-free route…" },
      ] },
      { span: "tool:lookup_postcode", kind: "tool", events: [
        { type: "TOOL_CALL_START", text: "lookup_postcode" },
        { type: "TOOL_CALL_END", text: "lookup_postcode" },
      ] },
      { span: "tool:get_tfl_journey", kind: "tool", events: [
        { type: "TOOL_CALL_START", text: "get_tfl_journey" },
        { type: "TOOL_CALL_END", text: "get_tfl_journey" },
      ] },
    ];
  }
  return [
    { span: "plan", kind: "plan", events: [
      { type: "STEP_STARTED", text: "understand the idea" },
      { type: "TEXT_MESSAGE_CONTENT", text: "Assessing your stage and matching funding…" },
    ] },
    { span: "tool:search_opportunities", kind: "tool", events: [
      { type: "TOOL_CALL_START", text: "search_opportunities" },
      { type: "TOOL_CALL_END", text: "search_opportunities" },
    ] },
  ];
}

// Render the card batch. Track A stays canned (a model-invented step-free route would hallucinate;
// real routing is Phase 3). Track B asks the model to generate the cards grounded in the demo data,
// falling back to the deterministic stub when there's no key or the model errors/times out.
async function renderBatch(usecase: string, emitter: Emitter, ctx: ModelCtx): Promise<unknown[]> {
  if (usecase === "on-it") return buildRouteCards();
  const stub = buildOpportunityCards();
  if (!ctx.key) return stub;
  const ac = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => { ac.abort(); }, 20000);
  try {
    const result = await callRenderModel({
      apiKey: ctx.key,
      model: ctx.model,
      baseURL: ctx.baseURL,
      system: FOUNDERS_SYSTEM,
      user: foundersUser(ctx.prompt),
      signal: ac.signal,
    });
    if (!result) return stub;
    emitter.span({ name: "model:openrouter", attrs: { model: result.model, ...result.usage } });
    return result.batch;
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

// Resolve model access (BYOK header > OPENROUTER_KEY secret > keyless stub) + the span attrs + pacing.
async function resolveRun(
  request: Request,
  env: Env,
  usecase: string
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
  const key = byokKey || env.OPENROUTER_KEY || "";
  const modelCtx: ModelCtx = {
    key,
    model: bodyModel || env.DEFAULT_MODEL || FALLBACK_MODEL,
    baseURL: env.AI_GATEWAY_URL || OPENROUTER_BASE,
    prompt,
  };
  const runAttrs = {
    usecase,
    reqId: crypto.randomUUID(),
    model: key && usecase === "founders-copilot" ? modelCtx.model : "(stub)",
    byok: byokKey.length > 0,
  };
  // Pace the keyless path so it "streams" like an agent working; the model path is paced by real
  // latency. Overridable via PACE_MS (tests set "0").
  const paceMs = env.PACE_MS !== undefined ? Number(env.PACE_MS) : key ? 0 : DEFAULT_PACE_MS;
  return { modelCtx, runAttrs, paceMs };
}

async function runStages(
  usecase: string,
  emitter: Emitter,
  write: (e: AgentEvent) => void,
  runAttrs: Record<string, unknown>,
  ctx: ModelCtx,
  paceMs: number
): Promise<void> {
  emitter.span({ name: "run", attrs: runAttrs });
  write({ type: "RUN_STARTED" });
  for (const stage of preRenderStages(usecase)) {
    const t0 = Date.now();
    for (const e of stage.events) {
      await sleep(paceMs);
      write(e);
    }
    emitter.span({ name: stage.span, attrs: { kind: stage.kind, latencyMs: Date.now() - t0 } });
  }
  await sleep(paceMs);
  const t0 = Date.now();
  const batch = await renderBatch(usecase, emitter, ctx);
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

    const usecase = url.searchParams.get("usecase") ?? "";
    if (!USECASES.has(usecase)) {
      return new Response(JSON.stringify({ error: `unknown usecase: ${usecase || "(none)"}` }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const { modelCtx, runAttrs, paceMs } = await resolveRun(request, env, usecase);
    const emitter = makeEmitter(env);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (e: AgentEvent): void => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        };
        await runStages(usecase, emitter, write, runAttrs, modelCtx, paceMs);
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
