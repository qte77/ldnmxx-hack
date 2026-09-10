import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { A2UISurface } from "../A2UISurface";
import { EventStream } from "../EventStream";
import { matchesToggle, readDevMode, writeDevMode } from "../devmode";
import { readUsecase } from "../usecase";
import { useAgentSSE, type Byok, type RunStatus } from "../agent/useAgentSSE";
import type { EventLogEntry } from "../agent/applyA2UIEvent";
import { usecaseCatalog, type CatalogEntry } from "../../../shared/usecaseCatalog";
import { useRotatingPlaceholder } from "../useRotatingPlaceholder";
import { useCoverage } from "../useCoverage";
import { suggestionMode, type SuggestionMode } from "../suggestions";
import { readBorough } from "../prefs";
import { withLocationAnchor } from "./locationAnchor";
import { categoryCards } from "./categoryCards";
import { resultSheetOpen } from "./resultSheetOpen";
import { ResultSheet } from "../sheet/ResultSheet";

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

// 024 P1: the "Common questions" card order — real, routable usecases first, the 2 never-auto-routed
// demo flows last (categoryCards.ts, unit-tested there).
const CATEGORY_CARDS = categoryCards(USECASES);

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

// Header dev controls (⚙ Key + dev-exit, dev mode only) beside the always-on Help toggle.
// 024 P0.2: the old accent-variant + theme toggles are gone from here — variants were dropped
// (tokens.css, row 1) and Appearance now lives in Settings (see screens/Settings.tsx).
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
    </div>
  );
}

// 020 P4d: a plain-language "what is this?" panel for less-technical / older users. Mirrors KeyPanel's
// show-gate so Home stays under the complexity gate.
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
      {/* 021 P2: the freshness explanation the hero used to lead with. It belongs here and on every
          result card (each carries its own date) — not in the fold's value slot. */}
      <p className="mt-2 text-text-muted">
        It is not a live search: we keep a snapshot of official registers — CQC, the Food Standards Agency,
        Historic England, Ordnance Survey — refreshed weekly. Every result shows the date on the record
        itself and links to the live page, so you can always confirm at the source.
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
// suggestion chips, and rotating example placeholder. Extracted from Home so each component's
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

// The post-results pivot row — its own component so the mode branch lives here, not in Home.
function TryAnotherRow({ mode, onPick }: { mode: SuggestionMode; onPick: (text: string) => void }) {
  if (mode !== "tryAnother") return null;
  return <SuggestionChips label="Try another:" ariaLabel="Try another search" onPick={onPick} />;
}

// 024 P2: the block that used to sit directly in <main> after a search — MOVED (not duplicated) into
// the ResultSheet overlay. Extracted to its own component so Home() itself stays under the complexity
// gate (the file's established reason for splitting components, see Hero's comment above).
function ResultBody({
  error,
  errorMsg,
  activeTitle,
  showSampleNote,
  isRunning,
  suggestions,
  onPick,
  devMode,
  status,
  events,
}: {
  error: string | null;
  errorMsg: string | null;
  activeTitle: string | undefined;
  showSampleNote: boolean;
  isRunning: boolean;
  suggestions: SuggestionMode;
  onPick: (text: string) => void;
  devMode: boolean;
  status: RunStatus | null;
  events: EventLogEntry[];
}) {
  const announce = activeTitle ? `Showing: ${activeTitle}` : "";
  return (
    <>
      {/* 024 P2: Scam Check has no live corpus (synthetic sample only) — say so beside the result
          itself, not just on the Home card, so nobody mistakes it for a real regulatory check. */}
      {showSampleNote && (
        <p className="px-3 py-2 text-sm text-text border border-border rounded bg-data-caution/10" role="note">
          Sample data — not a live FCA lookup. Always confirm on the official FCA register.
        </p>
      )}

      {error && (
        <div role="alert" className="mt-3 px-3 py-2 text-sm text-data-negative border border-border rounded">
          {errorMsg}
        </div>
      )}

      {/* aria-live announces the router's choice so the routing decision is not sighted-only. */}
      <p aria-live="polite" className={activeTitle ? "mt-3 text-sm font-semibold text-text" : "sr-only"}>
        {announce}
      </p>

      <div aria-live="polite" aria-busy={isRunning} className="mt-3">
        <A2UISurface />
      </div>

      <TryAnotherRow mode={suggestions} onPick={onPick} />

      <DevConsole show={devMode} status={status} events={events} />
    </>
  );
}

