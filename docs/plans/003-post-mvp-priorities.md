---
title: "Plan 003 — post-MVP priorities: doc-truth + `usecases/*.json` + flagship depth"
type: plan
updated: 2026-07-04
---

# Plan 003 — post-MVP priorities

Phase 1 is **done and live** (SPA → `/run` SSE → A2UI cards, both tracks, real model on Track B). This
plan is the **prioritized roadmap after that**, plus a **doc-truth pass** (several docs drifted from what
shipped). It carries a **code/file/source map** so the next session does **not** need to re-gather context.
Companion resume note: `../handoffs/004-post-mvp-priorities.md`.

## Current shipped state (what is LIVE)

- **Live demo:** SPA <https://qte77.github.io/ldnmxx-hack/> → deployed Worker
  <https://ldnmxx-hack-worker.cloudflare-driveway392.workers.dev> (`POST /run?usecase=<id>` → AG-UI SSE →
  built-in **A2UI cards**). Verified end-to-end via patchright.
- **Track B (`founders-copilot`)** render = **real OpenRouter model call** (generates the A2UI grant cards
  grounded in the demo corpus via a forced `render_ui` tool). Falls back to a **deterministic stub** when
  there's no key, on model error/timeout, or when `?demo=1`.
- **Track A (`on-it`)** = **canned stub** route (no voice/TfL/map — those are unbuilt).
- **Demo-safe gate:** the SPA **auto-runs** an example on load with `?demo=1` → forces the free stub (so
  page loads/bots can't burn the model key); only a **manual Run** hits the model.
- **UI extras:** usecase toggle (swaps the input query) · optional **BYOK** field (⚙ Key) · **theme toggle**
  (☀/☾) · **live component catalog** (◫ Catalog → renders actual A2UI components). Track A leads on load.
- **Secrets set as Worker secrets:** `OPENROUTER_KEY`, `ARIZE_API_KEY` (⚠️ **time-bound demo keys, expire
  2026-07-04**). Local `worker/.dev.vars` mirrors them (gitignored).
- **Observability:** console `⌁ span` per stage (incl. `model:openrouter{model,tokens}`) → `wrangler tail`
  **and** Cloudflare dashboard (Workers ▸ Observability, `head_sampling_rate=1`). **No Arize-dashboard
  export** (console/CF only — issue #21).
- `git main` == prod. CI-gated PRs (docs/security/ui/worker + CodeFactor), squash-merged.

## Code / file / source map (don't re-map this)

| Area | File | What it does / where to change |
|---|---|---|
| **Worker entry** | `worker/src/worker.ts` | `/run` handler: CORS(+OPTIONS), SSE `ReadableStream`, `resolveRun()` (key/model/baseURL/pace/**demo** resolution), `runStages()` (async, paced, span per stage), `preRenderStages()` (**hardcoded** plan/tool per usecase), `renderBatch()` (Track A stub; Track B → `callRenderModel` else stub). `USECASES = Set(["founders-copilot","on-it"])`. **Env:** `OPENROUTER_KEY, ARIZE_API_KEY, ALLOWED_ORIGINS, AI_GATEWAY_URL, DEFAULT_MODEL, PACE_MS`. |
| **Model call** | `worker/src/agent/model.ts` | `callRenderModel()` (OpenAI-compatible fetch to OpenRouter, forced `render_ui` tool, **`max_tokens: 8000`** — 1500 truncated the batch), `extractBatch()`, `isValidBatch()`, `A2UI_RULES` (system prompt), `RENDER_UI_TOOL`. |
| **Card builders** | `worker/src/a2ui/cards.ts` | `cardsBatch()` helper → self-contained v0_8 batch; `buildOpportunityCards()` (Track B stub), `buildRouteCards()` (Track A). Imports `../../../data/demo/{opportunities,route}.sample.json`. |
| **Tracing** | `worker/src/trace/arize.ts` | `makeEmitter(env)` → `consoleEmitter` (keyless) or `arizeEmitter` (**stub — still console**). `Span`/`Emitter`. Real Arize export = issue #21. |
| **Worker config** | `worker/wrangler.toml` | name `ldnmxx-hack-worker`, `[observability] enabled + head_sampling_rate=1`, `[vars] ALLOWED_ORIGINS`. |
| **Worker tests** | `worker/test/{run,model}.test.ts` | plain vitest `worker.fetch(req,env,ctx)`; run tests set `PACE_MS:"0"`. |
| **Worker env** | `worker/.dev.vars.example` (runtime secrets), `worker/.env.example` (CF **deploy** auth: `CLOUDFLARE_API_TOKEN`) | ⚠️ **`DEFAULT_MODEL` + `PACE_MS` are read in code but missing from `.dev.vars.example`.** |
| **UI shell** | `ui/src/App.tsx` | `USECASES` array (id/label/hint/placeholder/**example**), toggle (swaps query), prompt+Run, BYOK (⚙ Key), `<CatalogViewer>`, `<ThemeToggle>`, **auto-run on mount** (Track A, `demo=1`), `onSubmit` (manual → model). |
| **Transport** | `ui/src/agent/useAgentSSE.ts` | `parseSSE()` + `useAgentSSE()` hook: `run(usecase, prompt, byok?, demo?)` → `fetch ${WORKER_BASE}/run?usecase=…${demo?"&demo=1":""}`; `readSSE`, `buildHeaders`, `toConnectionError`. |
| **Render seam (reused agenthud)** | `ui/src/agent/applyA2UIEvent.ts`, `ui/src/agent/contract.ts`, `ui/src/A2UISurface.tsx`, `ui/src/EventStream.tsx`, `ui/src/index.css` | never-silent-blank render + zod A2UI batch validation + EyeRest theme. **Copied verbatim** — keep in sync with source repo. |
| **Catalog** | `ui/src/CatalogViewer.tsx` (modal/button) + `ui/src/catalog.ts` (`buildCatalogBatch()`) | renders one live example of each core A2UI type. |
| **UI config** | `ui/src/config.ts` (`WORKER_BASE`), `ui/vite.config.ts` (`base` CI→`/ldnmxx-hack/`, proxy `/run`→:8787, vitest node), `ui/.env.example` (`VITE_WORKER_BASE`, `VITE_BYOK_*`) | prod `WORKER_BASE` is the workers.dev URL, baked in. |
| **Demo data** | `data/demo/opportunities.sample.json`, `data/demo/route.sample.json` | the only data source today (**no KV**). |
| **Usecase defs** | `usecases/README.md` | **placeholder — no `usecases/*.json` exist yet** (Tier 1 target). |
| **CI/CD** | `.github/workflows/ci.yml` (docs/security/ui/worker), `.github/workflows/gh-pages.yml` (build `ui/` + deploy Pages on push→main) | actions already on node 22 (no Node-20 issue). |
| **Launcher** | `Makefile` | `help/dev/dev-ui/dev-worker/test/deploy/seed/demo`. |

**Source / reuse repos (siblings):**
- `/workspaces/qte77/agenthud-agui-a2ui` — SPA/A2UI core (the verbatim-reused files above; `CatalogViewer`
  pattern; `ui/node_modules/@a2ui/react/v0_8/index.d.ts` = the A2UI shape source of truth).
- `/workspaces/qte77/polyfetch-scrape` — the fetcher (not wired). Its `.venv/bin/python` has **patchright**
  for live verification/screenshots (`from patchright.sync_api import sync_playwright`).

**Environment gotchas (this dev container):**
- `npx` is rewritten to `npm run` — use `./node_modules/.bin/<bin>` (e.g. `wrangler`).
- Bash denies `grep|ls|head|tail|cat|find|source|curl` (estate settings) — use dedicated tools / git.
- Prefix all git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`; commit `--no-gpg-sign`, identity
  `qte77 / 93844790+qte77@users.noreply.github.com`.
- **Deploy:** `cd worker && ./node_modules/.bin/wrangler deploy` (uses ambient `CLOUDFLARE_API_TOKEN` from
  `worker/.env`). UI deploys via gh-pages CI on push→main. Prod secrets: `wrangler secret bulk <file>` /
  `wrangler secret put NAME`.
- Convention: branch → CI-gated PR → **squash**-merge → delete branch.

## Doc-truth audit (Tier 0 — fix before relying on the docs)

Verified stale/false vs shipped:
- `README.md` — missing model/catalog/theme/BYOK/Track-A-default; **claims KV + AI Gateway** (neither
  active) + `usecases/*.json` (doesn't exist); **Worker URL undocumented**.
- `docs/architecture.md` — untouched since scaffold: claims `usecases/*.json` swap, KV `OPPORTUNITIES`,
  AI Gateway; no mention of the real model call / stub / demo-gate / observability.
- `docs/demo-script.md` — scripts **voice/OSM-map/TTS/replay** (`ui/src/recordings/on-it.json`) that don't
  exist; ~half is unperformable as written.
- `docs/handoffs/003-phase1-done.md` — line ~40 "stub makes no model call" now **false**.
- `docs/design.md` + `docs/submission.md` — reference a **`UsecaseInspector`** never built.
- `ui/README.md` + `worker/README.md` — still say **"Not scaffolded yet"** (both are fully built/deployed).
- `data/README.md` — "keyless/offline fallback when KV is empty" (no KV).
- Undocumented but real: **Worker URL**, `?demo=1`, `?theme=light|dark`, `DEFAULT_MODEL`, `PACE_MS`,
  prod secret-setup commands.
- **Head start:** `gh pr diff 23` (closed PR) already fact-checked `architecture.md`/`submission.md` for the
  JSON/UsecaseInspector/KV/AI-Gateway claims — recover + layer with what shipped after (PRs #24/#25).
- **`docs/submission.md` is PARKED** — the user rewrote it and re-introduced these claims; **do not edit it
  without the user's go-ahead** (they may want aspirational framing).

## Prioritized plan (ROI × feasibility; it is demo day 2026-07-04)

**Tier 0 — doc-truth (~1–2h, zero risk, do first).** Fix the audit list above + write handoff 004.
Highest ROI/effort — the deck + READMEs are what judges inspect. Files: `README.md`, `docs/architecture.md`,
`docs/demo-script.md`, `docs/design.md`, `ui/README.md`, `worker/README.md`, `data/README.md`,
`worker/.dev.vars.example` (+`DEFAULT_MODEL`/`PACE_MS`). Leave `submission.md` to the user.

**Tier 1 — make the pitch real: externalize `usecases/*.json` (🟢 High ROI · 🟡 Med).** The "swap a JSON,
swap the app" claim is hardcoded TS today. Convert `preRenderStages()`/`renderBatch()` switches in
`worker/src/worker.ts` into a small stage-def **interpreter** reading `usecases/founders-copilot.json` +
`usecases/on-it.json`. Schema is already specified in `docs/usecase-workflows.md` (`{id,title,
systemPrompt,tools[],stages:[{kind:plan|tool|render,…}]}`); the ~60-LOC `runStages` design is in
`docs/plans/001`. Keep the model render + stub fallback. Deliverable: editing/showing a JSON on stage
demonstrably swaps the app.

**Tier 2 — deepen the flagship (each independent; do in this order):**
1. **#12 incorporation verified-pack card (🟢/🟢):** add an `incorporate` render stage to founders — a Card
   of real gov.uk/Companies-House links (links verified in `docs/usecase-workflows.md`; **not** a live
   filing). Files: `worker/src/a2ui/cards.ts` (+`buildIncorporateCard`), `worker/src/worker.ts` (+stage).
2. **AI Gateway (🟡/🟢, config-only):** set `AI_GATEWAY_URL` (worker var/secret) to the CF AI-Gateway
   OpenRouter URL — `worker.ts` already uses `env.AI_GATEWAY_URL || OPENROUTER_BASE`. Makes the stack claim
   true + adds caching/analytics.
3. **#18 model reasoning stages (🟢/🟡):** real model calls for `assess_stage` + `search_opportunities`
   (not canned pre-render). Add a text-completion helper to `worker/src/agent/model.ts`; wire into
   `runStages`. +latency/cost — keep behind the demo-gate.

**Tier 3 — post-hackathon (leave tracked, don't touch today):** issues #4 (Track A voice), #8 (Open311), #9 (find_contacts + corpus), #21 (Arize export), KV grounding, #10 (cron), #13 (D1), #6 (AG Grid), #7 (ElevenLabs), #11 (A2A).

## Issue hygiene
- **Close #3** (Phase-2 Track B) — near-duplicate of the up-to-date **#18**; comment that the render-stage
  model call already landed (PRs #19/#22).
- **Open 3 issues:** (a) externalize `usecases/*.json` (Tier 1); (b) wire **or explicitly drop** AI Gateway
  and KV from the pitch; (c) doc-truth corrections (Tier 0, if not done inline).
- Deferred #6–#13 verified unbuilt — leave open.

## Verify (reuse, don't reinvent)
- Tests: `make test` (ui + worker). Local: `make dev` (`:5173` proxy → `:8787`); spans `cd worker && npm run tail`.
- **Live E2E (patchright):** `"/workspaces/qte77/polyfetch-scrape/.venv/bin/python" <script>` driving
  `https://qte77.github.io/ldnmxx-hack/` — click Run, assert cards; check `wrangler tail` for
  `model:openrouter`. Reuse the pattern from the previous session's scratchpad scripts.
