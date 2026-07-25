import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { A2UISurfaceProvider, A2UISurface } from "./A2UISurface";
import { EventStream } from "./EventStream";
import { matchesToggle, readDevMode, writeDevMode } from "./devmode";
import { readUsecase } from "./usecase";
import { useAgentSSE, type Byok, type RunStatus } from "./agent/useAgentSSE";
import type { EventLogEntry } from "./agent/applyA2UIEvent";
import { usecaseCatalog } from "../../shared/usecaseCatalog";
import { useRotatingPlaceholder } from "./useRotatingPlaceholder";
import { suggestionMode, type SuggestionMode } from "./suggestions";

// 018 P4: the workflow catalog is now ONE shared source of truth (shared/usecaseCatalog.ts, read by the
// Worker too) — no second, drifting UI copy. The UI needs only id→title (to name the resolved workflow +
// validate a ?usecase= deep link) and `example` (to prefill on a deep-link bypass). The no-match
// discovery card + its list are rendered SERVER-side from the same catalog.
const USECASES = usecaseCatalog();

const USECASE_IDS = USECASES.map((u) => u.id);

// 018 P5: the routable subset (keyword-carrying) — the ONLY workflows a typed ask can reach, so the only
// ones offered as suggestion chips / rotated as placeholders (founders + route are never-auto-routed,
// ADR 0004). Stable module-scope arrays so the rotating-placeholder effect doesn't re-run every render.
const ROUTABLE = USECASES.filter((u) => u.keywords.length > 0);
const ROUTABLE_EXAMPLES = ROUTABLE.map((u) => u.example);

// Shared chrome-control styling: border-border-strong (not the decorative hairline) because a
// control's border IS its affordance — WCAG 1.4.11 wants 3:1, which only the strong token meets.
// 020 P4a: min 44x44 hit area (WCAG 2.5.5) so header/chip controls are usable by less-technical /
// older users and on touch — the flex centering keeps the glyph/label centred in the taller box.
const CONTROL_CLASS =
  "min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-1 rounded border border-border-strong " +
  "text-text-muted hover:border-primary " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// 018 P5: suggestion chips + example placeholders. Same token set as CONTROL_CLASS (border-border-strong
// = the 3:1-contrast control affordance, WCAG 1.4.11) — a separate string (not `${CONTROL_CLASS} rounded-full`)
// because Tailwind utility precedence is generation-order-based, so chaining `rounded` then `rounded-full`
// would not reliably win.
const CHIP_CLASS =
  "min-h-[44px] inline-flex items-center px-4 py-2 rounded-full border border-border-strong text-text-muted " +
  "hover:border-primary hover:text-text " +
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

