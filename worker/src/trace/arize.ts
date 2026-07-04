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

// Stub for the real Arize/OpenInference exporter (Phase 2, behind ARIZE_API_KEY). Same interface —
// Phase 2 only fills in the OTLP exporter + token/cost attrs; until then we still log so the seam is
// exercised end-to-end with no network dependency.
function arizeEmitter(): Emitter {
  return {
    span(s: Span): void {
      console.log("⌁ span[arize-stub]", s.name, JSON.stringify(s.attrs ?? {}));
    },
    flush(): Promise<void> {
      return Promise.resolve();
    },
  };
}

// Injectable emitter: keyless console by default; the real adapter activates only when a key is set.
export function makeEmitter(env: TraceEnv): Emitter {
  return env.ARIZE_API_KEY ? arizeEmitter() : consoleEmitter;
}
