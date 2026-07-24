import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { matchesToggle, readDevMode, writeDevMode } from "./devmode";
import { readUsecase } from "./usecase";
import { useAgentSSE, type Byok, type RunStatus } from "./agent/useAgentSSE";
import type { EventLogEntry } from "./agent/applyA2UIEvent";

// 017 P3: ONE input, no manual switcher. The Worker's auto-router picks the workflow from the typed
// ask, so the UI keeps only what the single input still needs: the id→label map (to name the resolved
// workflow and validate a ?usecase= deep link) plus an `example` to prefill when a deep link names a
// workflow directly. The no-match discovery card + its use-case list are rendered SERVER-side from the
// registry (worker usecaseCatalog), so the per-workflow hero copy that used to live here is gone.
const USECASES = [
  { id: "sort-my-care", label: "Sort My Care", example: "GP near E8 3GT" },
  { id: "sort-my-route", label: "Sort My Route", example: "step-free from E8 3GT to Westminster" },
  { id: "sort-my-wander", label: "Sort My Wander", example: "parks to wander near SW9 9SL" },
  { id: "sort-my-food-hygiene", label: "Sort My Food Hygiene", example: "food hygiene near SW9 9SL" },
  { id: "sort-my-scam-check", label: "Sort My Scam Check", example: "is Thames Capital Partners a scam" },
  { id: "founders-copilot", label: "Founder's Copilot", example: "an AI copilot for London founders" },
] as const;

const USECASE_IDS = USECASES.map((u) => u.id);

// Shared chrome-control styling: border-border-strong (not the decorative hairline) because a
// control's border IS its affordance — WCAG 1.4.11 wants 3:1, which only the strong token meets.
const CONTROL_CLASS =
  "px-2 py-1 rounded border border-border-strong text-text-muted hover:border-primary " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Minimal light/dark toggle: flips the `data-theme` attribute the theme + anti-FOUC script read.
type Theme = "light" | "dark";
function readTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("qte77-theme", next);
    } catch {
      /* storage disabled — non-fatal */
    }
    setTheme(next);
  }, [theme]);
  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle light / dark"
      aria-label="Toggle light or dark theme"
      className={`${CONTROL_CLASS} text-sm`}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

// Accent variants (ADR 0005): three trademark-safe London accents. This control mirrors ThemeToggle
// exactly — cycle, persist, set the attribute — and the [data-variant] blocks in tokens.css do the
// rest. ui/public/variant-init.js applies the stored choice before first paint.
const VARIANTS = [
  { id: "thames", label: "Thames Teal" },
  { id: "indigo", label: "Heritage Indigo" },
  { id: "green", label: "Westminster Green" },
] as const;
type Variant = (typeof VARIANTS)[number]["id"];

function readVariant(): Variant {
  const attr = document.documentElement.getAttribute("data-variant");
  const match = VARIANTS.find((v) => v.id === attr);
  return match ? match.id : "thames";
}
function VariantToggle() {
  const [variant, setVariant] = useState<Variant>(readVariant);
  const current = VARIANTS.find((v) => v.id === variant) ?? VARIANTS[0];
  const cycle = useCallback(() => {
    const i = VARIANTS.findIndex((v) => v.id === variant);
    const next = VARIANTS[(i + 1) % VARIANTS.length] ?? VARIANTS[0];
    document.documentElement.setAttribute("data-variant", next.id);
    try {
      localStorage.setItem("qte77-variant", next.id);
    } catch {
      /* storage disabled — non-fatal */
    }
    setVariant(next.id);
  }, [variant]);
  return (
    <button
      type="button"
      onClick={cycle}
      title={`Accent: ${current.label} — click to change`}
      // The swatch is decorative, so the accessible name has to carry the state in words.
      aria-label={`Accent colour: ${current.label}. Change accent colour.`}
      className={`${CONTROL_CLASS} flex items-center`}
    >
      <span aria-hidden="true" className="block w-3.5 h-3.5 rounded-full bg-primary" />
    </button>
  );
}

// Short model label for the chip — drop the provider path: "@cf/openai/gpt-oss-120b" → "gpt-oss-120b".
function shortModel(model: string): string {
  const tail = model.split("/").pop();
  return tail && tail.length > 0 ? tail : model;
}

