// Arize tracing. Keyless default: one legible `⌁ span` line per span so `wrangler tail` reads cleanly.
// When ARIZE_API_KEY + ARIZE_SPACE_ID are set, spans are also batched and exported as an OTLP/HTTP JSON
// trace (OpenInference span kinds) to Arize on flush. Export failures are swallowed — observability must
// never break the request path. (Spike: Arize's OTLP endpoint may want protobuf; JSON is tried first.)

export interface Span {
  name: string;
  attrs?: Record<string, unknown>;
}
export interface Emitter {
  span(s: Span): void;
  flush(): Promise<void>;
}
export interface TraceEnv {
  ARIZE_API_KEY?: string;
  ARIZE_SPACE_ID?: string;
  ARIZE_PROJECT?: string; // OTLP resource service.name (defaults to "groundwork")
}

const ARIZE_OTLP_URL = "https://otlp.arize.com/v1/traces";
const DEFAULT_PROJECT = "groundwork";
// Cap browser-forwarded (/trace) batches so a client can't push an unbounded payload upstream.
export const MAX_TRACE_SPANS = 100;

const hexId = (bytes: number): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

const msToNano = (ms: number): string => `${Math.round(ms)}000000`;

// OpenInference span kind: the run chain → CHAIN, a model render → LLM, a tool stage → TOOL, else CHAIN.
function openInferenceKind(s: Span): string {
  if (s.name.startsWith("model:")) return "LLM";
  if (s.attrs?.kind === "tool") return "TOOL";
  if (s.attrs?.kind === "render") return "LLM";
  return "CHAIN";
}

// A plain value → OTLP AnyValue.
function anyValue(v: unknown): Record<string, unknown> {
  if (typeof v === "number") return Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { boolValue: v };
  return { stringValue: String(v) };
}
const kv = (key: string, value: unknown): Record<string, unknown> => ({ key, value: anyValue(value) });

// Map our spans to a single OTLP trace: one shared trace id, per-span ids, non-root spans parented under
// the `run` span, and each span's `latencyMs` used to back-date its start from now.
export function spansToOtlp(spans: Span[], env: TraceEnv): unknown {
  const traceId = hexId(16);
  const now = Date.now();
  let rootSpanId: string | undefined;
  const otlpSpans = spans.map((s) => {
    const spanId = hexId(8);
    const isRoot = s.name === "run";
    if (isRoot) rootSpanId = spanId;
    const latencyMs = typeof s.attrs?.latencyMs === "number" ? s.attrs.latencyMs : 0;
    return {
      traceId,
      spanId,
      parentSpanId: isRoot ? undefined : rootSpanId,
      name: s.name,
      kind: 1, // SPAN_KIND_INTERNAL
      startTimeUnixNano: msToNano(now - latencyMs),
      endTimeUnixNano: msToNano(now),
      attributes: [
        kv("openinference.span.kind", openInferenceKind(s)),
        ...Object.entries(s.attrs ?? {}).map(([k, v]) => kv(k, v)),
      ],
    };
  });
  return {
    resourceSpans: [
      {
        resource: { attributes: [kv("service.name", env.ARIZE_PROJECT || DEFAULT_PROJECT)] },
        scopeSpans: [{ scope: { name: "groundwork-worker" }, spans: otlpSpans }],
      },
    ],
  };
}

// POST the batch to Arize as OTLP/HTTP JSON. No-op unless configured + non-empty; never throws.
export async function exportSpans(env: TraceEnv, spans: Span[]): Promise<void> {
  if (!env.ARIZE_API_KEY || !env.ARIZE_SPACE_ID || spans.length === 0) return;
  try {
    await fetch(ARIZE_OTLP_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        space_id: env.ARIZE_SPACE_ID,
        api_key: env.ARIZE_API_KEY,
      },
      body: JSON.stringify(spansToOtlp(spans, env)),
    });
  } catch {
    // Observability must never break the request path.
  }
}

// Keyless default: one legible line per span so `wrangler tail` reads cleanly (screenshot-ready).
const consoleEmitter: Emitter = {
  span(s: Span): void {
    console.log("⌁ span", s.name, JSON.stringify(s.attrs ?? {}));
  },
  flush(): Promise<void> {
    return Promise.resolve();
  },
};

// Buffers spans (still logging the `⌁ span` breadcrumb) and exports them as one OTLP trace on flush.
function arizeEmitter(env: TraceEnv): Emitter {
  const buffered: Span[] = [];
  return {
    span(s: Span): void {
      buffered.push(s);
      console.log("⌁ span", s.name, JSON.stringify(s.attrs ?? {}));
    },
    flush(): Promise<void> {
      return exportSpans(env, buffered);
    },
  };
}

// Injectable emitter: keyless console by default; the real OTLP exporter activates only when both the
// Arize key and space id are set.
export function makeEmitter(env: TraceEnv): Emitter {
  return env.ARIZE_API_KEY && env.ARIZE_SPACE_ID ? arizeEmitter(env) : consoleEmitter;
}
