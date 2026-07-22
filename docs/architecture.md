# Architecture

## One core, three seams

One `POST /run?usecase=<id>` endpoint → a small `runUsecase` interpreter (plan → tool → render) → an A2UI
HUD. The SPA flips between the two demo workflows (**Founder's Copilot ⇄ On It**) via a toggle over the
`?usecase=` param; each workflow's stage choreography is a `usecases/*.json` read at runtime
(`worker/src/usecases.ts`), and render + deterministic query dispatch **by name** through the
`worker/src/workflows.ts` **registry** (`render` by mode — `founders`/`route`/`corpus`/`scam`; `query` by
exec) — so adding a **corpus** (nearest-N) workflow is **register-only**, never an engine edit (open/closed;
ADR 0001); a **match**-shaped workflow (`scam`) needs a new mode + exec + its own module. Per workflow,
only these seams change:

| Seam | Founder's Copilot | On It |
|---|---|---|
| `tools[]` | `assess_stage` + `search_opportunities` — **live model tools** (each streams reasoning + its own Arize LLM span, #18); `find_contacts` (#9) · `incorporate` (#12) planned | lookup_postcode · get_tfl_journey — **PLANNED**; On It is a canned stub today |
| `render` | built-in A2UI cards (Column/Card/Text) | static `buildRouteCards()` text today; RouteCard + lazy OSM `RouteMap` panel is **PLANNED** |
| `input()` | text | text today (canned stub); voice (Web Speech STT + text fallback) is **PLANNED** |

**Deterministic corpus workflows** (e.g. **Sort My Care**, **Sort My Wander**, `render.mode:"corpus"`,
#72/#80) are a fourth shape: a model-free + fetch-free `query_corpus` exec over a bundled corpus
(`shared/sanitize.ts` → `worker/src/geo.ts` → `worker/src/corpus/*`) → card render + a curated disclaimer —
registered, not wired into the core, and honestly reported as `USAGE mode:demo`. The mode and exec are
**generic over a corpus id** (#80), so a new nearest-N one is a `corpus/registry.ts` entry + a JSON + a UI
entry with no engine TS: the query pre-formats each row's display line (so the render is shape-agnostic),
and the load-guard rejects an unregistered `corpus` id at startup. The query seam returns a `Promise` so a
D1-backed source can replace the bundled JSON without touching dispatch.

**Match-shaped workflows** are a fifth shape, shipped by **Sort My Scam Check** (#140): a firm name/FCA
number **lookup**, not a nearest-N over coordinates, so it does NOT fit the frozen geo `CorpusRecord` and
is NOT register-only — it needed its own `scam` render mode + `query_scam` exec, registered in
`workflows.ts` alongside `corpus`/`query_corpus`, and lives in its own `worker/src/scam/{registry,query,
render}.ts` module (reusing the geo-agnostic `CorpusRow` + `a2ui/cards.ts`'s `cardsBatch`/
`appendDisclaimer`, but never `corpus/render.ts`'s geo-worded copy). Every result routes to the FCA
register and no status is ever presented as "safe" — a flag, never a verdict. See
[`usecase-workflows.md`](usecase-workflows.md) + ADR [`0001`](adr/0001-general-workflow-engine.md).

**Model-chain robustness (H3/H4, #141).** `agent/model.ts`'s `callModelTool` now classifies a failed HTTP
status as transient (`429/500/502/503/504` — retried ONCE, honoring `Retry-After` capped at 60 s) or fatal
(everything else, incl. 401/407 auth, 404/410 gone, 451 legal — fails fast via `describeModelStatus`); a
thrown fetch (network error / abort) is never retried, and the `… | null` fallback contract is unchanged.

**Freshness integrity (H5, #142).** `worker/src/dates.ts` (`isIsoDate` + `oldestIsoDate`) validates the
`asOf` freshness date: the corpus + scam queries advertise the oldest **valid** ISO date across the shown
rows, excluding any malformed value, so a "data as of …" trust claim can never be wrong because of a bad
date — landed ahead of the W4 real-data ingest.

**Single-sourced mode/exec unions (H6, #143).** `usecases.ts`'s `RENDER_MODES`/`STAGE_EXECS` are `as const`
arrays that are the single source; the `RenderMode`/`StageExec` union types are DERIVED from them, and
`workflows.ts`'s `registry.render` is a total `Record<RenderMode, RenderFn>` — so `tsc`, not just tests,
now catches drift between the two. Closes ADR-0001's known "two sources of truth" Consequences minus.

## Data flow — one direction, one trust crossing

```
user input → SPA useAgentSSE ──POST /api/run?usecase=<id>──▶ Worker  [TRUST BOUNDARY — secrets here]
                                                          runUsecase: plan → tool → render
                                 ◀── SSE {type,text,a2uiMessages} + terminal USAGE + RUN_FINISHED ──
   SPA: parse frames → AgentEvent → applyA2UIEvent (validate vs contract.ts) → render seam
        → A2UI surface (built-in Column/Card render)  +  EventStream (live log)

  PLANNED, out of band (ingest/ unbuilt, no KV binding exists): ingest/seed.py → polyfetch →
  opportunities.json → KV OPPORTUNITIES. Today the live data source is the committed
  `data/demo/*.json`.
```

Open data sources available for future workflows are cataloged (machine-readable) in
[`data/sources.json`](../data/sources.json); candidate workflows in [`data/usecase-catalog.json`](../data/usecase-catalog.json).

**Browser never calls a model API (013 · A).** The SPA's only network egress is `POST /api/run` (and
`/api/trace`) to the **same-origin Worker** — there is no direct-to-model path. An optional BYOK key is
forwarded to the Worker as an `Authorization` header and resolved **server-side** (`resolveRun`); the
leaked browser-BYOK path (`liveAgent` → OpenRouter) was deleted and no `VITE_*` var can inline a key into
the bundle. `tests/e2e/ui_sweep.py` fails if any request reaches a model host.

**Civic-clean UI + gated dev mode (013 · B).** The default UI is task-first — prompt + Run + the A2UI
surface. The AG-UI event console and the ⚙ Key panel are dev-only, revealed by `?dev=1` / `Ctrl+K`
(persisted in `localStorage["qte77-dev"]`), so the civic default exposes nothing model- or key-related.

**Per-stage model dispatch (#18).** On the keyless free-chain path, a stage tagged `exec` in its
`usecases/*.json` runs a forced tool (`assess_stage` / `search_opportunities`) through the SAME provider
chain as the render (`runChain` + per-provider `tryCall`) — streaming the model's `reasoning` as one
`TEXT_MESSAGE_CONTENT` and emitting a `model:<exec>` **LLM** span (token usage attached). Any miss (no
result / invalid / keyed / stub-forced) plays the stage's canned events instead — never worse than the
deterministic path. So the render is no longer the only model call, and `search_opportunities`'s ranked
matches ground it.

**HUD status bar (#18, PR-3).** After the render, `runUsecase` emits ONE terminal `USAGE` event
(`{ mode, model?, provider?, promptTokens, completionTokens, totalTokens }`) just before `RUN_FINISHED`,
with tokens summed across the live stages + render. The SPA intercepts it in `useAgentSSE.dispatch` (a pure
`toStatus` mapper — not through `applyA2UIEvent`, which drops non-`type/text` fields) and renders an honest
3-state chip: `LIVE · <model> · ~N tok` / `DEMO · deterministic` / `STUB · fell back`. A **Demo⇄Live toggle**
sets the next run's `?demo=1` intent; the chip reports what the last run actually did.

## Separation of concerns (module boundaries = single seams)

- `contract.ts` = validation · `applyA2UIEvent.ts` = render seam · `useAgentSSE.ts` = transport ·
  `runUsecase` + injectable emitter = observability · `usecases.ts` = the use-case seam (loads + guards
  `usecases/*.json`); `workflows.ts` = the general registry (render mode + query exec dispatch). (Worker
  source: `worker.ts`, `usecases.ts`, `workflows.ts`, `geo.ts`, `dates.ts`, `corpus/*`, `scam/*`,
  `agent/model.ts`, `a2ui/cards.ts`, `trace/arize.ts`.)
- **Trust boundary:** SPA holds no secrets; keys are Worker secrets only; Worker is the sole egress;
  the CORS allowlist is the gate. No third-party JS/fonts/tiles (self-hosted).

## Stack

- **UI (Pages):** Vite 8 · React 19 · TS 6 · zod 4 · `@a2ui/react` 0.10.1 (v0_8 API) · `@ag-ui/core`
  0.0.57 · vitest 4 + jsdom.
- **Worker:** Wrangler 4 (compat ≈ 2026-06-24) · raw `fetch` → OpenRouter directly (CF **AI Gateway** is
  read via `env.AI_GATEWAY_URL` but not yet configured in prod, #29) · no KV binding exists —
  `data/demo/*.json` is the live data source · injectable **Arize** emitter (console default, key-gated).
- **Ingest:** Python/uv + **polyfetch** (3-tier httpx→curl_cffi→Patchright) — **PLANNED**, not built yet.
- **No Docker, no devcontainer** — serverless; the ingest's Chromium is a CI step, not a shipped image.

## Platform notes

**Hosting = full Cloudflare:** SPA on **CF Pages** at `sortmy.london`, the Worker on a same-origin route
`sortmy.london/api/*` (no CORS); GitHub Pages retired. See [`deploy-cloudflare.md`](deploy-cloudflare.md).
Cloudflare **Workers (NOT Workflows)** + Pages. AI Gateway is supported in code but not configured in
prod (#29); no KV binding exists today. Arize tracing via an injectable emitter (keyless console
default; real OTLP export is planned, #21). **AG Grid deferred** → built-in A2UI cards (removed the top
build risk).

## Source map (reuse — don't rebuild)

| Path | What to take |
|---|---|
| `/workspaces/qte77/agenthud-agui-a2ui/` | SPA + Worker base — the verbatim reuse map is in `plans/001-build-plan.md`. |
| `/workspaces/qte77/polyfetch-scrape/` | the fetcher (v0.4.0) — `fetch()` API in the plan. |
| `/workspaces/sfsanity/_audit-docs/ingest/sfclarity_ingest/` | ingest patterns to borrow (polite fetch, host allowlist, JSON-LD extractor, dedup hash). |
| `/workspaces/qte77/ldnmxx/docs/` *(sibling)* | deep context: `agui-a2ui-gotchas.md`, `data-sources-api-map.md`, `track-b-*`, `track-a-*`, `decisions/`. |
