import { makeEmitter, type Emitter } from "./trace/arize";
import { buildOpportunityCards, buildRouteCards } from "./a2ui/cards";

export interface Env {
  ARIZE_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
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

const USECASES = new Set(["founders-copilot", "on-it"]);

// Canned per-usecase stages (Phase-1 stub — no model call yet). Phase 2 swaps these for the real
// plan/tool/render loop over usecases/*.json. Same engine, different JSON = the modularity proof.
function stagesFor(usecase: string): StageDef[] {
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
      { span: "render", kind: "render", events: [
        { type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: buildRouteCards() },
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
    { span: "render", kind: "render", events: [
      { type: "TOOL_CALL_END", text: "render_ui", a2uiMessages: buildOpportunityCards() },
    ] },
  ];
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

// One Arize span per stage + a root "run" span; each stage also writes its SSE event(s).
function runStages(
  usecase: string,
  emitter: Emitter,
  write: (e: AgentEvent) => void,
  runAttrs: Record<string, unknown>
): void {
  emitter.span({ name: "run", attrs: runAttrs });
  write({ type: "RUN_STARTED" });
  for (const stage of stagesFor(usecase)) {
    const t0 = Date.now();
    for (const e of stage.events) write(e);
    emitter.span({ name: stage.span, attrs: { kind: stage.kind, latencyMs: Date.now() - t0 } });
  }
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

    // Optional BYOK: our own model key stays a Worker secret (the keyless default); a user key rides
    // the Authorization header. The Phase-1 stub makes no model call, so we only trace that it arrived.
    let model = "";
    try {
      const body = (await request.json()) as { model?: string };
      model = body.model ?? "";
    } catch {
      // missing/invalid body is fine for the stub
    }
    const runAttrs = {
      usecase,
      reqId: crypto.randomUUID(),
      model: model || "(worker default)",
      byok: request.headers.has("authorization"),
    };

    const emitter = makeEmitter(env);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (e: AgentEvent): void => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        };
        runStages(usecase, emitter, write, runAttrs);
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
