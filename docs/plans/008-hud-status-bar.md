---
title: "Plan 008 — PR-3: HUD status bar (Demo⇄Live + mode/model + cost)"
type: plan
updated: 2026-07-10
issue: 18
part_of: docs/plans/007-phase2-model-pipeline.md  (this is plan 007's PR-3, reshaped)
pairs_with: docs/handoffs/008-hud-status-bar.md
status: approved, 0% built
---

# Plan 008 — PR-3: HUD status bar (Demo⇄Live + mode/model + cost)

> **Approved, 0% built.** This is **plan 007's PR-3**, reshaped from "a cost chip" into a HUD status bar +
> Demo/Live toggle. The **Source map** at the bottom is the current code state (`main`, post-PR-2) — trust
> it instead of re-exploring. Strict TDD, module-level tests only.

## Context

Now that the model path actually runs live (after the `ai.run` bind fix, **#62**), the deterministic
**stub** and the **live agent** produce visibly different output — but the UI gives a viewer **no way to
tell which they're seeing**, and no way to *choose*. Two concrete gaps:

1. **The documented `?demo=1` switch is unreachable from the browser** — `App.tsx` `onSubmit` calls
   `run(usecase, prompt, byok)` and never forwards `demo` (`useAgentSSE.run` accepts it, defaulting false).
   So the deterministic demo mode can't be selected in the UI at all.
2. **The answering model + token usage never reach the UI** — `renderBatch` returns a bare `unknown[]`;
   provider/model/usage live only in Arize spans. So the UI can't show cost or which model answered.

The "agents decide, restricted to the corpus" contract is **already live** (the `search_opportunities`
validator rejects invented ids; the render is grounded in the model's matches). PR-3 is purely the
**transparency + control layer**: a Demo⇄Live toggle and an honest status chip.

## Decisions (locked)
- **3-state honest chip:** `LIVE · <model> · ~N tok` / `DEMO · deterministic` / `STUB · fell back`
  (STUB = a founders run whose model path failed and degraded to canned — truthful, not hidden).
- **Tokens, not `$`** (the free chain never spends; a `$` rate is BYOK-only, out of scope — YAGNI).
- **Toggle default = Live** (today's behavior); Demo is the opt-in deterministic path.
- **`USAGE` event intercepted in `useAgentSSE` `dispatch`** (like `RUN_ERROR`), NOT via `applyA2UIEvent`
  (which drops non-`type/text` fields). Unknown event types already transit end-to-end untouched.

## Changes

### Worker
- **`renderBatch`** → return `{ batch, meta }`, `meta = { model, provider, usage } | null` (null for
  `route`/stub). Update its one caller in `runUsecase`.
- **`resolveRun`** → add `demo` to `runAttrs` so `runUsecase` can tell DEMO from STUB.
- **`runUsecase`** → accumulate token usage across the live stages (`outcome.usage`, already in hand) + the
  render (`meta.usage`); derive `mode` (`meta` ⇒ `live` w/ model+provider; else `route`/`demo` ⇒ `demo`;
  else ⇒ `stub`); emit ONE terminal event
  `{ type:"USAGE", mode, model?, provider?, promptTokens, completionTokens, totalTokens }` **between the
  render write and `RUN_FINISHED`**. `AgentEvent` already tolerates extra fields (SSE `JSON.stringify`s the
  whole object; `parseSSE` accepts any object with a string `type`).

### UI
- **`App.tsx`** — add a **Demo⇄Live toggle** in the header cluster (copy the usecase-toggle button
  pattern), a `[demo,setDemo]` state, and pass `demo` in the `onSubmit` `run(...)` call.
- **`useAgentSSE.ts`** — intercept `USAGE` in `dispatch` (like `RUN_ERROR`) → set a new `status` state via a
  tiny pure `toStatus(event)` mapper; reset per run; return `status` from the hook.
- **Status chip** — render in the aside header row ("AG-UI Events", has room) reading `status`. Before any
  run the *toggle* shows intent; the *chip* shows what the last run actually did.

## TDD (strict; module-level only)
- **`worker/test/run.test.ts`**: a live run (`stageAwareAi` fake) emits ONE `USAGE` frame immediately
  before `RUN_FINISHED`, `mode:"live"` + a `model` + summed tokens; `?demo=1` → `mode:"demo"`, tokens 0;
  a model-fail run → `mode:"stub"`. Reuse `parseFrames`.
- **`ui/tests/useAgentSSE.test.ts`**: `parseSSE` round-trips a `USAGE` frame; `toStatus(usageEvent)` maps to
  `{mode, model, tokens}` (pure fn — **node env, no jsdom**).
- **No React render tests** — ui tests are node-env pure-function only; the chip JSX is display glue.

## Docs & issues (pre-answered checklist)
- **CHANGELOG** — HUD status bar + Demo⇄Live toggle (wires `?demo=1` from the UI) + `USAGE` event.
- **Root README** — fix the **`Switches`** line (`?demo=1` is now a real UI toggle, was unreachable from the
  browser) + clarify demo (deterministic) vs live (agents) in the "keyless demo path" wording.
- **`docs/architecture.md`** — one line: SSE vocabulary gains a terminal `USAGE` event.
- **`docs/plans/007`** — PR-3 row already points here (008); keep in sync.
- **`docs/UserStory.md`** — "As a viewer I can tell whether I'm seeing the deterministic demo or the live
  agent, and switch between them."
- **URL/env/CLI** — only `?demo=1` (now UI-wired). No new env / URL / CLI.
- **Issues** — open "Demo/Live toggle + honest mode indicator (wire `?demo=1`)" (or fold into #18); 1-liner
  for the invalid `OPENROUTER_KEY` (401) being rotated. Lands under #18.

## Workflow
Branch `feat/phase2-pr3-hud-status` (off `main` **after #62 merges**, else off `main` + rebase) → commit by
topic → CI-gated PR → squash-on-green → prune. Identity: GitHub noreply, `--no-gpg-sign`, prefix git/gh with
`env -u GH_TOKEN -u GITHUB_TOKEN`. Tick living handoff 007 (PR-3 ✅ → PR-4 next). PR body via `--body-file`.

## Verification
- **Per PR:** `make test` · worker `tsc --noEmit` · ui typecheck/lint/build · markdownlint · CodeQL.
- **Live (polyfetch on the deployed site):** a **Live** founders Run → chip `LIVE · workers-ai · N tok` +
  streamed reasoning; flip to **Demo** → chip `DEMO · deterministic`, all stages canned, sub-second, no
  model call; a forced model failure (bogus `WORKERS_AI_MODEL`) → chip `STUB · fell back`.

## Dependency / ordering
PR-3 is UI + a worker `USAGE` event — does **not** depend on #62's code, but the **live re-verify** needs
#62 (bind fix) merged + deployed so "Live" actually streams reasoning. Recommend: merge #62 → redeploy →
then this PR. The invalid `OPENROUTER_KEY` (401) is a dead fallback tier now — harmless with Workers AI as
tier 1 (rotate to a capped `:free` key when convenient).

## Out of scope
BYOK `$`-cost rate · per-stage cost breakdown · corpus enhancement + the 3 new usecases (plan 007 **PR-5**).

---

# Source map — current code (`main`, post-PR-2; don't re-explore)

Line numbers are current anchors (post-PR-2 merge). `worker/src/agent/providers.ts` numbers are pre-#62
(the bind fix adds ~3 lines around the `ai.run` call) — trivial drift.

## UI event rendering (the HUD)

### `ui/src/EventStream.tsx` (73 lines) — the event log list
- Props `{ events: EventLogEntry[] }` only (`:6-8`).
- `badgeColor(type)` — prefix-matched styling (`RUN_`, `TEXT_MESSAGE`, `TOOL_CALL`, `STEP_`); **unknown
  types fall through to a neutral default** (`:11-17`, default `:16`) → a `USAGE` row renders harmlessly.
- Component + autoscroll (`:23-29`); scroll container (`:31-35`); empty state (`:36-40`); event-row map
  (`:41-55`, badge span `:47-51`); A2UI summary sub-row (`:56-68`).
- **Chip does NOT belong in the map.** Natural slots: **(a) the aside header** `App.tsx:182-184`
  ("AG-UI Events", `h-10 flex items-center` — room for a right-aligned chip) ← preferred; (b) a sticky bar
  in EventStream between `:35`/`:36`; (c) the main header cluster.

### `ui/src/agent/applyA2UIEvent.ts` — the render/log seam
- `EventLogEntry` (`:4-11`): `{ type; timestamp; text?; a2uiComponentCount?; a2uiComponentTypes? }`.
- `AgentEvent` (UI) (`:14-19`): `{ type; text?; a2uiMessages? }`.
- `applyA2UIEvent` (`:66-106`) builds the entry at `:71-75` copying **only `type/timestamp/text`** →
  **extra fields (model/usage/provider) are DROPPED here.** ⇒ do NOT route USAGE data through this;
  intercept upstream (below).
- `appendLogEntry` (`:114-125`) only special-cases `TEXT_MESSAGE_CONTENT` coalescing (`:119`).

### `ui/src/App.tsx` — header + wiring
- Header region `:90-127`. **Usecase toggle button pattern to copy for Demo⇄Live:** `:98-115` (onClick
  sets state `:102-105`; active styling ternary `border-primary text-primary` vs
  `border-border text-text-muted hover:border-primary` `:107-111`). Sibling buttons: CatalogViewer `:116`,
  "⚙ Key" `:117-124`, ThemeToggle `:125` (component pattern `:34-57`).
- **Demo wiring gap:** `onSubmit` (`:70-77`) → `void run(usecase, prompt, byok);` at **`:74`** — the ONLY
  `run(...)` call site, and it passes **no `demo`**. Aside header (chip slot) `:182-184`.

### `ui/src/agent/useAgentSSE.ts` — transport + dispatch
- `run(usecase, prompt, byok?, demo = false)` (`:161`); BYOK gate `!demo` (`:179`); → `runWorkerPath(...,
  demo, ...)` (`:185`). The **only** place `&demo=1` is appended: `:129`
  `` `${WORKER_BASE}/run?usecase=...${demo ? "&demo=1" : ""}` ``.
- **`dispatch`** (`:172-176`): `if (event.type === "RUN_ERROR") setError(...)` at `:173`, then
  `applyA2UIEvent` + append. **Intercept `USAGE` here** (event still has all fields) → `setStatus(toStatus(event))`.
- `parseSSE` (`:34-59`) accepts any object with a string `type` → USAGE frames transit fine.
- Hook returns `{ eventLog, isRunning, error, run, stop }` (`:198`) → add `status`.

### UI tests — `ui/tests/*.test.ts` (external to src per AGENTS.md)
- Only `ui/tests/useAgentSSE.test.ts` + `ui/tests/liveAgent.test.ts`. **vitest node env, NOT jsdom**
  (`ui/vite.config.ts:17-21`; no testing-library in deps). Extend: `parseSSE` suite (`:6-37`) for a USAGE
  frame; `applyA2UIEvent`/pure-fn suite (`:39-84`) for `toStatus`. No component render tests.

## Worker → UI vocabulary

### `worker/src/worker.ts`
- **`renderBatch`** (`:56-89`) returns bare `unknown[]`. Route → `buildRouteCards()`; stub short-circuit
  when `!ctx.key && providers.length===0`. Keyed path `{model,usage}` → span `model:openrouter` (`:79`);
  free path → `renderFree` → span `` `model:${free.provider}` `` (`:84`). ⇒ **change to return
  `{batch, meta}`**; meta from the keyed/free result (`{model, provider, usage}`), null for route/stub.
- **`runUsecase`** (`:247-287`): `RUN_STARTED` `:256`; live-stage `TOOL_CALL_START`/`TEXT_MESSAGE_CONTENT`
  (reasoning)/`TOOL_CALL_END` `:266-268`; `StageOutcome` (`:207-212`) `{reasoning, model, usage, matches?}`
  from `runStageModel` (`:216-242`), `outcome.usage`/`.model` used only by `emitter.span` `:270` (only
  `matches` survives the loop `:269`); canned events `:275-278`; render write + `a2uiMessages` `:284`;
  `RUN_FINISHED` `:286`. **Emit `USAGE` between `:284` and `:286`.** SSE `write` `JSON.stringify`s the whole
  event (`:330-332`).
- **`resolveRun`** (`:148-192`): `forceStub = demo || injection.flagged` (`:169`); `runAttrs.model =
  modelLabel(...)` (`:183`, `modelLabel` `:126-130` → `"(stub)"`/BYOK-model/`"free-chain"`); `runAttrs` has
  `usecase, reqId, byok, blocked` (`:180-186`). ⇒ **add `demo` to `runAttrs`.**

### `worker/src/agent/providers.ts` (post-generalization, PR-2)
- `renderFree(providers, args): Promise<{result: ModelResult; provider: string} | null>` (`:144-149`);
  `runChain` (`:132-141`); `ModelResult = {batch, model, usage}` / `ModelToolResult<T> = {value, model,
  usage}` in `worker/src/agent/model.ts` (`ModelResult` `:17-21`, `ModelToolResult` `:24-28`,
  `callRenderModel` `:123-132`). `usage = {promptTokens?, completionTokens?, totalTokens?}`.
- ⚠️ NOTE: the `ai.run` **bind fix is on PR #62** (not yet merged into this branch's base). PR-3 doesn't
  touch this, but the live re-verify needs #62 deployed.

### `worker/src/usecases.ts`
- `AgentEvent` (`:7-11`): `{ type: string; text?: string; a2uiMessages?: unknown[] }` — extra fields on a
  written event survive to the UI (only dropped at `applyA2UIEvent`). A `USAGE` event with extra fields is fine.

### Worker tests — `worker/test/run.test.ts`
- `parseFrames` helper `:32-37`; frame-sequence assertions e.g. `:118-123`; span assertions via
  `console.log` spy `:132-143`; demo-stub test `:166-178`; `stageAwareAi` fake (returns the right tool per
  `tool_choice`) — added in PR-2 (returns assess/search structured output + render batch). Extend these.

## The one rule
`USAGE` is emitted ONCE per run, terminal (before `RUN_FINISHED`); the chip reflects the LAST run's actual
mode/model/tokens. The toggle reflects the NEXT run's intent. Honest 3-state: never show "LIVE" when the
model fell back — show "STUB".
