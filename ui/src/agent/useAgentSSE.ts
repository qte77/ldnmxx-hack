import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import {
  applyA2UIEvent,
  appendLogEntry,
  type AgentEvent,
  type EventLogEntry,
} from "./applyA2UIEvent";
import { WORKER_BASE } from "../config";
import { detectInjection } from "../../../shared/guard";

// Optional bring-your-own-key: held in memory only, forwarded to the Worker per request. Our own
// model key stays a Worker secret (the keyless default) — this is just an optional runtime override.
export interface Byok {
  apiKey: string;
  model: string;
}

// Friendlier connection error (ported verbatim from agenthud liveAgent.ts). The browser hides the
// real CORS reason — a blocked cross-origin fetch surfaces only as a generic TypeError — so spell
// out the likely causes instead of the bare message.
export function toConnectionError(err: unknown): string {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
  if (/networkerror|failed to fetch|load failed/i.test(msg)) {
    return `${msg} — the request was blocked or could not connect. Likely the Worker isn't running (dev: run \`wrangler dev\` on :8787) or a CORS/base-URL mismatch for the deployed Worker.`;
  }
  return msg;
}

// Pure SSE frame parser: split the accumulated buffer on frame boundaries ("\n\n"), keep any trailing
// partial frame as `rest`, and JSON-parse each frame's `data:` payload into an AgentEvent. A malformed
// frame is skipped (never throws) so one bad frame can't kill the whole stream.
export function parseSSE(buffer: string): { events: AgentEvent[]; rest: string } {
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  const events: AgentEvent[] = [];
  for (const chunk of chunks) {
    const data = chunk
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      const parsed: unknown = JSON.parse(data);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        typeof (parsed as { type?: unknown }).type === "string"
      ) {
        events.push(parsed as AgentEvent);
      }
    } catch {
      // malformed frame — skip, never throw
    }
  }
  return { events, rest };
}

function buildHeaders(byok?: Byok): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (byok?.apiKey) headers.authorization = `Bearer ${byok.apiKey}`;
  return headers;
}

// Fire-and-forget browser spans to the Worker's /trace forwarder (best-effort; never blocks the UI).
function postTraceSpans(spans: { name: string; attrs?: Record<string, unknown> }[]): void {
  void fetch(`${WORKER_BASE}/trace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spans }),
  }).catch(() => undefined);
}

// Read the SSE body to completion, dispatching each parsed AgentEvent. Buffers partial frames and
// flushes a trailing frame that lacked its terminating blank line.
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: AgentEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSSE(buffer);
    buffer = rest;
    for (const event of events) onEvent(event);
  }
  const tail = parseSSE(buffer.endsWith("\n\n") ? buffer : `${buffer}\n\n`);
  for (const event of tail.events) onEvent(event);
}

// Browser-BYOK founders path: the model call goes DIRECT from the browser (the user's key never touches
// our Worker), guarded by the same injection filter; browser spans are forwarded to /trace afterward.
async function runByokPath(
  byok: Byok,
  usecase: string,
  prompt: string,
  dispatch: (e: AgentEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const injection = detectInjection(prompt);
  if (injection.flagged) {
    dispatch({ type: "RUN_ERROR", text: `blocked: ${injection.reason ?? "prompt-injection"}` });
    return;
  }
  const { runLiveAgent } = await import("./liveAgent"); // lazy: keeps the ai SDK out of the main bundle
  await runLiveAgent({ apiKey: byok.apiKey, model: byok.model }, prompt, dispatch, { signal });
  postTraceSpans([
    { name: "run", attrs: { usecase, byok: true } },
    { name: "model:byok", attrs: { model: byok.model } },
  ]);
}

// Keyless / Worker path: open the Worker SSE stream and dispatch each parsed AG-UI event.
async function runWorkerPath(
  usecase: string,
  prompt: string,
  byok: Byok | undefined,
  demo: boolean,
  dispatch: (e: AgentEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch(
    `${WORKER_BASE}/run?usecase=${encodeURIComponent(usecase)}${demo ? "&demo=1" : ""}`,
    {
      method: "POST",
      headers: buildHeaders(byok),
      body: JSON.stringify({ prompt, model: byok?.model ?? "" }),
      signal,
    }
  );
  if (!res.ok || !res.body) throw new Error(`Worker responded ${String(res.status)}`);
  await readSSE(res.body, dispatch);
}

/**
 * Live transport seam. A manual founders Run with a BYOK key streams the model DIRECT from the browser
 * (`runByokPath` → `liveAgent`); every other run opens the Worker `POST /run?usecase=<id>` SSE stream
 * (`runWorkerPath`). Both drive the SAME `applyA2UIEvent` render+log seam the contract guards.
 */
export function useAgentSSE() {
  const { processMessages, clearSurfaces } = useA2UIActions();
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const render = useCallback(
    (messages: unknown[]) => {
      processMessages(messages as Parameters<typeof processMessages>[0]);
    },
    [processMessages]
  );

  const run = useCallback(
    async (usecase: string, prompt: string, byok?: Byok, demo = false): Promise<void> => {
      if (isRunning) return;
      setIsRunning(true);
      setError(null);
      setEventLog([]);
      clearSurfaces();

      const start = Date.now();
      const ac = new AbortController();
      abortRef.current = ac;

      const dispatch = (event: AgentEvent): void => {
        if (event.type === "RUN_ERROR") setError(event.text ?? "run error");
        const entry = applyA2UIEvent(event, Date.now() - start, render);
        setEventLog((prev) => appendLogEntry(prev, entry));
      };

      // Manual founders Run with a key → browser-BYOK (direct); everything else → the Worker stream.
      const useByok = !!byok?.apiKey && !demo && usecase === "founders-copilot";

      try {
        if (useByok) {
          await runByokPath(byok, usecase, prompt, dispatch, ac.signal);
        } else {
          await runWorkerPath(usecase, prompt, byok, demo, dispatch, ac.signal);
        }
      } catch (err) {
        if (!ac.signal.aborted) setError(toConnectionError(err));
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, clearSurfaces, render]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { eventLog, isRunning, error, run, stop };
}
