---
title: "Build plan 001 — ldnmxx-hack (modular AG-UI/A2UI on a Cloudflare Worker)"
type: plan
updated: 2026-07-04
---

# Build plan — ldnmxx-hack

## Handoff (read this first)

**Originally handoff 001 — "ldnmxx-hack onboarding (scaffold + docs done; build not started)" (updated
2026-07-04).**

**Status:** repo scaffolded (root + `docs/` + source-dir stubs). **No app code yet.** This is the resume
point.

### Read first (5 min, in order)

1. This plan — **the source/file/code map** (reuse paths, versions, API sigs, pitfalls, scaffold, phases).
   Everything you need so you don't re-gather context.
2. `docs/architecture.md` — one core / 3 seams · data flow · SoC · stack.
3. `docs/usecase-workflows.md` — the two `usecases/*.json` workflows (Track B one-click journey, Track A thin).
4. `docs/archive/submission.md` — the pitch/deck (what we're demoing) and the open track decision.

### What this is

A modular AG-UI/A2UI agent on a Cloudflare Worker (Londonmaxxing 003). One `POST /run?usecase=<id>` +
`runStages`; swap a JSON → swap the app. **Track B** = one-click founder copilot (assess stage → grants →
who to talk to → incorporate). **Track A** = voice → step-free TfL route. Render = **built-in A2UI cards**.

### How to handle it (the workflow)

- **Enter plan mode before implementing** → **strict TDD** (write the module test first) → **lint + sec** gate.
- Test **modules only** (`useAgentSSE`, worker `/run`, `runStages`, ingest parsers) — never glue/scaffold or
  one-shot scripts.
- Branch per topic → Conventional Commits → CI-gated PR → prune. Identity: **noreply**, `--no-gpg-sign`,
  prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`. Secrets are **Worker secrets only**.

### Start here — Phase 1 (get E2E green, keyless)

Scaffold from `/workspaces/qte77/agenthud-agui-a2ui/` (copy the REUSE files verbatim), then write the **~8
Phase-1 files** (this plan's "Phase-1 start-here subset" below): `useAgentSSE.ts` (+test), worker `/run`
**echo** (+test), `a2ui/cards.ts`. Green = SPA → `/run` SSE → opportunity cards render on the A2UI surface.
Verify with `wrangler dev` + curl, then a browser (cards render; a bad batch shows a HUD error, not blank).

### Reuse (don't rebuild) — exact paths in "Source map" below

- `qte77/agenthud-agui-a2ui/` (SPA + worker base) · `qte77/polyfetch-scrape/` (fetcher v0.4.0) ·
  `sfsanity/_audit-docs/ingest/sfclarity_ingest/` (ingest patterns) · sibling `qte77/ldnmxx/docs/` (deep context).

### Watch out (locked decisions + traps)

- **AG Grid deferred** → built-in cards (don't add ag-grid). **A2UI/AG-UI are NOT sponsors.**
- A2UI v0_8: **self-contained batch**, `root` id exists, `Card.child` singular, typed literals, avoid `List`
  (use `Column`), **`Button.onAction` is unwired** (wire the incorporate CTA). context7's A2UI docs are the
  *wrong* version — trust the installed `v0_8/index.d.ts`.
- `incorporate` = Companies House **name-check + pre-filled pack + mocked "file"**, NOT a live filing.
- Worker tests = plain-vitest `worker.fetch()` (not miniflare). No Docker/devcontainer.
- **This repo is the SSOT** — treat sibling `qte77/ldnmxx` as archival reference only.
- `incorporate` = a **verified how-to pack** (real curated gov.uk links), not a mock filing.
- UX bible = `docs/design.md` (EyeRest, dark-first + BluBlock, motion). Demo north star = `docs/archive/demo-script.md`.

### Open decisions (surface to the user)

Project/builder name · **primary track** (rec: Live London) · confirm the Track-A ask is on the "What
Londoners are asking for" list · add a `LICENSE` file (Apache-2.0). Confirm the `qte77/ldnmxx-hack` remote
before any push.

**Status: scaffold + docs only; no app code yet.** This plan is the **source/file/code map** so the next
session builds without re-gathering context. Concept: `architecture.md`. Use cases: `usecase-workflows.md`.
Pitch/deck: `docs/archive/submission.md`.

## Locked decisions

- **Cloudflare Workers** (NOT *Workflows*). Stage defs = **JSON**, read at runtime by a ~60-LOC `runStages`.
  One `POST /run?usecase=<id>`.
- **AG Grid deferred** → render **built-in A2UI cards** (Column/Card/Text). Removes the top build risk.
- **A2UI/AG-UI = protocol stack, NOT sponsors.** Sponsors: Cloudflare · OpenRouter · Arize · AG Grid
  (deferred) · ElevenLabs (stretch) · TRMNL (opt). Partner **Zed** unused (it's an editor).
- **Reuse**, don't rebuild (source map below). **No Docker, no devcontainer** (serverless).
- **`incorporate` = a verified how-to pack** (curated real gov.uk / Companies House links, never
  LLM-generated) — honest, not a mock filing. See `usecase-workflows.md`.
- **This repo is the SSOT**; the sibling `qte77/ldnmxx` is archival deep-reference only (non-canonical).
  Canonical UX: `design.md` (EyeRest, dark-first, BluBlock). Demo north star: `demo-script.md`.
- KISS deviations from generic plans: worker tests = **plain-vitest `worker.fetch()`** (not miniflare);
  `msw` deferred to Phase 2; security gate = **gitleaks + Semgrep** (CodeQL needs paid GHAS on a private repo).
- **Strict TDD** (tests first for load-bearing *modules*, not glue/scripts) · **lint + sec** gate · plan-mode before implementing.

## Source map — reuse repos (exact paths)

### A. `/workspaces/qte77/agenthud-agui-a2ui/` — SPA + Worker base

**Pinned versions (match exactly):** vite 8.0.16 · react 19.2.7 · typescript 6.0.3 · zod 4.4.3 ·
`@a2ui/react` 0.10.1 (**v0_8** API) · `@ag-ui/core` 0.0.57 · vitest 4.1.9. **Add nothing new in Phase 1**
(no `ag-grid-*`, no `msw`).

**ui reuse map** (paths under `agenthud-agui-a2ui/ui/`):

| File | Action | Note |
|---|---|---|
| `src/agent/contract.ts` | **REUSE** + extend | zod A2UI batch schema (root/Card.child/cycle guards). Extend for Stage/Opportunity/Contact/Incorporate/Route render schemas. |
| `src/agent/applyA2UIEvent.ts` | **REUSE verbatim** | the render seam; already surfaces contract/render errors (never-silent-blank). |
| `src/A2UISurface.tsx` | **REUSE verbatim** | keeps `initializeDefaultCatalog()`; **no custom registration** (built-ins only). |
| `src/DashboardShell.tsx`, `src/EventStream.tsx` | **REUSE** | HUD chrome + live event log. |
| `src/useReplayEngine.ts`, `src/replaySnapshot.ts` | **REUSE** | replay safety net + accumulate self-contained batches. |
| `src/agent/liveAgent.ts` | **REPLACE** | Vercel AI SDK/BYOK → new `useAgentSSE.ts`. Port `streamPartToEvent` *idea*; reuse `toConnectionError` verbatim; drop all `ai`/`@ai-sdk/*`. |
| `src/agent/useLiveAgent.ts` | template | shape for the `useAgentSSE` hook (state + `applyA2UIEvent` + AbortController). |
| `src/LiveDashboard.tsx`, `src/App.tsx`, `src/config.ts` | **EDIT** | gut BYOK; `App.tsx` holds the B⇄A adapter toggle. |
| `vite.config.ts` | **EDIT** | `base: CI ? "/ldnmxx-hack/" : "/"`; vitest `test` block is **inline** (jsdom, `setupFiles:["tests/setup.ts"]`, globals). |

**Test conventions:** vitest 4.1.9; config **inline in `vite.config.ts`**; tests in **`ui/tests/`** (not
co-located). Templates: `contract.test.ts` (pure zod), `liveAgent.test.ts` (pure-fn `streamPartToEvent`),
`A2UISurface.test.tsx` (live smoke through real `@a2ui`).

**worker reuse map** (paths under `agenthud-agui-a2ui/worker/`): agenthud's worker is a **BYOK CORS proxy**
(`agenthud-proxy`) — **no `/run`, no SSE, no KV**. Reuse only: `wrangler.toml` skeleton (compat_date
`2026-06-24`, observability), the CORS allowlist + capped-body guard in `src/router.ts`, and the **test
convention: plain vitest calling `worker.fetch(request, env)` directly** (NOT miniflare). Stack: wrangler
^4, vitest ^4.1.9, `@cloudflare/workers-types` ^4, ts ~6.0.3, eslint (+`eslint-plugin-sonarjs`),
`"type":"module"`. The `/run` handler + SSE + `runStages` + tools are **net-new**.

### B. `/workspaces/qte77/polyfetch-scrape/` — the fetcher (v0.4.0)

Import `polyfetch_scrape`; py ≥3.11; deps curl-cffi + httpx + patchright + typer; hatchling → installable as
a uv git dep. **Sync** `fetch()`:
```python
fetch(url, *, method="GET", headers=None, timeout=30.0, retry=None, browser="chrome",
      wait_for_selector=None, tier=None, etag=None, last_modified=None, render=None) -> Response
# Response(frozen): url, status, headers, body(bytes), content_type, backend, permanent_redirect_to, screenshot
#   -> NO .text/.html: decode .body yourself.  render=RenderOptions(screenshot="viewport"|<css>) -> PNG in .screenshot
# errors: FetchError -> AuthRequired(401/407) / GoneError(404/410) / LegalBlock(451); RetryPolicy defaults sane
```
One-off: `uv run patchright install chromium`. Declare the dep (as sfclarity does):
```toml
[project.optional-dependencies]
fetch = ["polyfetch-scrape"]
[tool.uv.sources]
polyfetch-scrape = { git = "https://github.com/qte77/polyfetch-scrape.git" }
```

### C. `/workspaces/sfsanity/_audit-docs/ingest/sfclarity_ingest/` — ingest patterns to borrow

(Note: "sfsanity" is Supabase, not Sanity.io.) **Borrow the pattern, not the Supabase stack.** Skim &
re-implement for KV: `fetcher.py` (PoliteFetcher: lazy polyfetch, UA rotation, robots.txt, per-host delay) ·
`http.py` (`require_https()` **host allowlist** = SSRF guard) · `resolve.py` (SHA-512 `url_hash` → the **KV
key**) · `jsonld.py` (schema.org JSON-LD + Next.js `__NEXT_DATA__` extractor — many grant sites are Next.js) ·
`sources/*.py` (pure-parser/impure-fetcher split) · `pending` status + failure sink. **Skip:** their
`SECURITY DEFINER` RPCs, roles, triggers, 31-col schema → replace with `KV.put(url_hash, json)`.

### D. `/workspaces/qte77/ldnmxx/docs/` (sibling) — deep context

`agui-a2ui-gotchas.md`, `modular-core-architecture.md`, `data-sources-api-map.md`, `track-b-*`, `track-a-*`,
`decisions/0001-0002`, `plans/001-003`, `usecase-workflows.md`, `resources-alignment.md`. Consider porting
the relevant ones here.

## A2UI contract + pitfalls (v0_8 / `@a2ui/react@0.10.1`)

- **Source of truth = installed `v0_8/index.d.ts`.** context7's A2UI docs show the **wrong** (v0_9/CopilotKit
  `createCatalog`) API — ignore them.
- **Built-in render:** a `Column{children.explicitList:[…]}` of `Card{child}` of `Text{text:{literalString}}`.
  **Avoid `List`** (guard pitfall) — use `Column`.
- **Pitfalls:** `beginRendering.root` must equal a real component id · `Card.child` is a single id (never
  `children`) · **typed literals only** (`literalString/Number/Boolean`, never bare `{literal}`) ·
  **self-contained `surfaceUpdate`** (list every referenced id; acyclic) · never-silent-blank (keep
  `applyA2UIEvent`'s error surfacing) · **`Button.onAction` is unwired in agenthud** — wire it for the
  incorporate CTA or use a link.
- **Wire contract:** SSE event `{type, text, a2uiMessages}`; terminal `RUN_FINISHED`. `AgentEvent =
  {type:string; text?:string; a2uiMessages?:unknown[]}`; enum: `RUN_STARTED`, `TEXT_MESSAGE_START/CONTENT/END`,
  `STEP_STARTED`, `TOOL_CALL_START`, `TOOL_CALL_END`, `RUN_FINISHED`, `RUN_ERROR`.

## Scaffold (what goes where)

`REUSE`/`EDIT`/`NEW`, `[P1–P4]` phase. Built-in card render, no AG Grid.

```
ui/  src/{main REUSE, App EDIT, A2UISurface REUSE, DashboardShell REUSE, EventStream REUSE,
        LiveDashboard EDIT, useReplayEngine REUSE, replaySnapshot REUSE}
     src/agent/{contract EDIT, applyA2UIEvent REUSE, useAgentSSE NEW[P1], adapter/{types,founders-copilot,on-it} NEW}
     src/components/{VoiceInput NEW[P3], RouteMap NEW[P3], UsecaseInspector NEW[P3], BusinessCase NEW[P2], SponsorFooter NEW[P2]}
     src/lib/format.ts NEW[P2] · src/recordings/*.json NEW[P4] · src/theme/ REUSE[P4,#20 EyeRest]
     tests/{setup REUSE, contract EDIT, useAgentSSE NEW[P1]}
worker/ src/{worker NEW[P1], router EDIT, a2ui/cards NEW[P1], model/openrouter NEW[P2], trace/arize NEW}
     src/stages/{stageTypes,runner} NEW[P2]  ·  src/adapters/{types,foundersAdapter,onItAdapter} NEW
     src/tools/{assessStage,searchOpportunities,findContacts,incorporate NEW[P2]; lookupPostcode,tflJourney NEW[P3]}
     test/{run NEW[P1], runner NEW[P2]}  ·  wrangler.toml EDIT (name ldnmxx-hack-worker, KV OPPORTUNITIES)
usecases/{founders-copilot,on-it}.json NEW
ingest/{pyproject NEW, seed NEW, fetch NEW, extract NEW, sources NEW, tests/test_extract NEW}
mocks/handlers.ts NEW[P2/3] (Companies House stub, model stub) · verify/frontend_check.py NEW[P4]
.github/workflows/ci.yml NEW (+ gitleaks + Semgrep; SHA-pin actions; least-priv permissions)
```

## Phase-1 start-here subset (E2E green, keyless — ~8 files)

1. `ui/package.json` + `ui/vite.config.ts` (scaffold + pins)
2. `ui/src/agent/useAgentSSE.ts` **+ `ui/tests/useAgentSSE.test.ts`** (TDD first)
3. `worker/wrangler.toml` + `worker/src/worker.ts` (the `/run` **echo**) **+ `worker/test/run.test.ts`** (TDD first)
4. `worker/src/a2ui/cards.ts` (emit a self-contained Column/Card/Text batch)

Everything else in Phase 1 is agenthud copied in **verbatim**. Green = SPA → `/run` SSE → cards render on the surface.

## Phased sequence

0. **Scaffold** from agenthud (ui+worker), rebrand (base `/ldnmxx-hack/`, worker `ldnmxx-hack-worker`).
1. **Foundation** — `useAgentSSE` → `/run`; Worker **echoes** SSE; built-in card render. *(Phase-1 subset above.)*
2. **Track B** — `runStages` + OpenRouter (AI Gateway) + KV; tools `assess_stage`/`search_opportunities`/
   `find_contacts`/`incorporate` (Companies House); BusinessCase + SponsorFooter. **Pre-scrape as much as
   possible** via `ingest/seed.py` into multiple KV corpora — `opportunities` · `contacts` · `eligibility`
   rules · `reference` (SIC codes, checklist) — so request-time is KV-read + LLM composition (only CH
   name-check is live/mocked). `data/demo/` = offline fallback.
3. **Track A thin swap** — `lookup_postcode` + `get_tfl_journey`; `usecases/on-it.json`; VoiceInput; RouteCard;
   **`RouteMap`** (lazy `leaflet` + keyless OSM raster tiles, adjacent `DashboardShell` panel — **not** a
   custom A2UI component; read-only, attribution shown; **accessibility markers** from Overpass
   `wheelchair`/`highway=elevator`/`ramp`, **cached/wiremocked** for a deterministic demo); header toggle +
   UsecaseInspector.
4. **Polish/pre-bake** — replay recordings (safety net — **Track A ships as a pre-recorded replay** of the real
   STT→postcode→path→TTS run, TTS via `AudioPlayer`/`speechSynthesis`); deploy CF Pages + Worker; AI-Gateway spend cap;
   `make demo`; EyeRest theme (#20).
5. **Demo day** — run primary track live, toggle, show the JSON swap; replay = safety net.

## Strict-TDD surface (modules only)

| Test | Asserts |
|---|---|
| `ui/tests/useAgentSSE.test.ts` [P1] | synthetic SSE frames → exact `AgentEvent` enum; malformed handled, not thrown. |
| `worker/test/run.test.ts` [P1] | `POST /run?usecase=founders-copilot` → SSE has an `a2uiMessages` batch that **passes `contract.ts`** (self-contained Column/Card/Text) + terminal `RUN_FINISHED`; unknown usecase → 4xx; non-POST → 405. |
| `worker/test/runner.test.ts` [P2] | `runStages` emits the plan→tool→render StageResult sequence. |
| `ingest/tests/test_extract.py` | pure JSON-LD/`__NEXT_DATA__` parser + `url_hash` dedup. |

**No tests for** glue/scaffold or one-shot scripts (`seed.py` orchestration).

## Lint + security + delivery

- CI `ci.yml`: per-dir typecheck + eslint(+sonarjs) + vitest + build; ingest ruff/pyright/pytest. **Add**
  gitleaks + Semgrep (`p/typescript`). **SHA-pin all actions** + explicit least-privilege `permissions:`
  (copy agenthud). Dependabot for deps.
- **Delivery:** branch per topic → Conventional Commits → CI-gated PR → prune. Identity noreply,
  `--no-gpg-sign`, prefix git/gh `env -u GH_TOKEN -u GITHUB_TOKEN`. Confirm the `qte77/ldnmxx-hack` remote before push.

## Verification (keyless, E2E)

`wrangler dev` → **curl** `POST /run?usecase=founders-copilot` shows `{type,text,a2uiMessages}` frames +
`RUN_FINISHED` · `npm run dev` (proxy `/run`→:8787) → cards render on the surface, a bad batch surfaces a HUD
error (not blank) · `npm run typecheck && lint && test` green both dirs + CI green · use the `verify` skill in
a browser before the PR.
