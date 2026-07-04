import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { useAgentSSE, type Byok } from "./agent/useAgentSSE";

// The two workflows the one engine serves — swap the usecase id, swap the app (the modularity proof).
const USECASES = [
  {
    id: "founders-copilot",
    label: "Founder's Copilot",
    hint: "Track B — grants matched to your idea",
    placeholder: "Describe your idea, e.g. an AI copilot for London founders",
    example: "an AI copilot for London founders",
  },
  {
    id: "on-it",
    label: "On It",
    hint: "Track A — step-free London route",
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

function Dashboard() {
  const { eventLog, isRunning, error, run, stop } = useAgentSSE();
  const [usecase, setUsecase] = useState<string>(USECASES[0].id);
  const [prompt, setPrompt] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_BYOK_API_KEY ?? "");
  const [model, setModel] = useState(import.meta.env.VITE_BYOK_MODEL ?? "");

  const active = USECASES.find((u) => u.id === usecase) ?? USECASES[0];

  const onSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      const byok: Byok | undefined = apiKey ? { apiKey, model } : undefined;
      void run(usecase, prompt, byok);
    },
    [run, usecase, prompt, apiKey, model]
  );

  // Auto-play an example on first load so visitors see the agent work without typing (keyless = the
  // free deterministic stub; does not send BYOK).
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    setPrompt(USECASES[0].example);
    void run(USECASES[0].id, USECASES[0].example, undefined, true); // demo=true → free stub, not the model
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

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
              onClick={() => setUsecase(u.id)}
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
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            title="Bring your own model key (optional; kept in memory only)"
            className="px-2 py-1 rounded border border-border text-xs text-text-muted hover:border-primary"
          >
            ⚙ Key
          </button>
          <ThemeToggle />
        </div>
      </header>

      {showKey && (
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
        <aside className="w-96 border-l border-border flex flex-col min-h-0">
          <div className="h-10 flex items-center px-2 border-b border-border text-xs font-semibold text-data-positive uppercase tracking-wide">
            AG-UI Events
          </div>
          <div className="flex-1 min-h-0">
            <EventStream events={eventLog} />
          </div>
        </aside>
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
