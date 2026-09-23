---
title: "Plan 002 — Phase 1 first E2E (SPA → /run SSE → cards + Arize spans)"
type: plan
updated: 2026-07-04
---

# Plan — Phase 1 first E2E

## Handoff (read this first)

**Originally handoff 002 — "start here: build the Phase-1 first E2E" (updated 2026-07-04).**

**Status:** repo scaffolded + docs complete (this repo is the **SSOT**). **No app code yet** at the time
this handoff was written; job was to build the **first end-to-end** (SPA → `/run` SSE → cards + Arize
spans). **DONE** (branch `feat/phase1-foundation`; see the Handoff 003 section below for the closing
report). Reconciled deltas from the original ticket: **both** usecases ship (`founders-copilot` + thin
`on-it`) via a UI toggle; the Pages demo is backed by the **live deployed Worker** (no baked replay); an
**optional dashboard BYOK** field was added (runtime-only; the Worker key stays the keyless default); the
console **Arize span per stage** was kept.

### Read first (in order — don't re-gather context)
1. **This plan** — YOUR ticket: happy path · TDD task list · Arize spans · definition of done.
2. `001-build-plan.md` — the full **code/file/source map** (exact reuse paths, pinned versions,
   A2UI pitfalls). Reference, not a re-read.
3. `docs/architecture.md` · `docs/usecase-workflows.md` · `docs/design.md` · `docs/archive/demo-script.md` — as needed.

### How to handle plan 002
- Plan mode is satisfied (002 is approved) → go straight to **strict TDD**, in task order: 🧪`useAgentSSE`
  test → impl → 🧪`arize`/`run` worker tests → impl emitter + `/run` stub `runStages` (emits SSE **and** a
  span per stage) + `a2ui/cards.ts` → wire `App` → **verify**.
- **Reuse agenthud verbatim** (`A2UISurface`, `applyA2UIEvent`, `contract`, `DashboardShell`, `EventStream`).
  **Built-in A2UI cards only** (no AG Grid). **Console Arize emitter from run #1** (keyless, `wrangler tail`).
- **Delivery:** branch `feat/phase1-foundation` → commit by topic → CI-gated PR on `qte77/ldnmxx-hack`.
  Identity: noreply, `--no-gpg-sign`, prefix git/gh `env -u GH_TOKEN -u GITHUB_TOKEN`. Confirm the remote first.
- **Done when:** SPA → `/run` SSE → opportunity cards render **+ a span per stage in `wrangler tail`**; a bad
  batch shows a HUD error (never-silent-blank); `npm test` (ui + worker) + CI green.

### Watch out (traps)
- **A2UI v0_8** is the truth (installed `index.d.ts`) — context7's A2UI docs are the *wrong* version. Batch must
  be **self-contained** (root id exists, `Card.child` singular, typed literals, acyclic). Avoid `List` → use `Column`.
- `AgentEvent = {type:string; text?:string; a2uiMessages?:unknown[]}`; enum incl. `RUN_FINISHED`/`RUN_ERROR`.
- **No new deps** (no ag-grid, no msw). Worker tests = plain-vitest `worker.fetch(req, env)` (not miniflare).
- This repo is the **SSOT**; sibling `qte77/ldnmxx` is archival reference only.

### After Phase 1
Phase 2 (**cut**) = Track B trio (`assess_stage` + `search_opportunities` over `data/demo/` + `incorporate`
verified pack) + the `model:openrouter` span → HUD cost chip. Track A = **pre-recorded** `on-it.json`
(STT→postcode→path→TTS). See plan 001's phases + `docs/archive/demo-script.md`.

### Handoff 003 — Phase 1 done

**Originally handoff 003 — "start here: Phase 1 done, Phase 2 next" (updated 2026-07-04).** Superseded at
the time by plan 004 (`004-post-mvp-priorities.md`) — that plan's own Handoff section is the later resume
point, not this one; kept here as the historical closing report for this arc.

**Status:** Phase 1 first E2E is **built and green** on branch `feat/phase1-foundation` (supersedes
handoff 002 as the resume point). SPA → `POST /run?usecase=<id>` (SSE) → built-in **A2UI cards** render,
with **one console Arize span per stage** in `wrangler tail`. Two workflows ship behind a UI toggle.

#### What's built

