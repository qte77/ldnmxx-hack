# Architecture

## One core, three seams

One `POST /run?usecase=<id>` endpoint → a small `runUsecase` interpreter (plan → tool → render) → an A2UI
HUD. Flip **Track B ⇄ A** via a UI toggle over the `?usecase=` param — each workflow's stage choreography
is a `usecases/*.json` read at runtime (`worker/src/usecases.ts`); render modes (`founders`/`route`) stay
in code. Only three seams change:

| Seam | Track B (Founder's Copilot) | Track A (On It) |
|---|---|---|
| `tools[]` | `assess_stage` + `search_opportunities` — **live model tools** (each streams reasoning + its own Arize LLM span, #18); `find_contacts` (#9) · `incorporate` (#12) planned | lookup_postcode · get_tfl_journey — **PLANNED**; Track A is a canned stub today |
| `render` | built-in A2UI cards (Column/Card/Text) | static `buildRouteCards()` text today; RouteCard + lazy OSM `RouteMap` panel is **PLANNED** |
| `input()` | text | text today (canned stub); voice (Web Speech STT + text fallback) is **PLANNED** |

## Data flow — one direction, one trust crossing

```
user input → SPA useAgentSSE ──POST /run?usecase=<id>──▶ Worker  [TRUST BOUNDARY — secrets here]
                                                          runUsecase: plan → tool → render
                                 ◀── SSE {type,text,a2uiMessages} + terminal USAGE + RUN_FINISHED ──
   SPA: parse frames → AgentEvent → applyA2UIEvent (validate vs contract.ts) → render seam
        → A2UI surface (built-in Column/Card render)  +  EventStream (live log)

  PLANNED, out of band (ingest/ unbuilt, no KV binding exists): ingest/seed.py → polyfetch →
  opportunities.json → KV OPPORTUNITIES. Today the live data source is the committed
  `data/demo/*.json`.
```

Open data sources available for future workflows are cataloged in [`data-sources.md`](data-sources.md).

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
  `usecases/*.json`). (Worker source: `worker.ts`, `usecases.ts`, `agent/model.ts`, `a2ui/cards.ts`, `trace/arize.ts`.)
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
