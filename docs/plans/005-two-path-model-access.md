---
title: "Plan 005 — two-path model access (browser-BYOK + keyless Worker free-chain) + guards + Arize-everywhere"
type: plan
updated: 2026-07-08
issues: [37]
closes: [21]
---

# Plan 005 — two-path model access (#37)

**SHIPPED (2026-07-08) — see the Status section below.** Minimize using our own key; maximize reuse of the base `qte77/agenthud-agui-a2ui`;
**share** cross-cutting code; both paths carry **rate-limiting** + a **prompt-injection guard**; **Arize
spans every path** (pulls in + closes **#21**). Phased **4 PRs**, each its own strict-TDD PR with a check-in
(NOT one mega-PR). `submission.md` PARKED. Standard workflow: branch → Conventional Commit → CI-gated PR →
squash → prune; git identity noreply, `--no-gpg-sign`, prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`.

## Status (2026-07-08) — SHIPPED

All 4 PRs merged: **#42** (`shared/` + guard + rate-limit) · **#43** (free chain) · **#44** (Arize OTLP +
`/trace`, closed **#21**) · **#45** (browser-BYOK, closed **#37**). Follow-ups: **#46** (`:free` fallback
list of 6 verified free+tools models) · **#47** (incorporate card moved to `shared/`, now on the browser
path too).

Live-verified 2026-07-08 (real keys): ✅ render mechanism (claude-haiku → self-contained batch) · ✅
OpenRouter `:free` default live · ✅ Arize OTLP **JSON** accepted (no protobuf). Still open (need env):
❌ Workers AI glm — CF token missing **Workers AI Read** permission; ⛔ `ARIZE_SPACE_ID` — read from the
Arize Space Settings page (not creatable via REST for us). **Resume:** `docs/handoffs/006-two-path-shipped.md`.

## Why / intended outcome

Today the Worker holds `OPENROUTER_KEY`; the keyless demo shows the deterministic **stub**, and a manual
founders Run burns our key. Outcome: (A) a user's key calls the model **directly from the browser** (never
touches our Worker — reuse agenthud), and (B) the **keyless** path renders a **real** model via a free
chain (Cloudflare Workers AI → OpenRouter `:free` → GitHub Models → stub) — so we rarely/never spend. Both
guarded (rate-limit + injection) and traced to Arize.

**Design rule (AHA):** the model *call* can't be one code path (browser Vercel-AI-SDK vs Worker
binding/fetch); unifying it would drag `zod` into the dep-free Worker. Only the cross-cutting pieces are
shared via a dep-free repo-root `shared/` (imported by both, exactly like `../../data/demo/*.json` is today).

**Safety invariant:** every provider output runs through the structural validator → on failure, fall to the
next tier / stub. **Never worse than today.**

---

## The 4 PRs

### PR-1 (worker) — `shared/` foundation + rate-limit + injection guard
- New `shared/prompt.ts` (move Worker `A2UI_RULES` + `FOUNDERS_SYSTEM`; strip asset/Image + `dataModelUpdate`
  guidance) + `foundersUser(idea, opps)`. `shared/renderTool.ts` (move Worker `RENDER_UI_TOOL` + a plain-TS
  `isSelfContainedBatch(batch)` extracted from the Worker's `isValidBatch` — no zod). `shared/guard.ts`
  `detectInjection(text): {flagged, reason?}` (small regex list; simple/honest).
- Worker imports prompt+tool+validator from `shared/`. Rate-limit at top of `fetch`
  (`[[ratelimits]] name="RATE_LIMITER"`, per-IP ~20/60s → `429`). `detectInjection(prompt)` in `resolveRun`
  → flagged ⇒ skip model, return stub / `RUN_ERROR`.
- TDD: `worker/test/guard.test.ts`; extend `run.test.ts` (flagged→stub, `429`). Existing tests untouched.

### PR-2 (worker) — keyless free-fallback chain + provider spans
- New `worker/src/agent/providers.ts`: `Provider { name; tryRender({system,user,signal}): Promise<ModelResult|null> }`;
  `workersAiProvider(ai, "@cf/zai-org/glm-4.7-flash")`, `openRouterFreeProvider(key, ":free id")`,
  `githubModelsProvider(token)`; `renderFree(providers)` = first-valid-wins.
- `worker.ts`: `Env += AI?: Ai; GITHUB_MODELS_TOKEN?`. `resolveRun` builds `providers[]` only from present
  bindings/secrets. `renderBatch` keyless → `renderFree`; emit `model:<provider>` span (keep `openrouter`
  for the keyed path so `run.test.ts`'s demo=1 assertion holds). `wrangler.toml += [ai] binding="AI"`.
- TDD: `providers.test.ts` (fake `Ai.run` + `vi.stubGlobal(fetch)`; ordering, first-valid, empty→null).
- **Spike:** confirm glm-4.7-flash actually returns a valid `render_ui` batch; else lean on `:free`.

### PR-3 (worker) — real Arize OTLP export + `/trace` forwarder (closes #21)
- `worker/src/trace/arize.ts`: replace console stub — when `ARIZE_API_KEY`+`ARIZE_SPACE_ID` set, batch spans
  → POST OTLP to `https://otlp.arize.com/v1/traces` (headers `space_id`,`api_key`; OpenInference span kinds
  CHAIN/TOOL/LLM). Console fallback when unset. **Spike: OTLP-JSON vs protobuf?** (#21 open question).
- New `POST /trace`: accepts a JSON span batch from the browser, caps/validates, forwards via the same
  exporter (keeps `ARIZE_API_KEY` Worker-only). CORS-allowlisted like `/run`.
- TDD: `trace.test.ts` (span→OTLP mapping; `/trace` accept/forward/reject). Closes #21.

### PR-4 (ui) — browser-BYOK (founders only) reusing `shared/` + `/trace` spans
- Add deps `ai ^6.0.208` + `@ai-sdk/openai ^3.0.74`. New `ui/src/agent/liveAgent.ts` (port agenthud's
  `runLiveAgent`+`streamPartToEvent` near-verbatim; forced `render_ui` inputSchema = ldnmxx
  `A2UIMessageBatchSchema`; prompt+tool+guard from `shared/`; drop agenthud's `toConnectionError` — already
  in `useAgentSSE`).
- `useAgentSSE.run` branch: `if (byok?.apiKey && !demo && usecase==="founders-copilot")` → `detectInjection`
  → `runLiveAgent(...)` via dynamic `import()`; else Worker fetch. Client throttle on `onSubmit`.
- Browser spans → `POST /trace`. Rendering reuses existing `applyA2UIEvent → processMessages`.
- TDD: `ui/tests/liveAgent.test.ts` (`streamPartToEvent` mapping).

---

## SOURCE / FILE / CODE MAP (so the next session need not re-map)

### Worker — `/workspaces/qte77/ldnmxx-hack/worker/`
- `src/agent/model.ts` (143 ln): `callRenderModel(opts: ModelCall): Promise<ModelResult|null>` — POSTs to `${baseURL}/chat/completions` with `tools:[RENDER_UI_TOOL]` + forced `tool_choice` render_ui, temperature 0.2, max_tokens 8000; returns null on non-OK / no tool call / invalid batch / throw. `extractBatch(data)` (exported): `data.choices[0].message.tool_calls[0].function` name==="render_ui", JSON.parse(arguments).messages. `isValidBatch` (exported): structural (root defined+in ids; Card.child + explicitList refs all defined). **`RENDER_UI_TOOL` + the `ORResponse` interface are NOT exported → export them for `shared/renderTool.ts` + providers.** `A2UI_RULES` exported (lines 136-143). `ModelCall{apiKey,model,baseURL,system,user,signal?}`, `ModelResult{batch,model,usage{promptTokens?,completionTokens?,totalTokens?}}`.
- `src/worker.ts`: `Env{ARIZE_API_KEY?,ALLOWED_ORIGINS?,OPENROUTER_KEY?,AI_GATEWAY_URL?,DEFAULT_MODEL?,PACE_MS?}`. `renderBatch(render: RenderDef, emitter, ctx: ModelCtx)` — THE plug point: `route`→`buildRouteCards()`; founders `stub = withIncorporate(buildOpportunityCards())`; `if(!ctx.key) return stub`; else 20s AbortController → `callRenderModel({...FOUNDERS_SYSTEM, foundersUser(ctx.prompt)})`; `if(!result) return stub`; `emitter.span({name:"model:openrouter",...})`; `return withIncorporate(result.batch)`. `resolveRun(request,env,def,demo)`: `key = demo ? "" : byokKey || env.OPENROUTER_KEY || ""`; `modelCtx{key, model: body.model||DEFAULT_MODEL||FALLBACK_MODEL, baseURL: env.AI_GATEWAY_URL||OPENROUTER_BASE, prompt}`; `runAttrs.model = key && def.render.mode==="founders" ? model : "(stub)"`. `runUsecase(def,...)` emits spans: run → per-stage(`plan`/`tool:*`) → `render`. `fetch` handler: OPTIONS→204, `/run` only, POST only, `getUsecase(usecase)` 400, SSE ReadableStream `data: <json>\n\n`, `ctx.waitUntil(emitter.flush())`. Constants: `OPENROUTER_BASE="https://openrouter.ai/api/v1"`, `FALLBACK_MODEL="anthropic/claude-haiku-4.5"`.
- `src/usecases.ts`: `getUsecase(id)`, `usecaseIds`, `UsecaseDef{id,title,render:{mode:"founders"|"route"},stages[]}`, `assertUsecaseDef`. Usecase JSON at repo-root `usecases/*.json` (imported build-time). `runUsecase` exported from worker.ts.
- `src/a2ui/cards.ts`: `buildOpportunityCards()`, `buildRouteCards()`, `withIncorporate(batch)` (appends the verified incorporate card; guarded on Column-root), `incorporateSpec()`, `cardComponents(card)`, `cardsBatch(cards)`. `CardSpec{key,title,lines[]}`.
- `src/trace/arize.ts` (40 ln): `Span{name,attrs?}`, `Emitter{span(s):void; flush():Promise<void>}`, `TraceEnv{ARIZE_API_KEY?}`, `makeEmitter(env)` → `env.ARIZE_API_KEY ? arizeEmitter() : consoleEmitter` (both log `⌁ span`; arize is a stub). **PR-3 replaces arizeEmitter with real OTLP.**
- `wrangler.toml` (14 ln): `[observability] enabled` + `[vars] ALLOWED_ORIGINS`. **No `[ai]`, no `[[ratelimits]]`, no KV.** `tsconfig.json` types `["@cloudflare/workers-types","vitest/globals"]` → the `Ai`/`RateLimit` types are already global (no new dep). `package.json`: devDeps only (no runtime deps — hand-rolled fetch).
- **Workers AI binding** (`worker/node_modules/@cloudflare/workers-types/index.d.ts`): `Ai.run<Name>(model, inputs, options?)`. Use **ChatCompletions-typed** models (`@cf/zai-org/glm-4.7-flash`, `@cf/moonshotai/kimi-k2.6`, `@cf/google/gemma-4-26b-a4b-it`, `@cf/openai/gpt-oss-120b`) — their `inputs = ChatCompletionsInput` supports `messages`+`tools`+`tool_choice:{type:"function",function:{name}}`; `postProcessedOutputs = ChatCompletionsOutput` ≡ `ORResponse` (choices[0].message.tool_calls[0].function.arguments = JSON string) → **reuse `extractBatch`+`isSelfContainedBatch` verbatim**. AVOID `BaseAiTextGeneration`/`@cf/meta/llama-3.3-70b-instruct-fp8-fast` (no `tool_choice`). `AiOptions` has `signal`.
- **Tests** (the TDD patterns): `test/model.test.ts` — `vi.stubGlobal("fetch",...)`, `toolResponse(batch)` fixture; `afterEach(vi.restoreAllMocks)`. `test/run.test.ts` — `worker.fetch(post(u), env={ALLOWED_ORIGINS,PACE_MS:"0"}, ctx)`; parse SSE frames; `assertSelfContained`; spans via `vi.spyOn(console,"log")` filter `c[0]==="⌁ span"`; founders spans **must stay** `["run","plan","tool:search_opportunities","tool:incorporate","render"]` unless intentionally changed. New chain tests: fake `Ai = {run: vi.fn().mockResolvedValue(chatCompletionsOutput)} as unknown as Ai`; keep the AI binding OUT of existing tests' env so they hit the stub with no network.

### UI — `/workspaces/qte77/ldnmxx-hack/ui/`
- `src/agent/useAgentSSE.ts`: `run(usecase,prompt,byok?,demo=false)` — reset, then `fetch POST ${WORKER_BASE}/run?usecase=…[&demo=1]` w/ `Authorization: Bearer <byok.apiKey>` + `{prompt, model}`; local `dispatch(event)` → `applyA2UIEvent(event, Date.now()-start, render=processMessages)` + `appendLogEntry`. **Branch point ~line 106** after the reset block. `toConnectionError` already ported here.
- `src/agent/applyA2UIEvent.ts`: byte-identical to agenthud; validates `event.a2uiMessages` vs `A2UIMessageBatchSchema` before render; surfaces violations as log rows.
- `src/agent/contract.ts`: `A2UIMessageBatchSchema` — union **only** `beginRendering|surfaceUpdate` (NO `dataModelUpdate` — stricter than agenthud; strip from any ported prompt). `Card.child` single string; acyclic.
- `src/App.tsx`: BYOK state `apiKey`(default `VITE_BYOK_API_KEY`)/`model`(default `VITE_BYOK_MODEL`); ⚙ Key toggles one password + one model field (**no baseURL field, no endpoint dropdown**); `onSubmit` → `run(usecase, prompt, apiKey?{apiKey,model}:undefined)`; auto-run mount uses `demo=true`. `A2USurface`/`useA2UIActions().processMessages` reused by the catalog.
- `A2UISurface.tsx`: `A2UIProvider theme={qteA2uiTheme}` + `A2UIRenderer surfaceId="main"` (no onAction → rendered Buttons inert; no regression).
- `package.json`: has `@a2ui/react ^0.10.1`, `zod ^4.4.3`, `react ^19.2.7` (identical to agenthud). **Missing: `ai`, `@ai-sdk/openai`** — add near agenthud's `ai ^6.0.208`, `@ai-sdk/openai ^3.0.74`. (`@ag-ui/core` NOT needed.)
- `src/config.ts`: only `WORKER_BASE` (dev proxy / prod `https://ldnmxx-hack-worker.cloudflare-driveway392.workers.dev`). vite proxies `/run` → `:8787` (`vite.config.ts`). `ui/.env` (gitignored) provides a valid BYOK `VITE_BYOK_API_KEY`+`VITE_BYOK_MODEL` (+ an unused `VITE_BYOK_BASE_URL`) — use it to verify Path A / real gateway traffic.

### Reuse source — agenthud (`/workspaces/qte77/agenthud-agui-a2ui/`)
- `ui/src/agent/liveAgent.ts`: `runLiveAgent(settings:{baseURL,apiKey,model}, messages, onEvent, opts?)` — `createOpenAI({baseURL,apiKey})` → `streamText({model:openai.chat(model), system, messages, tools:{render_ui: tool({inputSchema: z.object({messages: A2UIMessageBatchSchema}), execute:()=>"rendered"})}, toolChoice:{type:"tool",toolName:"render_ui"}, stopWhen:stepCountIs(1), abortSignal})`; `for await (part of result.fullStream) onEvent(streamPartToEvent(part))`. `streamPartToEvent`: start→RUN_STARTED · text-delta→TEXT_MESSAGE_CONTENT · tool-input-start→TOOL_CALL_START · **tool-call(render_ui)→`{type:"TOOL_CALL_END",text:"render_ui",a2uiMessages:part.input.messages}`** · finish→RUN_FINISHED · error→RUN_ERROR. Ports near-verbatim; ldnmxx's `dispatch` is a drop-in `onEvent`.
- `worker/wrangler.toml`: the `[[ratelimits]] name="RATE_LIMITER" namespace_id=1001 [ratelimits.simple] limit=100 period=60` pattern to copy; worker uses `env.RATE_LIMITER.limit({key})` → `{success}`.
- `ui/src/config.ts` `ENDPOINTS[]`: optional dropdown to port later (out of scope). Note: **GitHub Models retires 2026-07-30** (flagged in agenthud config) → keep last in our chain, drop after.

### Shared mechanism
Both `ui/` and `worker/` already import `../../data/demo/*.json` → cross-package relative imports of a
repo-root `shared/*.ts` work in both bundlers (vite + wrangler/esbuild) **iff dependency-free** (worker has
no zod). Keep `shared/` plain TS (strings, plain objects, regex).

## Verification (patchright + `wrangler tail`)
- Keyless: `wrangler dev` (+`[ai]`) → founders Run renders from Workers AI (`tail` span `model:workers-ai`) + incorporate card; injection prompt → stub/RUN_ERROR; hammer `/run` → `429`; Arize dashboard shows the trace.
- Browser-BYOK: local stack + `ui/.env` key → founders Run renders; `tail` shows **no `/run`** but a `/trace` POST. Live re-verify after `wrangler deploy`.
- Patchright harness lives in the scratchpad pattern: uv-run `patchright` (polyfetch pins it; Chromium cached) driving the SPA — see this session's `verify_live.py` style (goto → click "Founder's Copilot" → "Run" → assert `a[href*="gov.uk"]` + screenshot).

## Follow-ups
- **Close #21** (real Arize export) with PR-3. **Update agenthud #187** (free-tier endpoints) with the
  two-tier findings after the build.
- Incorporate card on the browser path = move its links data into `shared/` (fast-follow).