- **`ui/`** (Vite/React SPA, `groundwork-ui`): live-only shell (`App.tsx`) with a **usecase toggle**
  (Founder's Copilot / On It), an optional **BYOK** field, prompt + Run. Transport =
  `src/agent/useAgentSSE.ts` (pure `parseSSE` + `fetch`/`ReadableStream`/`AbortController` hook) driving
  the reused `applyA2UIEvent` + `contract.ts` render/validate seam. Reused **verbatim** from
  `qte77/agenthud-agui-a2ui`: `A2UISurface`, `applyA2UIEvent`, `contract`, `EventStream`, `index.css`
  theme. **Dropped** (KISS/YAGNI): replay engine, mode toggle, BYOK/AI-SDK, DashboardShell chrome.
- **`worker/`** (`groundwork-worker`, `wrangler.toml`): one `/run` handler + CORS (+OPTIONS) + SSE
  `ReadableStream`; inline **stub `runStages`** per usecase (`founders-copilot`: plan → search_opportunities
  → render opp cards; `on-it`: plan → lookup_postcode → get_tfl_journey → render route cards). Emits both
  the SSE event **and** `emitter.span(...)` per stage. `src/trace/arize.ts` = injectable emitter (console
  default; real Arize adapter gated on `ARIZE_API_KEY`, stubbed). `src/a2ui/cards.ts` = one `cardsBatch`
  builder for both workflows, from `data/demo/{opportunities,route}.sample.json` (SSOT).
- **Tests:** `ui` 7 (SSE parser + enum mapping + malformed-frame + contract fixture + never-silent-blank);
  `worker` 6 (both usecases' self-contained batch + `RUN_FINISHED`, 4xx/405/204 guards, span-per-stage).
  Both green. UI: typecheck + strict eslint + build all clean. `wrangler dev` boots + serves.
- **CI/CD:** `ci.yml` gains `ui` (lint/typecheck/test/build) + `worker` (typecheck/test) jobs;
  `gh-pages.yml` builds `ui/` (base `/ldnmxx-hack/`) → Pages. `Makefile`: `dev`/`test`/`deploy` wired.

#### Decisions locked (this session)

1. **Both workflows ship** (`founders-copilot` primary + thin `on-it`) via a UI toggle — the modularity
   proof. Same engine, different usecase JSON.
2. **Pages demo = live deployed Worker** (not a baked replay): one source of truth, no playback layer.
3. **BYOK = optional dashboard field**, runtime/in-memory only, forwarded to the Worker; our model key
   stays a **Worker secret** (keyless default). Nothing sensitive in the SPA bundle — coherent with
   `AGENTS.md`. Phase-1 stub makes no model call.
4. **Arize console span per stage kept** (screenshot-legible `⌁ span …` for the README).
5. **Minimal single-mode shell** written instead of reusing agenthud's dual-mode `DashboardShell`.

#### Run it / preview

- Local: `make dev` (worker :8787 + ui :5173, Vite proxies `/run`). `make test`. Spans:
  `cd worker && npm run tail`.
- **Needs you (out-of-band):** (1) Settings ▸ Pages ▸ Source = **GitHub Actions**; (2) `make deploy`
  (Cloudflare auth) then bake the real `workers.dev` subdomain into `ui/src/config.ts` `WORKER_BASE`.

#### Phase 2 next

Real model call (OpenRouter via AI Gateway, Worker secret or BYOK override) → child **`model:openrouter`
span `{model, tokens, costUSD}`** → HUD **cost chip**. Replace the stub with the real `runStages` over
`usecases/*.json` (`stages/` + `adapters/`), `search_opportunities` over seeded KV `data/`, the
`incorporate` verified pack. Real Arize/OpenInference exporter behind `ARIZE_API_KEY`. Capture the
Arize/cards **screenshots + GIF** into `docs/assets/` for the README. See plan 001 + `docs/archive/demo-script.md`.

**For the next session — this is the kickoff ticket.** Read `001-build-plan.md` for the full
**code/file/source map** (exact reuse paths, pinned versions, A2UI pitfalls) and its own Handoff section
for onboarding — **don't re-gather context**. Execute via **strict TDD** (tests first for modules, not
glue/scaffold) + **lint + security** gate. This plan is approved; proceed to build.

## Definition of done

SPA → `POST /run?usecase=founders-copilot` (SSE) → opportunity **cards** render on the A2UI surface,
**and** one **Arize span per stage** is visible in `wrangler tail` (console emitter, keyless). A bad batch
surfaces a **HUD error** (never-silent-blank). `npm test` green in `ui/` + `worker/`; CI green.

## Happy path (keyless) — `⌁` = Arize span

```
1. Load SPA (:5173) → hero + input.
2. Submit → useAgentSSE opens POST /run?usecase=founders-copilot   (fetch + ReadableStream)
════════ TRUST BOUNDARY (secrets live below) ════════
3. Worker: validate usecase → pick adapter → runStages(STUB):
     ⌁ start root span "run" {usecase, reqId}
     plan   → SSE STEP_STARTED / TEXT_MESSAGE_CONTENT              ⌁ span "plan"   {kind, latencyMs}
     tool   → SSE TOOL_CALL_START/END (returns data/demo sample)  ⌁ span "tool:search_opportunities"
     render → self-contained Column/Card/Text batch → SSE a2uiMessages   ⌁ span "render"
     → SSE RUN_FINISHED   ⌁ end "run" span ; ctx.waitUntil(emitter.flush())
4. useAgentSSE parses frames → AgentEvent → applyA2UIEvent (validate vs contract.ts) → render seam
     → opportunity cards on the A2UI surface + EventStream lifecycle log
5. `wrangler tail` shows the spans (console emitter, keyless).
6. Force a bad batch → HUD error card (never-silent-blank).
```
**Green =** SPA → `/run` SSE → cards render **+ spans in `wrangler tail`**.

## Tasks (TDD-ordered — `🧪` = write the test first)

**A. Scaffold (no tests)**
1. Copy agenthud `ui/`+`worker/`; rebrand (base `/ldnmxx-hack/`, worker `ldnmxx-hack-worker`); pin deps;
   `A2UISurface` verbatim (built-ins only, no custom registration).

**B. `useAgentSSE` (transport seam)**
2. 🧪 `ui/tests/useAgentSSE.test.ts` — synthetic SSE frames → exact `AgentEvent` enum (`TEXT_MESSAGE_CONTENT`,
   a batch event, `RUN_FINISHED`, error → `RUN_ERROR`); malformed frame handled, not thrown.
3. Implement the pure frame-parser + the hook (`fetch` + `ReadableStream` + `AbortController`), wired to
   `applyA2UIEvent`. (Replaces agenthud's BYOK `liveAgent.ts`; reuse `toConnectionError` verbatim.)

**C. Worker `/run` + Arize emitter**
4. 🧪 `worker/test/arize.test.ts` — `makeEmitter(env)` returns the **console emitter** when `ARIZE_API_KEY`
   unset; `runStages` calls `emitter.span(...)` once per stage (`run`,`plan`,`tool`,`render`).
5. Implement `worker/src/trace/arize.ts`:
   ```ts
   type Span = { name: string; attrs?: Record<string, unknown> };
   interface Emitter { span(s: Span): void; flush(): Promise<void>; }
   const consoleEmitter: Emitter = { span: s => console.log("span", JSON.stringify(s)), flush: async () => {} };
   export const makeEmitter = (env) => env.ARIZE_API_KEY ? arizeEmitter(env) : consoleEmitter; // arize = stub now, real in P2
   ```
6. 🧪 `worker/test/run.test.ts` — `POST /run?usecase=founders-copilot` → SSE has an `a2uiMessages` batch that
   **passes `contract.ts`** (self-contained Column/Card/Text) + terminal `RUN_FINISHED`; unknown usecase → 4xx;
   non-POST → 405.
7. Implement `worker/src/worker.ts` (`/run` handler + SSE stream, CORS) + stub `runStages` that emits **both**
   the SSE event **and** `emitter.span(...)` per stage; `worker/src/a2ui/cards.ts` (build a self-contained
   Column/Card/Text batch from `data/demo/opportunities.sample.json`).

**D. Wire + verify**
8. `App.tsx`/`LiveDashboard` → inject `useAgentSSE` into `DashboardShell` (drop BYOK UI).
9. Verify: `wrangler dev` + **curl** (SSE frames + `RUN_FINISHED`; spans in `wrangler tail`) → `npm run dev`
   (proxy `/run`→:8787) + browser (cards render; bad batch → HUD error) → `npm test` both dirs → `verify` skill.

## Arize scope for E2E #1

- **Now (echo):** the injectable emitter + **one span per stage** (`run/plan/tool/render`), **console default**
  (keyless, `wrangler tail`). Proves the observability seam end-to-end.
- **Phase 2 (real model):** add a child **`model:openrouter` span `{model, tokens, costUSD, latencyMs}`** →
  surface as the HUD **cost chip**; the real Arize/OpenInference adapter lands behind `ARIZE_API_KEY`. The
  `Emitter` interface does not change — Phase 2 just fills in token/cost + the wire adapter.

## Guardrails (from `plans/001` — don't relearn)

- **Reuse agenthud verbatim:** `A2UISurface`, `applyA2UIEvent`, `contract.ts`, `DashboardShell`, `EventStream`,
  `useReplayEngine`. **Pinned:** vite 8.0.16 · react 19.2.7 · ts 6.0.3 · zod 4.4.3 · `@a2ui/react` 0.10.1 (v0_8)
  · `@ag-ui/core` 0.0.57 · vitest 4.1.9. **No new UI deps** (no ag-grid, no msw).
- **A2UI:** built-ins only, **avoid `List` (use `Column`)**; self-contained batch (root id exists, `Card.child`
  singular, typed literals, acyclic); never-silent-blank. `AgentEvent = {type:string; text?:string; a2uiMessages?:unknown[]}`.
- **Worker tests = plain-vitest `worker.fetch(req, env)`** (NOT miniflare).
- **Delivery:** branch `feat/phase1-foundation` → commit by topic → CI-gated PR on `qte77/ldnmxx-hack`;
  identity noreply, `--no-gpg-sign`, prefix git/gh `env -u GH_TOKEN -u GITHUB_TOKEN`. Confirm the remote before push.
