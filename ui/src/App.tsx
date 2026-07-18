import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { matchesToggle, readDevMode, writeDevMode } from "./devmode";
import { readUsecase } from "./usecase";
import { useAgentSSE, type Byok, type RunStatus } from "./agent/useAgentSSE";

// The civic flows one engine serves. Sort My Care is the flagship (default); On It is the
// secondary civic flow, revealed on demand. Founder's Copilot is an engine demo (civic:false)
// — off-message for a public-service tool, so it's reachable ONLY via ?usecase=founders-copilot.
const USECASES = [
  {
    id: "sort-my-care",
    label: "Sort My Care",
    headline: "Find NHS & care services near you",
    blurb: "Enter a London postcode to see public health and care services nearby, each with a link to its official source.",
    placeholder: "Your London postcode, e.g. E8 3GT",
    example: "E8 3GT",
    cta: "Find care services",
    switchLabel: "Care services near you",
    civic: true,
  },
  {
    id: "on-it",
    label: "On It",
    headline: "Plan a step-free journey",
    blurb: "Enter a start and destination for a step-free route across London.",
    placeholder: "e.g. step-free from E8 3GT to Westminster",
    example: "step-free from E8 3GT to Westminster",
    cta: "Find a step-free route",
    switchLabel: "Step-free journeys",
    civic: true,
  },
  {
    id: "founders-copilot",
    label: "Founder's Copilot",
    headline: "Match grants to your idea",
    blurb: "Describe your idea to see matched grants. (Engine demo — not a public service.)",
    placeholder: "Describe your idea, e.g. an AI copilot for London founders",
    example: "an AI copilot for London founders",
    cta: "Match grants",
    switchLabel: "Grant matching",
    civic: false,
  },
] as const;

const USECASE_IDS = USECASES.map((u) => u.id);
const FLAGSHIP_ID = "sort-my-care";

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
  // Flagship-first: Sort My Care is the default; ?usecase=<id> can switch (incl. the founders demo).
  const [usecase, setUsecase] = useState<string>(() =>
    readUsecase(location.search, USECASE_IDS, FLAGSHIP_ID),
  );
  const active = USECASES.find((u) => u.id === usecase) ?? USECASES[0];
  const [prompt, setPrompt] = useState<string>(active.example);
  const [showKey, setShowKey] = useState(false);
  // No env prefill — VITE_* is inlined into the build, so a key here would ship in the bundle. The ⚙ Key
  // panel starts empty; a user-entered key is forwarded to the Worker per request and resolved server-side.
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  // Dev mode reveals the AG-UI console + ⚙ Key panel (hidden in the civic default). Ctrl+K / Ctrl+I or
  // ?dev=1 toggles it; the choice persists in localStorage (qte77-dev).
  const [devMode, setDevMode] = useState(() => readDevMode(location.search));

  // Civic flows other than the active one — the reveal-on-demand alternatives (never the demo).
  const alternatives = USECASES.filter((u) => u.civic && u.id !== usecase);

  const switchTo = useCallback((next: (typeof USECASES)[number]) => {
    setUsecase(next.id);
    setPrompt(next.example); // swap the query to match the new flow
  }, []);

  const onSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      const byok: Byok | undefined = apiKey ? { apiKey, model } : undefined;
      void run(usecase, prompt, byok); // civic default is always Live; the Worker's ?demo=1 stays available
    },
    [run, usecase, prompt, apiKey, model],
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

  // No auto-run on load: the flow is preselected with its example prefilled, but the workflow runs only
  // when the visitor submits (so a page refresh never fires a request).

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto w-full px-4">
      <h1 className="sr-only">sortmy.london — find the official public service you need</h1>
      <header className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary lowercase">sortmy.london</span>
          <span className="hidden sm:inline text-xs text-text-muted">
            find the official public service you need
          </span>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="flex flex-wrap items-center gap-2 py-2 border-b border-border">
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

      <main className="flex-1">
        {/* Task-first hero: one calm question, one flow, one input, one action. */}
        <section className="pt-6 sm:pt-10">
          <p className="text-sm text-text-muted">What do you need sorted?</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-text">{active.headline}</h2>
          <p className="mt-2 text-text-muted max-w-prose">{active.blurb}</p>

          <form onSubmit={onSubmit} className="mt-5 flex flex-col sm:flex-row gap-2">
            <label htmlFor="civic-query" className="sr-only">
              {active.placeholder}
            </label>
            <input
              id="civic-query"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={active.placeholder}
              autoComplete="off"
              className="flex-1 px-3 py-2 rounded border border-border bg-bg text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              <button
                type="submit"
                className="px-4 py-2 rounded bg-primary text-primary-on font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {active.cta}
              </button>
            )}
          </form>

          {/* Progressive disclosure: alternate civic flows, de-emphasised until wanted. */}
          {alternatives.length > 0 && (
            <p className="mt-3 text-sm text-text-muted">
              Or:{" "}
              {alternatives.map((u, i) => (
                <span key={u.id}>
                  {i > 0 && " · "}
                  <button
                    type="button"
                    onClick={() => switchTo(u)}
                    className="underline underline-offset-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {u.switchLabel}
                  </button>
                </span>
              ))}
            </p>
          )}
        </section>

        {error && (
          <div role="alert" className="mt-4 px-3 py-2 text-sm text-data-negative border border-border rounded">
            {devMode
              ? error
              : "Sorry — we couldn't reach the service just now. Please check your connection and try again in a moment."}
          </div>
        )}

        <div aria-live="polite" aria-busy={isRunning} className="mt-6">
          <A2UISurface />
        </div>

        {devMode && (
          <section className="mt-6 border border-border rounded flex flex-col min-h-64">
            <div className="h-10 flex items-center justify-between gap-2 px-2 border-b border-border text-xs font-semibold text-data-positive uppercase tracking-wide">
              <span>AG-UI Events</span>
              <StatusChip status={status} />
            </div>
            <div className="flex-1 min-h-0">
              <EventStream events={eventLog} />
            </div>
          </section>
        )}
      </main>

      <footer className="mt-8 py-3 text-xs text-text-muted border-t border-border">
        Free · no cookies · no tracking beyond anonymous page views. A signpost to official services —
        always confirm details with the official source.{" "}
        <a
          href="https://github.com/qte77/ldnmxx-hack/issues"
          className="underline underline-offset-2 hover:text-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Built to WCAG 2.1 AA — report an accessibility issue
        </a>
        .
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