// The honest 3-state HUD chip: what the LAST run actually did. Hidden until the first run reports USAGE.
// LIVE (a model answered) · DEMO (deterministic, opt-in or a canned route) · STUB (model path fell back).
function StatusChip({ status }: { status: RunStatus | null }) {
  if (!status) return null;
  const { mode, model, tokens } = status;
  const label =
    mode === "live"
      ? `LIVE · ${model ? shortModel(model) : "model"} · ~${String(tokens)} tok`
      : mode === "demo"
        ? "DEMO · deterministic"
        : "STUB · fell back";
  const color =
    mode === "live"
      ? "bg-data-positive/15 text-data-positive"
      : mode === "demo"
        ? "bg-text-muted/15 text-text-muted"
        : "bg-data-caution/15 text-data-caution";
  return (
    <span
      title={mode === "live" && model ? model : label}
      className={`px-2 py-0.5 rounded normal-case tracking-normal font-semibold truncate max-w-[70%] ${color}`}
    >
      {label}
    </span>
  );
}

// Header dev controls (⚙ Key + dev-exit, dev mode only) beside the always-on variant + theme toggles.
// Extracted from Dashboard to keep it under the complexity gate.
function HeaderControls(props: { devMode: boolean; onToggleKey: () => void; onExitDev: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {props.devMode && (
        <button
          type="button"
          onClick={props.onToggleKey}
          title="Bring your own model key (optional; kept in memory only)"
          className={`${CONTROL_CLASS} text-xs`}
        >
          ⚙ Key
        </button>
      )}
      {props.devMode && (
        <button
          type="button"
          onClick={props.onExitDev}
          title="Exit dev mode (Ctrl+K / Ctrl+I)"
          className={`${CONTROL_CLASS} text-xs`}
        >
          dev ✕
        </button>
      )}
      <VariantToggle />
      <ThemeToggle />
    </div>
  );
}

// Optional BYOK key + model inputs (dev mode only) — in memory, forwarded to the Worker per request.
function KeyPanel(props: {
  show: boolean;
  apiKey: string;
  model: string;
  setApiKey: (v: string) => void;
  setModel: (v: string) => void;
}) {
  if (!props.show) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b border-border">
      <input
        type="password"
        value={props.apiKey}
        onChange={(e) => props.setApiKey(e.target.value)}
        placeholder="OpenRouter API key (optional, in-memory only)"
        className="flex-1 min-w-48 px-2 py-1 rounded border border-border-strong bg-bg text-text text-sm"
      />
      <input
        type="text"
        value={props.model}
        onChange={(e) => props.setModel(e.target.value)}
        placeholder="model, e.g. anthropic/claude-haiku-4.5"
        className="w-72 px-2 py-1 rounded border border-border-strong bg-bg text-text text-sm"
      />
    </div>
  );
}

// The dev-only AG-UI event console + honest status chip.
function DevConsole(props: { show: boolean; status: RunStatus | null; events: EventLogEntry[] }) {
  if (!props.show) return null;
  return (
    <section className="mt-6 border border-border rounded flex flex-col min-h-64">
      <div className="h-10 flex items-center justify-between gap-2 px-2 border-b border-border text-xs font-semibold text-data-positive uppercase tracking-wide">
        <span>AG-UI Events</span>
        <StatusChip status={props.status} />
      </div>
      <div className="flex-1 min-h-0">
        <EventStream events={props.events} />
      </div>
    </section>
  );
}

