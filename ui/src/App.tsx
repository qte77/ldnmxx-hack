import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { matchesToggle, readDevMode, writeDevMode } from "./devmode";
import { useAgentSSE, type Byok, type RunStatus } from "./agent/useAgentSSE";

// The two workflows the one engine serves — swap the usecase id, swap the app (the modularity proof).
const USECASES = [
  {
    id: "founders-copilot",
    label: "Founder's Copilot",
    hint: "Grants matched to your idea",
    placeholder: "Describe your idea, e.g. an AI copilot for London founders",
    example: "an AI copilot for London founders",
  },
  {
    id: "on-it",
    label: "On It",
    hint: "Step-free London route",
    placeholder: "e.g. step-free from E8 3GT to Westminster",
    example: "step-free from E8 3GT to Westminster",
  },
] as const;

// Minimal light/dark toggle: flips the `data-theme` attribute the EyeRest theme + anti-FOUC script read.
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
      className="px-2 py-1 rounded border border-border text-sm text-text-muted hover:border-primary"
    >
      {theme === "dark" ? "☀" : "☾"}
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

function Dashboard() {
  const { eventLog, isRunning, error, run, stop, status } = useAgentSSE();
  const [usecase, setUsecase] = useState<string>(USECASES[0].id); // Founder's Copilot leads
  const [prompt, setPrompt] = useState<string>(USECASES[0].example);
  const [showKey, setShowKey] = useState(false);
  // No env prefill — VITE_* is inlined into the build, so a key here would ship in the bundle. The ⚙ Key
  // panel starts empty; a user-entered key is forwarded to the Worker per request and resolved server-side.
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  // Dev mode reveals the AG-UI console + ⚙ Key panel (hidden in the civic default). Ctrl+K / Ctrl+I or
  // ?dev=1 toggles it; the choice persists in localStorage (qte77-dev).
  const [devMode, setDevMode] = useState(() => readDevMode(location.search));

  const active = USECASES.find((u) => u.id === usecase) ?? USECASES[0];

  const onSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      const byok: Byok | undefined = apiKey ? { apiKey, model } : undefined;
      void run(usecase, prompt, byok); // civic default is always Live; the Worker's ?demo=1 stays available
    },
    [run, usecase, prompt, apiKey, model]
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

  // No auto-run on load: Founder's Copilot is preselected with its example prefilled, but the
  // workflow runs only when the visitor clicks Run (so a page refresh never fires a request).

  return (
    <div className="h-screen flex flex-col max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-surface border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">Groundwork</span>
          <span className="hidden sm:inline text-xs text-text-muted">
            one engine · two London workflows
          </span>
        </div>
        <div className="flex items-center gap-2">
          {USECASES.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setUsecase(u.id);
                setPrompt(u.example); // swap the query to match the track
              }}
              title={u.hint}
              className={`px-3 py-1 rounded border text-sm transition-colors ${
                u.id === usecase
                  ? "border-primary text-primary"
                  : "border-border text-text-muted hover:border-primary"
              }`}
            >
              {u.label}
            </button>
          ))}
          <span className="w-px h-5 bg-border mx-1" aria-hidden />
          {devMode && (
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              title="Bring your own model key (optional; kept in memory only)"
              className="px-2 py-1 rounded border border-border text-xs text-text-muted hover:border-primary"
            >
              ⚙ Key
            </button>
          )}
          {devMode && (
            <button
              type="button"
              onClick={() => setDevMode(false)}
              title="Exit dev mode (Ctrl+K / Ctrl+I)"
              className="px-2 py-1 rounded border border-border text-xs text-text-muted hover:border-primary"
            >
              dev ✕
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {devMode && showKey && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-surface border-b border-border">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="OpenRouter API key (optional, in-memory only)"
            className="flex-1 min-w-48 px-2 py-1 rounded border border-border bg-bg text-text text-sm"
          />
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model, e.g. anthropic/claude-haiku-4.5"
            className="w-72 px-2 py-1 rounded border border-border bg-bg text-text text-sm"
          />
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={active.placeholder}
          className="flex-1 px-3 py-2 rounded border border-border bg-bg text-text"
        />
        {isRunning ? (
          <button
            type="button"
            onClick={stop}
            className="px-4 py-2 rounded border border-border text-text-muted hover:border-primary"
          >
            Stop
          </button>
        ) : (
          <button type="submit" className="px-4 py-2 rounded bg-primary text-primary-on font-medium">
            Run
          </button>
        )}
      </form>

      {error && (
        <div className="px-4 py-2 text-sm text-data-negative border-b border-border">{error}</div>
      )}

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto p-4">
          <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-3 pb-2 border-b border-border">
            A2UI Surface — {active.hint}
          </div>
          <A2UISurface />
        </main>
        {devMode && (
          <aside className="w-96 border-l border-border flex flex-col min-h-0">
            <div className="h-10 flex items-center justify-between gap-2 px-2 border-b border-border text-xs font-semibold text-data-positive uppercase tracking-wide">
              <span>AG-UI Events</span>
              <StatusChip status={status} />
            </div>
            <div className="flex-1 min-h-0">
              <EventStream events={eventLog} />
            </div>
          </aside>
        )}
      </div>
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
