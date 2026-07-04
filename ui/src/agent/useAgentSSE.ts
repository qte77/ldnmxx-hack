import { useCallback, useRef, useState } from "react";
import { useA2UIActions } from "@a2ui/react";
import {
  applyA2UIEvent,
  appendLogEntry,
  type AgentEvent,
  type EventLogEntry,
} from "./applyA2UIEvent";
import { WORKER_BASE } from "../config";

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

/**
 * Live transport seam: open `POST /run?usecase=<id>` (fetch + ReadableStream + AbortController),
 * parse the AG-UI SSE stream, and drive the SAME `applyA2UIEvent` render+log seam the contract
 * guards. Replaces agenthud's in-browser BYOK `liveAgent` — the agent now runs in the Worker.
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

      try {
        const res = await fetch(
          `${WORKER_BASE}/run?usecase=${encodeURIComponent(usecase)}${demo ? "&demo=1" : ""}`,
          {
          method: "POST",
          headers: buildHeaders(byok),
          body: JSON.stringify({ prompt, model: byok?.model ?? "" }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Worker responded ${String(res.status)}`);
        await readSSE(res.body, dispatch);
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
