---
title: "Plan 002 — Phase 1 first E2E (SPA → /run SSE → cards + Arize spans)"
type: plan
updated: 2026-07-04
---

# Plan — Phase 1 first E2E

**For the next session — this is the kickoff ticket.** Read `plans/001-build-plan.md` for the full
**code/file/source map** (exact reuse paths, pinned versions, A2UI pitfalls) and `handoffs/001-onboarding-handoff.md`
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