// 021 P2: the value proposition, in the slot the freshness caveat used to hold. A visitor's first
// question is "what does this know?", and until now the page only answered it after a successful query.
// Two lines: WHAT is covered, then the PROOF of scale. The count is live (useCoverage) and simply absent
// if the endpoint cannot be read — the categories still carry the message.
function CoverageLine({ count }: { count: string | null }) {
  return (
    <div className="mt-3 max-w-prose">
      <p className="text-text font-semibold">
        GPs · dentists · pharmacies · food hygiene ratings · parks &amp; heritage · firm checks
      </p>
      <p className="mt-1 text-text-muted">
        {count ? (
          <>
            <span className="text-text font-semibold">{count}</span> official London records — free, no
            sign-up, no account.
          </>
        ) : (
          <>Official London records — free, no sign-up, no account.</>
        )}
      </p>
    </div>
  );
}

// 021 P3: show the ANSWER before the first query. The strongest first-glance asset the app had was a
// result card — name, distance, date, official link — and it was invisible until a search succeeded.
// This is a real committed record (data/food-hygiene/establishments.sample.json, fhrs-1558876), rendered
// as copy and labelled as an example, so nothing here can be mistaken for a live result.
//
// Built from the card TOKENS rather than the `.qte-card` class: that rule is scoped under
// `.a2ui-surface` in index.css (the library's reset root), and borrowing the class outside that scope
// would couple this static card to the A2UI surface's styling contract. A few duplicated utilities beat
// the wrong abstraction here (AHA).
function SampleCard() {
  return (
    <div className="mt-6">
      <p className="text-sm text-text-muted">Here&apos;s what you get:</p>
      <div
        className="mt-2 max-w-prose p-4 rounded-[var(--radius-card)] bg-surface-lift border border-border"
        role="note"
        aria-label="Example of a result card"
      >
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-text">Brixton Kebab</span>
          <span className="text-sm text-text-muted whitespace-nowrap">Example</span>
        </p>
        <p className="mt-1 text-sm text-text-muted">120 m · near SW9 9SL</p>
        <p className="mt-1 text-sm text-text-muted">
          Food hygiene rating 4, inspected 2026-05-20 — confirm on the official FSA page.
        </p>
      </div>
    </div>
  );
}

// 024 P1: one card per catalog entry. The 4 real, routable usecases render like an ordinary corpus
// lookup; the 2 never-auto-routed demo flows (ADR 0004 — no keywords, a card tap is the ONLY way to
// reach them) carry a visibly distinct "Demo" badge so they never read as a real signpost. Scam Check
// additionally carries a "sample data" note — it has no live corpus, a synthetic sample only.
function CategoryCard({
  entry,
  onPick,
}: {
  entry: CatalogEntry;
  onPick: (text: string, usecaseId: string) => void;
}) {
  const isDemo = entry.keywords.length === 0;
  return (
    <button
      type="button"
      onClick={() => onPick(entry.example, entry.id)}
      className="text-left p-4 rounded-[var(--radius-card)] bg-surface-lift border border-border hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-text">{entry.title}</span>
        {isDemo && (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-text-muted/15 text-text-muted">
            Demo
          </span>
        )}
      </span>
      <span className="block mt-1 text-sm text-text-muted">{entry.blurb}</span>
      {entry.sampleData && (
        <span className="block mt-1 text-xs text-data-caution">Sample data — not a live check</span>
      )}
    </button>
  );
}

// 024 P1: always visible on Home, independent of search state — a standing way to ask a next question
// (results live in the ResultSheet overlay, not inline, so there is no "collapse after first search"
// reason to hide this the way the Hero's own extras collapse). No service-notice band, no "Recently
// looked up" — both dropped per the plan (no honest backing data yet).
function CategoryCardList({ onPick }: { onPick: (text: string, usecaseId: string) => void }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-text">Common questions</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {CATEGORY_CARDS.map((entry) => (
          <CategoryCard key={entry.id} entry={entry} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

function Hero({
  prompt,
  setPrompt,
  onSubmit,
  submitPrompt,
  isRunning,
  stop,
  showExamples,
  coverage,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: (e: SyntheticEvent) => void;
  submitPrompt: (text: string) => void;
  isRunning: boolean;
  stop: () => void;
  showExamples: boolean;
  coverage: string | null;
}) {
  const [inputFocused, setInputFocused] = useState(false);
  const placeholder = useRotatingPlaceholder(ROUTABLE_EXAMPLES, inputFocused || prompt.length > 0);
  return (
    <section className="pt-6 sm:pt-10">
      <p className="text-sm text-text-muted">London public services · free, no sign-up</p>
      <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-text">
        Ask in your own words. Get the official source.
      </h1>
      {showExamples && <CoverageLine count={coverage} />}

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
          <SampleCard />
          {/* 021 P2: the honesty line stays visible — one compact sentence, below the value, with the
              full explanation one tap away in "?" (HelpPanel). It is repeated on every result card. */}
          <p className="mt-4 text-sm text-text-muted max-w-prose">
            A weekly snapshot of official registers, not a live search — every result carries its own date
            and links to the official page. No cookies; anonymous page-view counts only.
          </p>
        </>
      )}
    </section>
  );
}