function Dashboard() {
  const { eventLog, isRunning, error, run, stop, status, resolved } = useAgentSSE();
  // ?usecase=<id> is an explicit BYPASS (deep link / founders demo) — null ⇒ the Worker auto-routes
  // the typed ask. Fixed for the session (from the URL); a bypass deep link prefills its example.
  const bypass = readUsecase(location.search, USECASE_IDS);
  const bypassDef = USECASES.find((u) => u.id === bypass);
  const [prompt, setPrompt] = useState<string>(bypassDef?.example ?? "");
  const [showKey, setShowKey] = useState(false);
  // No env prefill — VITE_* is inlined into the build, so a key here would ship in the bundle. The ⚙ Key
  // panel starts empty; a user-entered key is forwarded to the Worker per request and resolved server-side.
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  // Dev mode reveals the AG-UI console + ⚙ Key panel (hidden in the civic default). Ctrl+K / Ctrl+I or
  // ?dev=1 toggles it; the choice persists in localStorage (qte77-dev).
  const [devMode, setDevMode] = useState(() => readDevMode(location.search));

  // The workflow name to announce: the router's pick on a prompt-only run, or the bypass label on a
  // deep link. Drives the aria-live announcement + the visible "Showing …" heading above the results.
  const activeTitle = resolved?.title ?? bypassDef?.label;
  const announce = activeTitle ? `Showing: ${activeTitle}` : "";

  const onSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      const byok: Byok | undefined = apiKey ? { apiKey, model } : undefined;
      // Prompt-only unless a ?usecase= bypass is active; the Worker's ?demo=1 stays available.
      void run(prompt, byok, false, bypass ?? undefined);
    },
    [run, prompt, apiKey, model, bypass],
  );

  // Dev-mode toggle: Ctrl+K / Ctrl+I flips it (persisted), so the dev console is reachable without any
  // civic-facing chrome — a civic visitor never sees it; a developer/debugger opts in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchesToggle(e)) return;
      e.preventDefault();
      setDevMode((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Persist dev-mode (and reflect an explicit ?dev=1 / ?dev=0) so it survives a reload without the param.
  useEffect(() => {
    writeDevMode(devMode);
  }, [devMode]);

  // No auto-run on load: a page refresh never fires a request — the workflow runs only on submit.
  // In dev mode the raw error shows; a civic visitor gets a calm, non-technical line instead.
  const errorMsg = devMode
    ? error
    : "Sorry — we couldn't reach the service just now. Please check your connection and try again in a moment.";

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto w-full px-4">
      <header className="flex items-center justify-between gap-3 py-3">
        <span className="text-lg font-bold text-primary lowercase">sortmy.london</span>
        <HeaderControls
          devMode={devMode}
          onToggleKey={() => setShowKey((v) => !v)}
          onExitDev={() => setDevMode(false)}
        />
      </header>

      <KeyPanel show={devMode && showKey} apiKey={apiKey} model={model} setApiKey={setApiKey} setModel={setModel} />

      <main className="flex-1">
        {/* One input, one action. The workflow is chosen by the Worker's router from what's typed. */}
        <section className="pt-6 sm:pt-10">
          <p className="text-sm text-text-muted">London public services · free, no sign-up</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-text">
            Ask in your own words. Get the official source.
          </h1>
          <p className="mt-2 text-text-muted max-w-prose">
            Not a live search: we keep a snapshot of official registers — CQC, the Food Standards
            Agency, Historic England, Ordnance Survey — refreshed weekly. Every result shows the date
            on the record itself and links to the live page.
          </p>

          <form onSubmit={onSubmit} className="mt-5 flex flex-col sm:flex-row gap-2">
            <label htmlFor="civic-query" className="sr-only">
              Ask in your own words
            </label>
            <input
              id="civic-query"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. food hygiene near SE1"
              autoComplete="off"
              className="flex-1 px-3 py-2 rounded border border-border-strong bg-bg text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {isRunning ? (
              <button type="button" onClick={stop} className={`${CONTROL_CLASS} px-4 py-2`}>
                Stop
              </button>
            ) : (
              <button
                type="submit"
                className="px-4 py-2 rounded bg-primary text-primary-on font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Find it
              </button>
            )}
          </form>

          <p className="mt-3 text-xs text-text-muted max-w-prose">
            No account, no cookies — anonymous page-view counts only. We point you to the official
            record; confirm there before you act.
          </p>
        </section>

        {error && (
          <div role="alert" className="mt-4 px-3 py-2 text-sm text-data-negative border border-border rounded">
            {errorMsg}
          </div>
        )}

        {/* aria-live announces the router's choice so the routing decision is not sighted-only. */}
        <p aria-live="polite" className={activeTitle ? "mt-6 text-sm font-semibold text-text" : "sr-only"}>
          {announce}
        </p>

        <div aria-live="polite" aria-busy={isRunning} className="mt-3">
          <A2UISurface />
        </div>

        <DevConsole show={devMode} status={status} events={eventLog} />
      </main>

      <footer className="mt-8 py-3 text-xs text-text-muted border-t border-border">
        We find it. You sort it. A signpost to official public services, not advice.{" "}
        <a
          href="https://github.com/qte77/ldnmxx-hack/issues"
          className="underline underline-offset-2 hover:text-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Built to WCAG 2.1 AA — report an accessibility issue
        </a>
        .{" "}
        <span title="deployed release" className="whitespace-nowrap font-mono">
          v{__APP_VERSION__}
        </span>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <A2UISurfaceProvider>
      <Dashboard />
    </A2UISurfaceProvider>
  );
}
