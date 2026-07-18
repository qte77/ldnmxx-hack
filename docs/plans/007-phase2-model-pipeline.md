---
title: "Plan 007 — Phase 2: model-driven pipeline (#18) + usecase expansion"
type: plan
updated: 2026-07-09
issue: 18
status: "PR-1/2/3 shipped; PR-4 (Arize live) next — blocked account-side #50; PR-5 superseded by the civic pivot (plans 010–012)"
pairs_with: docs/handoffs/007-phase2-model-pipeline.md
---

# Plan 007 — Phase 2: model-driven pipeline (#18) + usecase expansion

> **Arize verification (2026-07-17, PR-4 / #50):** account **unblocked**, but an OTLP smoke test (our
> `worker/src/trace/arize.ts` JSON shape → `POST https://otlp.arize.com/v1/traces`) returns **HTTP 500
> `{"code":13,"message":"unable to validate authorization from span"}`** using the keys in `worker/.dev.vars`.
> Diagnosis: **(a)** the JSON/OTLP payload is *accepted* (NOT a protobuf problem — resolves the code comment's
> worry); **(b)** the header names `space_id` + `api_key` are *correct* (match the official `arize-otel-go`);
> **(c)** so the failure is the **keys** — regenerate the Arize AX API key + space id post-unblock, update
> `worker/.dev.vars` + the Worker secrets, re-run the smoke test (expect 200), *then* close #50 + tick PR-4.
> **Our export code needs no change.**
>
> **PR-1/2/3 shipped; PR-4 (Arize live, blocked account-side #50) is the one remaining Phase-2 item; PR-5
> superseded by the civic pivot (plans 010–012).** Originally scoped as **5 phased, strict-TDD PRs** (branch per PR → CI-gated → squash-on-green
> → prune). The **Source map** at the bottom is the current code state — trust it instead of re-exploring.

## Context

Track B ("Founder's Copilot") today is **theatre + one model call**: `runUsecase` plays three canned
stages from `usecases/founders-copilot.json` (static `plan` / `search_opportunities` / `incorporate` event
strings), then makes ONE forced `render_ui` call grounded in **pre-scored** demo data — `score` /
`whyItFits` / `eligibility` are hard-coded in `data/demo/opportunities.sample.json`. **No stage reasons.**

Issue #18 wants the early stages genuinely model-driven:
- **`assess_stage`** — LLM classifies the founder's stage + the 1–2 things that unlock the next stage.
- **`search_opportunities`** — LLM ranks/filters/explains over the corpus (not canned, not pre-scored).
- Each model stage streams real reasoning + emits its own Arize **LLM** span; a **cost chip** (token/cost)
  shows in the HUD.

Track A (`on-it`) stays canned (real routing is Phase 3, #4). Builds directly on the two-path model access
and free-chain shipped in #37 (handoff 006).

**Locked decisions (planning session, 2026-07-09):**
- Per-stage reasoning is delivered **structured, at stage-end** — a FORCED tool with a `reasoning` field →
  one `TEXT_MESSAGE_CONTENT` per stage. Keeps the forced-tool → validate → fall-back-to-canned discipline.
- **Browser-BYOK stays render-only** (multi-stage runs on the Worker keyless/free-chain path; BYOK parity
  is a fast-follow — new note, not yet an issue).
- **KV is out of scope** (deferred #13) — the corpus is `data/demo/*.json`.
- **Full scope + up-front generic plumbing was chosen deliberately** (over a thinner one-stage slice /
  minimal-duplication plumbing) after two KISS/YAGNI/AHA pushbacks — accepting the earlier abstraction
  because ≥3 tools (`render_ui` + `assess_stage` + `search_opportunities`) justify it.
- **Usecase expansion is the capstone** (PR-5): once the render is corpus-agnostic, add `benefits-copilot`,
  `tender-finder` and `support-finder` as JSON + synthetic-corpus drops reusing the Phase-2 pipeline — the
  "swap a JSON, swap the app" proof, now with real reasoning behind it.

## Approach

Reuse the exact discipline the render already has (**forced tool → structural validate → `null` →
deterministic fallback**), generalized so the SAME free-chain/BYOK plumbing runs the two new tools;
dispatch model-backed stages inside the existing `runUsecase` loop; thread the search output into the
render so the model's own matches ground the cards.

Seams (from exploration — line numbers in the Source map):
- **A — `runUsecase` loop** (`worker/src/worker.ts:189-196`): already receives `ctx: ModelCtx` but only the
  render (`renderBatch`, line 199) uses it → add per-stage dispatch here.
- **B — `StageDef` + `assertUsecaseDef`** (`worker/src/usecases.ts:12-16, 32-48`): add an optional executor
  field; validate it; update the founders JSON.
- **C — generalize model plumbing** (`worker/src/agent/model.ts`, `providers.ts`, `shared/renderTool.ts`):
  everything is `render_ui`-specific → parameterize tool + validator so the chain runs any tool.
- **D — data** (`data/demo/opportunities.sample.json`): keep FACTS deterministic; `score`/`whyItFits`/
  `stageFit` become `search_opportunities` output.
- **Stays deterministic:** incorporate card (`shared/incorporate.ts`, never LLM), stub fallback
  (`cards.ts`), injection/`demo` force-stub (`resolveRun`), structural validation, `route` render mode.

## Phased delivery (branch per PR → CI-gated PR → squash-on-green → prune; check in between each)

### PR-1 — generalize the model plumbing (no behavior change)
- `worker/src/agent/model.ts`: extract `callModelTool(opts, tool, extract, validate)` from
  `callRenderModel` (the forced-tool fetch + `null`-on-any-failure, `model.ts:46-94`); keep
  `callRenderModel` as a thin wrapper (`RENDER_UI_TOOL` + `extractBatch` + `isSelfContainedBatch`).
  Generalize `extractBatch` (`model.ts:30-39`) → `extractToolArgs(data, toolName)` returning the parsed
  arguments object (render wrapper picks `.messages`).
- ~~`worker/src/agent/providers.ts`: extract generic `tryCall`/`runChain`~~ **→ MOVED TO PR-2** (as built):
  the provider-chain generalization has no consumer until per-stage dispatch, so it lands there with its
  first use (AHA — no unused abstraction). PR-1 left `providers.ts` + `providers.test.ts` untouched.
- `shared/` new tool modules (siblings of `renderTool.ts`), each = JSON tool schema + dependency-free
  output validator:
  - `ASSESS_STAGE_TOOL` → `{ reasoning: string, stage: "idea"|"prototype"|"pre-incorporation"|"incorporated", unlock: string[] }`.
  - `SEARCH_OPPORTUNITIES_TOOL` → `{ reasoning: string, matches: [{ id, score, whyItFits, stageFit }] }`,
    with `id` constrained to the provided opportunity ids (validator **rejects invented ids** — pass the
    allowed id set into the validator, mirroring `isSelfContainedBatch`'s self-containment check).
- **TDD (modules):** `worker/test/model.test.ts` gains `callModelTool` (good / invalid / throws); new
  tool-validator tests (accept valid, reject invented ids / missing fields). Existing render tests
  (`model.test.ts`, `providers.test.ts`) stay green via the wrappers.

### PR-2 — per-stage model dispatch (the core)
- `worker/src/usecases.ts`: `StageDef += exec?: "assess_stage" | "search_opportunities"` (absent ⇒ canned);
  extend `assertUsecaseDef` (`usecases.ts:43-47`) — `exec` optional; if present must be a known executor.
  `usecases/founders-copilot.json`: tag the `plan` stage `exec:"assess_stage"`, the `search_opportunities`
  stage `exec:"search_opportunities"`; `incorporate` stays canned.
- `worker/src/worker.ts` `runUsecase` loop (189-196): for a stage with `exec` AND a live model
  (`ctx.key` or `ctx.providers.length`) AND not `forceStub` → run the tool via the generalized chain; emit
  `TOOL_CALL_START`, the model's `reasoning` as one `TEXT_MESSAGE_CONTENT`, then `TOOL_CALL_END`
  (structured result); emit an OpenInference **LLM** span. **Reuse for free:** `openInferenceKind`
  (`arize.ts:34-39`) maps any span whose `name` starts with `model:` to `LLM` — so name the spans
  `model:assess_stage` / `model:search_opportunities` and the LLM kind + `model` + token `usage` attrs
  drop straight in (same shape as the existing `model:openrouter` render span, `worker.ts:62,67`). On
  failure/invalid OR no model OR `forceStub` → play the canned events verbatim (**never worse than today**).
  Accumulate the `search_opportunities` matches and thread them into `renderBatch`.
- `worker/src/worker.ts` `renderBatch` (47-72) + `shared/prompt.ts`: when matches exist, ground
  `foundersUser` (`prompt.ts:22-24`) in the MODEL's matches (ranked ids + whyItFits/stageFit) instead of
  the raw pre-scored JSON; stub path still uses `buildOpportunityCards()`.
- **TDD (modules):** `worker/test/run.test.ts` — a model-backed stage (fake provider/fetch) streams a
  `TEXT_MESSAGE_CONTENT` + emits its LLM span + `TOOL_CALL_END`; a stage model-failure → canned text still
  appears; `demo=1`/injection → all stages canned (existing span-order assertions hold).
  `usecases.test.ts` — `assertUsecaseDef` accepts/rejects `exec`.

### PR-3 — HUD status bar (RESHAPED from "cost chip") → detailed plan: **`docs/plans/008-hud-status-bar.md`**
> Reshaped: the cost chip grows into a **Demo⇄Live toggle + honest 3-state mode/model/cost chip** (also
> wires the `?demo=1` switch, which was unreachable from the UI). Full design + source map in plan 008; the
> cost-chip mechanics below still hold.
- Worker: emit accumulated token usage to the UI — a new `AgentEvent` (`{ type: "USAGE", … }`) carrying
  summed prompt/completion tokens (+ derived cost if a rate is configured), reusing `ModelResult.usage`
  (`model.ts:16-20`) from each call. `AgentEvent` is `{ type: string; text?; a2uiMessages? }`
  (`usecases.ts:7-11`) — extend the type or ride `text` with a JSON payload (prefer a typed field).
- UI: a small **cost chip** in the HUD (`ui/src/EventStream.tsx` / `App.tsx`); the event vocabulary +
  `applyA2UIEvent` already tolerate arbitrary event types.
- **TDD (modules):** ui — USAGE event → chip value (pure mapping); worker — usage summed across stages +
  render, emitted once.

### PR-4 — Arize live resolution + notes + docs (ops/docs)
- **Resolve the Arize key/space (account-side):** obtain the space's **ingestion** key + `space_id` (same
  Space Settings page; see #50); set them, then re-verify OTLP end-to-end (the new per-stage LLM + cost
  spans flowing). Code is already correct (#44, `worker/src/trace/arize.ts`) — **no code change**.
- **Notes (answering "where"):** update **issue #50** with the root cause — *OTLP 500 "unable to validate
  authorization from span" = account-side ingestion authorization, verified NOT code/format/`space_id`
  (reproduced with a fresh space key AND Arize's own `@opentelemetry/exporter-trace-otlp-proto` SDK);
  likely free-tier/trial entitlement or wrong key-type*. Add the reusable gotcha to **`AGENT_LEARNINGS.md`**
  (create if absent — see `.claude/rules/compound-learning.md` promotion path).
- **Docs:** `docs/usecase-workflows.md` (assess_stage now live, drop "PLANNED #18"). **Closes #18** on merge.

### PR-5 — capstone: usecase expansion (the "swap a JSON, swap the app" proof)
Once the pipeline is corpus-agnostic, adding a usecase is a JSON + data drop. **All three** approved:
`benefits-copilot`, `tender-finder`, `support-finder`.
- **Make the render corpus-agnostic** (the enabling change): `RenderDef` (`usecases.ts:18-20`, today just
  `{ mode }`) gains `corpus` (which `data/demo/<id>.json` to ground in) + `framing` (a one-line
  who's-asking / what-they're-matched-to string) + `incorporate?: boolean`. The `founders` render
  (`renderBatch`, `worker.ts:47-72`) + `foundersUser`/`FOUNDERS_SYSTEM` (`prompt.ts:16-24`) generalize into
  a **`match`** path reading those; `founders-copilot` becomes the first instance (`incorporate:true`) — no
  behavior change. The `assess_stage` / `search_opportunities` tools + validators (PR-1) are already
  corpus-agnostic → reused unchanged; only framing + corpus differ. **Watch-out:** the Worker imports the
  corpus statically (`worker.ts:8` `import … opportunities.sample.json`; `cards.ts:1-2`) — Workers bundle
  JSON at build time, so a `corpus` field must map to a static import table (a small `Record<id, data>`),
  NOT a dynamic path read. Incorporate card stays founders-only (guarded by the `incorporate` flag).
- **Add three usecases**, each = `usecases/<id>.json` (assess + search + render stages with the same `exec`
  tags) + synthetic `data/demo/<id>.json` corpus + a one-line framing:
  - `benefits-copilot` — a Londoner's situation → claimable benefits/entitlements.
  - `tender-finder` — an SME → public tenders/contracts to bid on.
  - `support-finder` — a person in hardship → matched local support services.
- **UI:** `ui/src/App.tsx` `USECASES` gains the three ids (label / hint / placeholder / example each).
- **TDD (modules):** `usecases.test.ts` — each new def passes `assertUsecaseDef` and drives `runUsecase`
  end-to-end (canned/no-network) proving "swap a JSON, swap the app"; the `match` render grounds in the
  correct corpus per usecase.
- **Data (AGENTS.md):** synthetic `data/demo/*.json` only (real/scraped stays gitignored, ToU-gated).
- **Docs:** `CHANGELOG`; `docs/handoffs/008-*` resume point (final step of the plan).

## Docs & issues (the recurring checklist, pre-answered)
- **CHANGELOG** — an entry per PR (Unreleased section, keep-a-changelog).
- **Root README** — the `What` section + ASCII diagram (`README.md:33-42`, two workflows → five) + the
  `Switches` line (`README.md:92-94`; `?usecase=` gains `benefits-copilot` / `tender-finder` /
  `support-finder`) + the pipeline blurb (assess + search now live, not one render call). PR-2 (reasoning) +
  PR-5 (usecases).
- **`docs/architecture.md`** — the render is no longer a single call: per-stage model tools + generalized
  `match` render + per-stage Arize LLM spans. PR-2.
- **`docs/UserStory.md`** — three new user stories (Londoner→benefits, SME→tenders, person→support). PR-5.
- **`docs/usecase-workflows.md`** — assess_stage live (drop "PLANNED #18") + the three new workflows.
- **Roadmap** = issues + `docs/plans/` (this plan is `docs/plans/007`).
- **URL / env / CLI switches** — document the new `?usecase=` ids (README `Switches` + `ui/src/App.tsx`
  `USECASES`); any new var (e.g. an optional cost-rate for the chip) → `worker/.dev.vars.example`. No new
  URL/endpoint (`/run` + `/trace` unchanged).
- **Issues** — **closes #18** (Phase 2). Update **#50** (Arize root cause) + `AGENT_LEARNINGS.md`.
  Fast-follows already tracked (browser-BYOK parity — new note; KV corpus #13; on-it live tools #4/#8). No
  per-usecase issue (they ship in this plan).

## Workflow
Branch per PR (topic branch) → **commit by topic** → CI-gated PR → **squash-merge on green** (all CI +
tests pass) → **prune stale remote + local branches**. Identity: GitHub noreply, `--no-gpg-sign`, prefix
git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`. Strict TDD (module tests first, only load-bearing modules —
not glue/one-shot scripts); lint + semgrep gates. PR bodies via `--body-file` (backticks in `--body`
shell-substitute → `:free: command not found`). `docs/submission.md` PARKED.

## Verification
- **Per PR:** `make test` (worker+ui) · worker `tsc --noEmit` · ui lint/typecheck/build · markdownlint ·
  semgrep — CI gates (docs/security/ui/worker/CodeFactor). Watch CodeFactor "Complex Method" (it flagged
  `resolveRun` in #43 — extract helpers if it flags).
- **Live (`wrangler dev` + real free-chain):** a keyless founders Run streams two real reasoning lines
  (assess + search) before the cards; `wrangler tail` shows `model:assess_stage` / `model:search_opportunities`
  LLM spans with token usage + the render span; the HUD shows a cost chip; a forced model failure (bogus
  `WORKERS_AI_MODEL`) degrades each stage to its canned text without breaking; `demo=1` → fully canned.
- **Arize:** once a valid ingestion credential is set (#50), confirm the per-stage LLM + usage spans land
  on the dashboard (blocked account-side until then).
- **New usecases:** drive each of `benefits-copilot` / `tender-finder` / `support-finder` → real reasoning
  and matched cards over its OWN corpus, no code change beyond the JSON + data (the "swap a JSON" proof);
  `founders-copilot` unchanged.
- **Drive it:** recapture the demo GIF (polyfetch) to show the streamed reasoning (+ a usecase swap).

## Out of scope (Phase 2)
KV corpus (deferred #13) · browser-BYOK multi-stage parity (fast-follow) · Track A model tools (#4) ·
true token-by-token streaming (structured stage-end reasoning this phase).

---

# Source map — current code (don't re-explore)

Everything below is the **verified current state** (2026-07-09, `main`). Line numbers are current; treat
them as a starting anchor, not gospel, if code shifts.

## The pipeline TODAY (one model call = the render)

```
POST /run?usecase=<id>  (worker.ts:206 fetch → resolveRun → runUsecase → SSE)
  └ runUsecase(def, emitter, write, runAttrs, ctx, paceMs)     worker.ts:179-203
      ├ span "run"                                             worker.ts:187
      ├ for stage of def.stages:                               worker.ts:189-196
      │     for e of stage.events: sleep(paceMs); write(e)     ← ALL CANNED today
      │     span stage.span {kind, latencyMs}                  worker.ts:195
      └ renderBatch(def.render, emitter, ctx)                  worker.ts:199  ← THE ONLY model call
            ├ mode "route" → buildRouteCards() (canned)        worker.ts:48
            ├ no key & no providers → stub                     worker.ts:50
            ├ ctx.key → callRenderModel(...) → span model:openrouter   worker.ts:59-63
            └ else → renderFree(ctx.providers, args) → span model:<name>   worker.ts:65-67
```

**Key fact for PR-2:** the loop at `worker.ts:189-196` already receives `ctx: ModelCtx` (with `.key`,
`.providers`, `.prompt`) but only `renderBatch` (line 199) uses it. Add per-stage dispatch inside that loop.

## Files & signatures

### `worker/src/worker.ts` (265 lines) — the interpreter + HTTP entry
- `interface ModelCtx` (28-34): `{ key, model, baseURL, prompt, providers: Provider[] }`. `key` empty ⇒
  keyless free chain / stub.
- `renderBatch(render: RenderDef, emitter, ctx): Promise<unknown[]>` (47-72) — dispatch by `render.mode`;
  20 s AbortController timeout (52); `withIncorporate(...)` on both stub + model paths (49, 63, 68).
- `freeChain(env): Provider[]` (92-106) — builds the chain from env via `buildProviders`.
- `modelLabel(def, key, providerCount, model): string` (109-113) — the "run" span's model attr.
- `resolveRun(request, env, def, demo)` (131-175) — parses body (`prompt`, `model`), reads `Authorization:
  Bearer` → BYOK key, `detectInjection(prompt)` (150) → `forceStub = demo || flagged` (152), builds
  `providers = !forceStub && !key ? freeChain(env) : []` (155). Returns `{ modelCtx, runAttrs, paceMs }`.
  **This is where `forceStub` lives — PR-2's per-stage dispatch must honor it.** (CodeFactor flagged this
  method in #43; helpers `freeChain`/`modelLabel` were extracted to fix it.)
- `runUsecase(def, emitter, write, runAttrs, ctx, paceMs)` (179-203) — **Seam A**. Exported for tests.
- `default.fetch` (206-264) — routes `/run` + `/trace`; per-IP `RATE_LIMITER.limit` (219-223); SSE via
  `ReadableStream` + `write(e)` = `data: ${JSON.stringify(e)}\n\n` (247).
- `Env` (10-26): `ARIZE_*`, `OPENROUTER_KEY`, `AI` (Workers AI binding), `GITHUB_MODELS_TOKEN`,
  `WORKERS_AI_MODEL`, `OPENROUTER_FREE_MODEL(S)`, `GITHUB_MODEL`, `PACE_MS`, `DEFAULT_MODEL`, `RATE_LIMITER`.

### `worker/src/usecases.ts` (65 lines) — usecase types + load-time guard  — **Seam B**
- `interface AgentEvent { type: string; text?: string; a2uiMessages?: unknown[] }` (7-11).
- `interface StageDef { span: string; kind: string; events: AgentEvent[] }` (12-16) → **PR-2 adds
  `exec?: "assess_stage" | "search_opportunities"`**.
- `type RenderMode = "founders" | "route"` (17); `interface RenderDef { mode: RenderMode }` (18-20) →
  **PR-5 adds `corpus`, `framing`, `incorporate?`**.
- `interface UsecaseDef { id, title, render: RenderDef, stages: StageDef[] }` (21-26).
- `assertUsecaseDef(x): asserts x is UsecaseDef` (32-48) — load-time author-slip guard; the per-stage
  check is 43-47 (**extend for `exec`**).
- `registry` (55-58): `{ "founders-copilot": load(foundersJson), "on-it": load(onitJson) }`.
- `getUsecase(id)` (62), `usecaseIds` (60). **PR-5 registers the three new ids here + static-imports each.**

### `worker/src/agent/model.ts` (94 lines) — the forced-tool model call  — **Seam C**
- `interface ModelCall { apiKey, model, baseURL, system, user, signal? }` (8-15).
- `interface ModelResult { batch: unknown[], model, usage:{promptTokens?,completionTokens?,totalTokens?} }` (16-20).
- `interface ORResponse` (24-27) — OpenAI-compatible chat-completions shape (OpenRouter/GitHub/Workers-AI).
- `extractBatch(data: ORResponse): unknown[] | null` (30-39) → **PR-1: generalize to
  `extractToolArgs(data, toolName)`** (parse `tool_calls[0].function.arguments`, checking `.name`).
- `isValidBatch = isSelfContainedBatch` re-export (44).
- `callRenderModel(opts: ModelCall): Promise<ModelResult|null>` (46-94) — POST `/chat/completions`, forced
  `tool_choice render_ui` (61-62), `max_tokens: 8000` (64), `temperature: 0.2`. Returns `null` on ANY
  failure (HTTP/empty/invalid/throw). → **PR-1: extract `callModelTool(opts, tool, extract, validate)`;
  keep `callRenderModel` as the `RENDER_UI_TOOL` wrapper.**

### `worker/src/agent/providers.ts` (147 lines) — the keyless free chain  — **Seam C**
- Consts: `DEFAULT_WORKERS_AI_MODEL = "@cf/openai/gpt-oss-120b"` (17), `DEFAULT_GITHUB_MODEL` (18),
  `DEFAULT_OPENROUTER_FREE_MODELS` (6-model list, 21-28).
- `interface RenderArgs { system, user, signal? }` (30-34).
- `interface Provider { name: string; tryRender(args: RenderArgs): Promise<ModelResult|null> }` (35-38) →
  **PR-1: the method to generalize (pass the tool through, or add a sibling).**
- `workersAiProvider(ai, model)` (42-72) — `ai.run(model, {messages, tools:[RENDER_UI_TOOL], tool_choice}, {signal})`.
- `openRouterFreeProvider(key, models)` (77-92) — loops the model list, first valid wins, logs fall-through.
- `githubModelsProvider(token, model)` (96-102) — retires 2026-07-30.
- `toResult(out, model)` (105-117) — extract → `isSelfContainedBatch` → usage.
- `renderFree(providers, args): Promise<{result, provider}|null>` (120-129) → **PR-1: generalize to
  `runChain(providers, call)`; keep `renderFree` as the render wrapper.**
- `buildProviders(opts): Provider[]` (132-146) — cheapest-first; only present bindings/secrets.

### `shared/` (repo-root, dependency-free, imported by BOTH `ui/` and `worker/`)
- `shared/prompt.ts` — `A2UI_RULES` (7-14, condensed authoring rules), `FOUNDERS_SYSTEM` (16-18),
  `foundersUser(idea, opps): string` (22-24). → **PR-2 grounds `foundersUser` in model matches; PR-5
  generalizes `FOUNDERS_SYSTEM`/`foundersUser` into a `match` framing.** Add `ASSESS_*`/`SEARCH_*` prompts.
- `shared/renderTool.ts` — `RENDER_UI_TOOL` (6-18, JSON tool schema), `isSelfContainedBatch(batch)` (22-51,
  structural validator: root defined+in ids, every Card.child + Column explicitList ref defined). → **PR-1
  siblings: `shared/assessTool.ts` + `shared/searchTool.ts` (schema + validator each).**
- `shared/guard.ts` — `detectInjection(prompt): { flagged, reason }` (used at `worker.ts:150`).
- `shared/incorporate.ts` — `appendIncorporate(batch)` (41-54): finds the root Column's `explicitList`,
  pushes a static verified gov.uk/Companies-House link card. **NEVER LLM-generated (#12).** Re-exported as
  `withIncorporate` from `cards.ts:129`. **PR-5: guard behind `RenderDef.incorporate`.**

### `worker/src/a2ui/cards.ts` (129 lines) — deterministic stub batches (fallback, never removed)
- `cardsBatch(cards)` (67-87) — root `Column` of `Card`s; each Card → body `Column` of `Text`s. The
  canonical self-contained A2UI v0_8 shape the validator checks + `@a2ui/react` renders.
- `buildOpportunityCards(opps=opportunities)` (90-106) — Track B stub; static import of
  `opportunities.sample.json` (1). `buildRouteCards(r=route)` (109-124) — Track A stub.
- `withIncorporate = appendIncorporate` (129).

### `worker/src/trace/arize.ts` (131 lines) — spans + OTLP export (code correct; ingestion blocked #50)
- `openInferenceKind(s)` (34-39): `name` starts `model:` → **LLM**; `attrs.kind==="tool"` → TOOL;
  `"render"` → LLM; else CHAIN. **PR-2 reuse: name per-stage spans `model:assess_stage` /
  `model:search_opportunities` → auto LLM kind.**
- `spansToOtlp(spans, env)` (51-82), `exportSpans(env, spans)` (85-100, POST `otlp.arize.com/v1/traces`,
  headers `space_id` + `api_key`, JSON, never throws), `makeEmitter(env)` (128-130, console unless both
  Arize creds set), `MAX_TRACE_SPANS = 100` (23).

### Data & usecase JSON
- `usecases/founders-copilot.json` — 3 stages: `plan` / `tool:search_opportunities` / `tool:incorporate`,
  all canned event strings; `render.mode = "founders"`. → **PR-2 tags plan `exec:"assess_stage"`, search
  `exec:"search_opportunities"`.**
- `usecases/on-it.json` — Track A (canned; stays canned this phase).
- `data/demo/opportunities.sample.json` — 3 opportunities, each `{ id, title, org, deadline, category,
  score, whyItFits, sourceUrl, eligibility:{qualified,met[],missed[]} }`. → **PR-2: `score`/`whyItFits`
  become `search_opportunities` OUTPUT; keep facts (title/org/deadline/eligibility) deterministic.**
- `data/demo/route.sample.json` — Track A route data.

### Tests (Vitest, `worker/test/`) — extend, TDD-first
- `model.test.ts` (imports `isValidBatch`, `extractBatch`, `callRenderModel`) — PR-1 adds `callModelTool` +
  tool-validator tests.
- `providers.test.ts` — first-valid / all-fail / fall-through logging (the chain's TDD shape).
- `run.test.ts` — drives `runUsecase`; span-order + SSE assertions. PR-2 adds model-backed-stage +
  fail-to-canned + `demo`/injection-all-canned.
- `usecases.test.ts` — `assertUsecaseDef` accept/reject. PR-2 (`exec`) + PR-5 (new defs end-to-end).
- UI tests under `ui/` — PR-3 cost-chip mapping.

### UI (browser SPA) — PR-3 + PR-5 touch points
- `ui/src/App.tsx` — `USECASES` array (label/hint/placeholder/example per id; Track B default, no auto-run
  on load per #51). **PR-5 adds the 3 new ids; PR-3 may host the cost chip.**
- `ui/src/EventStream.tsx` — the HUD event list. **PR-3 cost chip.**
- `ui/src/agent/liveAgent.ts` — browser-BYOK render path (reuses `shared/`). **Stays render-only this
  phase** (multi-stage BYOK parity = fast-follow).

## The one discipline to reuse everywhere
**forced tool → structural validate → `null` → deterministic fallback.** It already exists three places
(`callRenderModel` model.ts:78-81, `toResult` providers.ts:107, `renderFree` providers.ts:124). PR-1
parameterizes it; PR-2 applies it per stage (fallback = the canned events, not the stub). **Never worse
than today** is the invariant: any model miss on any stage degrades to the existing canned behavior.