export function Home() {
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
  // 021 P2: the live record count for the hero's coverage line (null until read; null forever if the
  // freshness endpoint cannot be reached — the line then states the categories alone).
  const coverage = useCoverage();

  // 024 P2: which usecase actually drove the CURRENT/last submission. `resolved` (USECASE_RESOLVED)
  // only fires when the Worker auto-routes a prompt-only ask — worker.ts's resolveTarget marks any
  // explicit ?usecase= run (a category-card tap, or a deep link) `routed: false` and never emits it. So
  // a card tap needs its own tracking, seeded from the mount-time bypass so a deep link is honoured
  // immediately, before any submission.
  const [activeUsecaseId, setActiveUsecaseId] = useState<string | undefined>(bypass ?? undefined);
  // 024 P2: has the sheet been explicitly dismissed since the last submission? Reset on every
  // submitPrompt call so a new search always reopens it, even after a manual close.
  const [dismissed, setDismissed] = useState(false);
  // resultSheetOpen.ts (unit-tested) — deliberately not just `hasSearched`, see its comment: a failed
  // run must keep the sheet open to show the error, even though `hasSearched` itself reverts to false.
  const sheetOpen = resultSheetOpen({ hasSearched, error, dismissed });

  // The workflow actually driving the CURRENT/last run, looked up in the SAME catalog the cards render
  // from — so the "Showing …" announcement and the Scam Check sample-data note both key off one source
  // of data, never a second hardcoded usecase id.
  const activeDef = USECASES.find((u) => u.id === (resolved?.usecase ?? activeUsecaseId));
  const activeTitle = activeDef?.title;
  const showSampleNote = activeDef?.sampleData === true;

  // 018 P5: shared submit — a chip click and the form both funnel through here. Pass the text DIRECTLY
  // (not the `prompt` state, which setPrompt hasn't committed yet on a chip click) to dodge a stale closure.
  // 024 P0.2: `usecaseId` is a NEW optional per-submission override — row 4's category-card tap passes
  // its own id here, without touching the URL/mount-time `bypass`. Falls back to the mount-time bypass,
  // then to the Worker's auto-router, exactly as before.
  // 024 P1: applied here (not at each call site) so EVERY Home submission — hero search, "Try:"/"Try
  // another:" chips, and category-card taps alike — gets the same default-location ANCHOR, one place,
  // DRY. `readBorough()` is read fresh per submit (no state needed: it is write-once in Settings,
  // read-only here, and Home remounts on every tab switch anyway).
  const submitPrompt = useCallback(
    (text: string, usecaseId?: string) => {
      setPrompt(text);
      setActiveUsecaseId(usecaseId ?? bypass ?? undefined);
      setDismissed(false);
      const anchored = withLocationAnchor(text, readBorough());
      const byok: Byok | undefined = apiKey ? { apiKey, model } : undefined;
      void run(anchored, byok, false, usecaseId ?? bypass ?? undefined);
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
    <>
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
          coverage={coverage}
        />

        {/* 024 P1: always visible, independent of search state — results now live in the ResultSheet
            overlay below, not inline, so there is no "hide after first search" reason to hide this too. */}
        <CategoryCardList onPick={submitPrompt} />
      </main>

      {/* 024 P2: results moved out of <main> into a bottom-sheet overlay, driven by the same
          submitPrompt funnel that opens it. Closing only hides the sheet — the run underneath (and its
          eventLog/status/error state, held in this component) is untouched, so reopening by searching
          again shows it continuing or its finished result. */}
      <ResultSheet
        open={sheetOpen}
        onClose={() => setDismissed(true)}
        isRunning={isRunning}
        onStop={stop}
        label={activeTitle ? `Showing: ${activeTitle}` : "Search results"}
      >
        <ResultBody
          error={error}
          errorMsg={errorMsg}
          activeTitle={activeTitle}
          showSampleNote={showSampleNote}
          isRunning={isRunning}
          suggestions={suggestions}
          onPick={submitPrompt}
          devMode={devMode}
          status={status}
          events={eventLog}
        />
      </ResultSheet>

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
        {/* 021 P5: the builder/engine story lives HERE, not above the fold — the fold speaks only to a
            Londoner with an errand. Each workflow is a JSON stage-def read at runtime; add one, add a
            workflow. */}
        <a
          href="https://github.com/qte77/ldnmxx-hack"
          className="underline underline-offset-2 hover:text-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open source — each workflow is a JSON file, not a rebuild
        </a>
        .{" "}
        <span title="deployed release" className="whitespace-nowrap font-mono">
          v{__APP_VERSION__}
        </span>
      </footer>
    </>
  );
}