// Header dev controls (⚙ Key + dev-exit, dev mode only) beside the always-on Help, variant + theme
// toggles. Extracted from Dashboard to keep it under the complexity gate.
function HeaderControls(props: {
  devMode: boolean;
  onToggleHelp: () => void;
  onToggleKey: () => void;
  onExitDev: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* 020 P4d: an always-on plain-language explainer — after a search the hero dek collapses, so
          less-technical / older users can re-open "what is this?" any time. */}
      <button
        type="button"
        onClick={props.onToggleHelp}
        title="What is this? How sortmy.london works"
        aria-label="What is this? How sortmy.london works"
        className={CONTROL_CLASS}
      >
        ?
      </button>
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

// 020 P4d: a plain-language "what is this?" panel for less-technical / older users. Mirrors KeyPanel's
// show-gate so Dashboard stays under the complexity gate.
function HelpPanel({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mt-2 p-4 rounded border border-border bg-surface text-text max-w-prose" role="note">
      <p className="font-semibold">What is this?</p>
      <p className="mt-1 text-text-muted">
        sortmy.london is a free tool that helps you find official London public services — GPs and
        pharmacies, parks and heritage, food-hygiene ratings, and firm/scam checks. Type what you need and
        a place (a postcode like E8 3GT, or an area like Camden). We show the nearest official records and
        link you to the real page. No account, no cookies, no advice — just signposts to the official source.
      </p>
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

// 018 P5: the hero — eyebrow + H1 + the single input, plus (empty state only) the collapsible dek,
// suggestion chips, and rotating example placeholder. Extracted from Dashboard so each component's
// cyclomatic complexity stays in budget; owns the input-focus + rotating-placeholder state.
// 020 P3: one chip row, reused for the empty-state "Try:" prompts and the post-results "Try another:"
// pivot — so the example workflows are always one tap away, never hidden forever after the first search.
function SuggestionChips({
  label,
  ariaLabel,
  onPick,
}: {
  label: string;
  ariaLabel: string;
  onPick: (text: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={ariaLabel}>
      <span className="text-sm text-text-muted">{label}</span>
      {ROUTABLE.map((u) => (
        <button key={u.id} type="button" onClick={() => onPick(u.example)} className={CHIP_CLASS}>
          {u.example}
        </button>
      ))}
    </div>
  );
}

// The post-results pivot row — its own component so the mode branch lives here, not in Dashboard.
function TryAnotherRow({ mode, onPick }: { mode: SuggestionMode; onPick: (text: string) => void }) {
  if (mode !== "tryAnother") return null;
  return <SuggestionChips label="Try another:" ariaLabel="Try another search" onPick={onPick} />;
}

function Hero({
  prompt,
  setPrompt,
  onSubmit,
  submitPrompt,
  isRunning,
  stop,
  showExamples,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: (e: SyntheticEvent) => void;
  submitPrompt: (text: string) => void;
  isRunning: boolean;
  stop: () => void;
  showExamples: boolean;
}) {
  const [inputFocused, setInputFocused] = useState(false);
  const placeholder = useRotatingPlaceholder(ROUTABLE_EXAMPLES, inputFocused || prompt.length > 0);
  return (
    <section className="pt-6 sm:pt-10">
      <p className="text-sm text-text-muted">London public services · free, no sign-up</p>
      <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-text">
        Ask in your own words. Get the official source.
      </h1>
      {showExamples && (
        <p className="mt-2 text-text-muted max-w-prose">
          Not a live search: we keep a snapshot of official registers — CQC, the Food Standards Agency,
          Historic England, Ordnance Survey — refreshed weekly. Every result shows the date on the record
          itself and links to the live page.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-5 flex flex-col sm:flex-row gap-2">
        <label htmlFor="civic-query" className="sr-only">
          Ask in your own words
        </label>
        <input
          id="civic-query"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder={`e.g. ${placeholder}`}
          autoComplete="off"
          className="min-h-[44px] flex-1 px-3 py-2 rounded border border-border-strong bg-bg text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        {isRunning ? (
          <button type="button" onClick={stop} className={`${CONTROL_CLASS} px-4 py-2`}>
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="min-h-[44px] inline-flex items-center justify-center px-5 py-2 rounded bg-primary text-primary-on font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Find it
          </button>
        )}
      </form>

      {showExamples && (
        <>
          <SuggestionChips label="Try:" ariaLabel="Try an example" onPick={submitPrompt} />
          <p className="mt-3 text-sm text-text-muted max-w-prose">
            No account, no cookies — anonymous page-view counts only. We point you to the official record;
            confirm there before you act.
          </p>
        </>
      )}
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
  const [showHelp, setShowHelp] = useState(false);
  // No env prefill — VITE_* is inlined into the build, so a key here would ship in the bundle. The ⚙ Key
  // panel starts empty; a user-entered key is forwarded to the Worker per request and resolved server-side.
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  // Dev mode reveals the AG-UI console + ⚙ Key panel (hidden in the civic default). Ctrl+K / Ctrl+I or
  // ?dev=1 toggles it; the choice persists in localStorage (qte77-dev).
  const [devMode, setDevMode] = useState(() => readDevMode(location.search));
  // 018 P5: collapse the hero dek + suggestion chips once a search has happened, so results lead.
  // 020 P3: the chips return as a compact "try another" row after results land, so a user can pivot.
  const hasSearched = isRunning || eventLog.length > 0;
  const suggestions = suggestionMode({ hasSearched, isRunning });

  // The workflow name to announce: the router's pick on a prompt-only run, or the bypass label on a
  // deep link. Drives the aria-live announcement + the visible "Showing …" heading above the results.
  const activeTitle = resolved?.title ?? bypassDef?.title;
  const announce = activeTitle ? `Showing: ${activeTitle}` : "";

  // 018 P5: shared submit — a chip click and the form both funnel through here. Pass the text DIRECTLY
  // (not the `prompt` state, which setPrompt hasn't committed yet on a chip click) to dodge a stale closure.
  const submitPrompt = useCallback(
    (text: string) => {
      setPrompt(text);
      const byok: Byok | undefined = apiKey ? { apiKey, model } : undefined;
      // Prompt-only unless a ?usecase= bypass is active; the Worker's ?demo=1 stays available.
      void run(text, byok, false, bypass ?? undefined);
    },
    [run, apiKey, model, bypass],
  );

  const onSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      submitPrompt(prompt);
    },
    [submitPrompt, prompt],
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
          onToggleHelp={() => setShowHelp((v) => !v)}
          onToggleKey={() => setShowKey((v) => !v)}
          onExitDev={() => setDevMode(false)}
        />
      </header>

      <HelpPanel show={showHelp} />
      <KeyPanel show={devMode && showKey} apiKey={apiKey} model={model} setApiKey={setApiKey} setModel={setModel} />

      <main className="flex-1">
        {/* One input, one action. The workflow is chosen by the Worker's router from what's typed. */}
        <Hero
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={onSubmit}
          submitPrompt={submitPrompt}
          isRunning={isRunning}
          stop={stop}
          showExamples={suggestions === "hero"}
        />

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

        <TryAnotherRow mode={suggestions} onPick={submitPrompt} />

        <DevConsole show={devMode} status={status} events={eventLog} />
      </main>

      <footer className="mt-8 py-3 text-sm text-text-muted border-t border-border">
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
