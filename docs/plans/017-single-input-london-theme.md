---
title: "Plan 017 — one input, London-themed: query-driven auto-routing + fo Linear theme"
type: plan
updated: 2026-07-23
status: "open — P0 mints the arc; next P1 theme"
refs: ["#201 (tracker)", "ADR 0003 (no-framework)", "ADR 0004 (auto-routing)", "ADR 0005 (theme-divergence)", "#185 (gazetteer, parallel)", "#199 (freshness watchdog, parallel)", "plan 016 (closed)"]
---

# Plan 017 — one input, London-themed

## Context (why)

Two owner-driven changes (decided 2026-07-23):

1. **UX — one input, no manual switching.** The user types ONE free-text ask ("food hygiene near
   SE1", "is Acme Ltd real", "GP near E8", "step-free to Westminster") and the app **chooses the
   workflow and builds it**. Framing/naming/wording become a single London civic assistant.
   **`sortmy.london` stays.**
2. **Theme — not flat EyeRest.** The UI today is flat EyeRest (amber `#7a6010` on parchment,
   vendored byte-identical from `qte77/brand`). Adopt the **fo `linear.css` system** (fo is the
   origin; sfc adopted it): near-black/white neutrals, one accent, one glow, one motion language,
   self-hosted Inter + JetBrains Mono — **adapted to London** via three trademark-safe accent
   variants, light + dark. **Everything self-hosted (js/css/fonts), no CDN.**

Framework question settled up front (→ ADR 0003): **no agent framework.** The app already has the
right minimal pattern (`callModelTool` forced-tool-call + `runChain` keyless fallback + zod).
Pydantic-AI is Python (won't run in this TS Worker); Vercel AI SDK assumes `process.env` and adds
bundle for nothing here; CF Agents SDK is for durable stateful agents. Revisit only for multi-step
agent loops / durable state.

## Progress — queue (tick per merged PR; progress report after each)

| # | Phase | Docs/ADR/issues it carries | Status |
|---|---|---|---|
| P0 | Arc mechanics: plan + handoff + tracker (#201) + ADR 0003/0004/0005 stubs | plan·handoff·tracker | ☐ |
| P1 | Theme: `tokens.css` EyeRest→fo Linear + **A/B/C variants** (light+dark), JetBrains Mono self-hosted, variant control | ADR 0005 · CHANGELOG · README stack · glossary | ☐ |
| P2 | Auto-router (modules, strict TDD): `agent/router.ts` + `shared/routerTool.ts` + prompt pair; `worker.ts` body-read-once; `USECASE_RESOLVED` event; **no-match suggestions card**; **Arize route span**; **`?usecase=` bypass** | ADR 0003+0004 · architecture · glossary | ☐ |
| P3 | Single-input UI + wording: remove switcher **control** (keep catalog as suggestion DATA), aria-live resolved announcement, reword all strings | README hero · UserStory · index.html meta | ☐ |
| P4 | Hardening + release v1.8.0: e2e (3 variants × light/dark), docs sync, issues, URL/env/CLI | CHANGELOG · all docs · issues | ☐ |

## Source map — do NOT re-explore (verified 2026-07-23, file:line)

### Theme

- `ui/src/tokens.css:17-41` — `@theme` block, ALL brand tokens (light). Dark at `:47-62`
  (`@media prefers-color-scheme:dark` scoped `:root:not([data-theme="light"])`) + `:63-76`
  (`:root[data-theme="dark"]`). **Vendored byte-identical from `qte77/brand`**; its header says
  "don't hand-tune — re-vendor upstream" → diverging IS the ADR-0005 decision. Current: bg
  `#ece8d8`/`#1c1a14`, surface `#e2dec8`/`#242018`, primary `#7a6010`/`#c8a858`, radius-card 12px.
- `ui/src/main.tsx:4-10` — `@fontsource/inter/latin-400|700` self-hosted; **JetBrains Mono dropped
  (`:7-8`)** → `--font-mono` falls back to system. P1 re-adds `@fontsource/jetbrains-mono`.
- `ui/public/_headers:5` — CSP `font-src 'self' data:`, `script/style-src 'self'` (+ CF insights).
  Self-host is already enforced; P1 adds NO external resource, CSP unchanged.
- `ui/src/index.css` — consumes tokens; styles `.a2ui-surface` (Card/Button/Tabs/Text/Image), a11y
  baseline, brand-mark. `ui/src/theme/a2uiTheme.ts` — maps A2UI catalog classes → `qte-*` hooks.
- `ui/public/theme-init.js` — anti-FOUC, EXTERNAL (not inline) so CSP needs no `unsafe-inline`;
  reads `?theme=` › `localStorage["qte77-theme"]` › system. **P1 mirrors it for `?variant=` ›
  `localStorage["qte77-variant"]`.** `ui/index.html:6` loads it; `:12` title, `:14-35` meta/OG.
- **Target values (fo `linear.css`)** — light: bg `#fcfcfd` surface `#f4f5f7` lift `#ffffff` border
  `#cfd3da` text `#0d0e0f` muted `#4b515b`; dark: bg `#08090a` surface `#0f1011` lift `#141516`
  border `#23252a` text `#f7f8f8` muted `#8a8f98`. **Accents** (contrast-checked 2026-07-23):
  **A Thames Teal `#0e7581`/`#2ea9b6` (default)**, **B Heritage Indigo `#4b53c4`/`#5e6ad2`**,
  **C Westminster Green `#2f6f4f`/`#4fae82`**. Semantic `--danger #e5484d` `--success #0ca30c`
  `--star #e5a50a`; glow `rgba(accent,.07/.10)`. Exact tokens CVD-validated in P1.

### Routing — the single resolution point

- `worker/src/worker.ts:438-445` — **THE point**: `const usecase = url.searchParams.get("usecase")
  ?? ""; const def = getUsecase(usecase); if(!def) 400`. Everything downstream keys off `def`.
- `worker/src/worker.ts:168-178` (`readRunBody`) called at `:448` inside `resolveRun` — reads the
  POST body (`{prompt, model}`) **AFTER** `def` resolves. **GOTCHA:** a body reads once, but the
  classifier needs `prompt` BEFORE resolution → move the body-read earlier in `fetch()` (`:413+`)
  and thread parsed `{prompt, bodyModel}` into both the router and `resolveRun`.
- `worker/src/usecases.ts:1-6,144-157` — `registry` (6 JSON imports via `load()`+`assertUsecaseDef`),
  `getUsecase(id)`/`usecaseIds`. `worker/src/workflows.ts:35-44` — `registry.render`/`registry.query`
  dispatch. **Interpreter (`runUsecase` `worker.ts:366-403`, `playStage`, `renderBatch`) stays CLOSED.**
- Client: `ui/src/App.tsx:11-78` `USECASES`; `:80-81` `USECASE_IDS`/`FLAGSHIP_ID`; `:151-153`
  `readUsecase()`; `:166-171` `switchTo` (**the control to remove**); `:173-180` `onSubmit`→`run`.
  `ui/src/usecase.ts:4-11`. `ui/src/agent/useAgentSSE.ts:114-133` `runWorkerPath` (usecase in query,
  prompt in body); `:92-109` `readSSE`; `ui/src/agent/applyA2UIEvent.ts:66-106` tolerates unknown
  event types generically (so `USECASE_RESOLVED` is additive).

### Reuse — no new transport needed

- `worker/src/agent/model.ts:150-191` `callModelTool<T>` (generic forced tool-call);
  `worker/src/agent/providers.ts:50-56,124-155` `Provider.tryCall<T>` + `runChain` +
  `buildProviders` (keyless Workers-AI → OpenRouter `:free`). **Proof for non-render stages:**
  `worker.ts:254-280` `runStageModel` builds an inline `ToolSpec` + `runChain` for the founders
  stages → the classifier copies this shape exactly.
- `shared/sanitize.ts:10-20` `normalisePostcode` (postcode from free text — the strong signal for
  care/wander/food-hygiene). `shared/guard.ts:13-37` `detectInjection` — the repo's pure regex-array
  classifier pattern to mirror; **router MUST gate user text through it before any model call.**
  Tool-spec siblings: `shared/assessTool.ts`, `shared/searchTool.ts`; prompts `shared/prompt.ts:29-33`.
- `worker/src/trace/arize.ts` — span emitter; P2 adds ONE route span.

### e2e — extend, do not rebuild

`tests/e2e/ui_sweep.py <url> <label>` (run via `uv run --project /workspaces/qte77/polyfetch-scrape
python tests/e2e/ui_sweep.py …` from the repo root): patchright chromium, 5-config viewport/device
matrix, clicks switch-buttons + CTAs, videos BOTH orientations, console/network capture (fails on
model-host OR console errors), vendored axe (gates critical+serious). Flows are DATA
`tests/e2e/flows.json`; history `tests/e2e/runs.jsonl`.

## Phases — TDD rule: load-bearing MODULES get RED-first tests; CSS/config/glue/copy do NOT (e2e is their test)

- **P1 Theme** (CSS/config → e2e + axe ARE the test; no unit tests). Replace `tokens.css` values
  with fo Linear neutrals; add `[data-variant="thames|indigo|green"]` blocks (accent, hover, glow,
  primary-on) for light AND dark; default thames (no attribute). Re-add
  `@fontsource/jetbrains-mono` (self-hosted). Add `variant-init.js` (mirror `theme-init.js`) + a
  variant cycle control (mirror `ThemeToggle`) writing `localStorage["qte77-variant"]` + `?variant=`.
  **Done-when:** sweep PASS across **3 variants × light/dark**; axe 0 critical/0 serious (contrast
  AA) on every combination; no external request (CSP unchanged); no hardcoded hex outside
  `tokens.css`. **ADR 0005 written.**
- **P2 Auto-router** (load-bearing MODULES → strict TDD, RED observed first).
  - New pure `worker/src/agent/router.ts`: `classifyHeuristic(prompt): string|null` (postcode via
    `normalisePostcode` + keyword sets → care/wander/food-hygiene/route/scam) and
    `classifyUsecase(prompt, providers): Promise<{id: string|null, source:"heuristic"|"model"|"none"}>`
    — heuristic → model escalation on ambiguity → **`id: null` when still unconfident**.
  - **NO silent flagship default** (owner decision). **No-match** renders a deterministic
    *"I didn't understand that — here's what I can help with"* card: suggestions + the list of
    possible use cases, built from the usecase catalog. Pure render, no model.
    **`founders-copilot` IS offered in that list** (owner: "we still want to provide use cases
    founders") though it is never *auto-routed* — reachable via its suggestion / `?usecase=`.
  - **`?usecase=` bypass:** an explicit param SKIPS the router (deep links + founders demo keep
    working). Router fires only when the param is absent.
  - **Telemetry:** one Arize span per route recording `{routed_to, source}` → shows empirically
    whether the model tier ever beats the heuristic; feeds ADR 0003's revisit trigger.
  - New `shared/routerTool.ts` (ToolSpec + zod, mirror `assessTool`) + a `shared/prompt.ts` classify
    prompt pair. `worker.ts` `fetch()` body-read-once refactor; router inserted where `usecase` is
    empty (before `:438`); emit `USECASE_RESOLVED{usecase,title}` before `RUN_STARTED`.
    **Security:** `detectInjection` gate before any model call.
  - **Done-when:** RED observed → GREEN for the router module, the classify planner (mocked
    providers) and the no-match path; integration tests (extend `worker/test/run.test.ts`) assert
    (a) prompt-only POST routes + emits `USECASE_RESOLVED`, (b) `?usecase=` bypasses the router,
    (c) gibberish yields the no-match card; heuristic works with ZERO providers (keyless);
    tsc+eslint+semgrep green. **ADR 0003 + 0004 written.**
- **P3 Single-input UI + wording** (React wiring/copy → e2e is the test). Remove the `switchTo`
  control + the `Or: …` affordance (`App.tsx:166-171,295-309`) — **but KEEP the usecase catalog as
  DATA** (it powers the no-match suggestions + discovery). UI POSTs prompt-only; `active` updates
  from `USECASE_RESOLVED`; **aria-live announces the chosen workflow**. Reword `App.tsx`
  hero/blurb/CTA/`sr-only` h1/footer, `index.html:12,14-35`, README hero (`:3-15,31-43`),
  `docs/UserStory.md` (single-input journeys). Keep `sortmy.london` + the "Sort My X" names as
  RESOLVED-workflow labels. **Done-when:** sweep types several real asks into the single input, each
  routes to the right workflow AND renders its markers; a gibberish ask renders the no-match card
  with the use-case list; no switcher DOM remains; naming consistent across UI/README/UserStory.
- **P4 Hardening + release v1.8.0.** Full docs sync (below), issues, e2e (3 variants × light/dark),
  release ritual. **Done-when:** all gates green; deploy ritual PASS; v1.8.0 tagged+released+deployed.

## ADRs (write with their phase; mirror `docs/adr/0002` format)

- **0003 — No agent framework; single LLM call with structured output.** (P2) Considered Pydantic-AI
  (Python, non-starter in a TS Worker), Vercel AI SDK (edge-ok but assumes `process.env`, adds
  bundle), CF Agents SDK (durable agents, overkill). Decision: bespoke `callModelTool`+`runChain`+zod.
  Revisit trigger: multi-step agent loops or durable agent state — **watch the route-span telemetry.**
- **0004 — Query-driven auto-routing; hybrid heuristic-first; no manual switcher.** (P2) Records the
  resolution point, body-read-once refactor, `?usecase=` bypass, no-match behaviour, register-only
  constraint (interpreter untouched). Known limitation: `sort-my-route` render is canned and remains
  origin-agnostic — the router does not parse origin/destination (pre-existing).
- **0005 — sortmy.london owns its theme; diverges from the vendored qte77 brand default.** (P1)
  `tokens.css` says "re-vendor upstream, don't hand-tune"; we adopt fo Linear + London A/B/C and
  maintain locally. **A future session must NOT "fix" this by re-vendoring EyeRest.**

## Decide-by-defaults (apply silently; owner overrides at any checkpoint)

Ship **all three A/B/C as selectable variants**, default **A Thames Teal** · variant selector =
cycle control + `?variant=` + `localStorage["qte77-variant"]` (mirrors the theme toggle) · router
model escalation reuses the existing keyless free chain — **NO new secret/env** · `founders-copilot`
is offered in the suggestion list but never auto-routed · JetBrains Mono re-added self-hosted ·
release v1.8.0.

## Docs / ADR / issues hygiene (per milestone)

- **CHANGELOG:** one entry per phase → rolled into `[1.8.0]` at P4.
- **README:** hero rewrite (single-input framing, P3); **switches table** — add `?variant=`, keep
  `?usecase=` documented as the bypass/deep-link, remove the manual-switch prose + the
  `swap usecase` ASCII diagram; stack (JetBrains Mono re-added).
- **architecture.md:** auto-router flow + resolution-point/body-read change; theme note.
- **ADR:** 0003, 0004, 0005 (new).
- **UserStory.md:** rewrite to single-input journeys (P3). No roadmap doc exists (issues = roadmap).
- **glossary.md:** auto-routing, intent classifier, variant, no-match.
- **URL/env/CLI:** `?variant=` (new), `?usecase=` (now a bypass), `?theme=`, `?dev=1`, `?demo=1`,
  the `USECASE_RESOLVED` event — documented in README + architecture. **Confirm NO new env/secret.**
- **Issues:** open the 017 tracker (P0). This arc does not close #185/#199/#161/#168/#150/#8; open
  sub-issues only if a phase spawns follow-ups.

## e2e verification contract (polyfetch + patchright chromium — local AND remote)

Vary **viewport + device emulation**; **click buttons, dropdowns and other interactive elements**
(variant cycle, theme toggle, single input + CTA, suggestion chips) to verify functionality **and**
appearance; **screenshots + videos in BOTH horizontal and vertical orientation**; use
**patchright/chromium devtools** — capture **console errors** (FAIL the run on app console errors)
and failed network requests; **axe** gates critical + serious. Extend `flows.json`: single-input
asks per workflow (typed, not switched) with D1-only recency markers, a gibberish→no-match flow, and
a variant × scheme matrix. Local Chromium page-crash (devcontainer memory) ⇒ dispatch
`tier3-monitor.yml` as the authoritative verifier — **never skip verification.**

## Progress report cadence

After each major milestone, concise: what **shipped** · what's **next** · **overall %** ·
**blocked/deferred** (+ what's pre-staged).

## Standing execution contract — e2e hands-off, UNATTENDED

Binds `.claude/rules/unattended-execution.md` + the e2e-runnability checklist in
`docs/handoffs/README.md`: **branch per topic** → strict module-TDD (RED first; modules only) →
gates (`make test` + tsc + eslint worker/shared/ui + ruff + markdownlint) + **security** (gitleaks +
semgrep; `detectInjection` on router input) → push → **squash-merge ONLY on green CI** → `--admin`
(ruleset-gated) → **prune remote + local branches**. Deploy ritual per phase: deploy →
hash-asserting MIME pre-flight (browser headers) → edge-settle → sweep → `runs.jsonl` (honest FAILs
kept). Decide-by-defaults applied silently; never stall waiting on the owner. **Owner gates: NONE**
(the only human touchpoint is the one-per-session `--admin` merge go-ahead).

## Verification

Per PR: `make test` + tsc + eslint + ruff + markdownlint + semgrep + CI green. Per phase: deploy
ritual → sweep PASS (routing markers + 3 variants × light/dark + 0 model-host + axe 0/0 + 0 console
errors). Router proven by REAL typed asks routing correctly live; heuristic proven with providers
disabled (keyless). Tier-3 monitor is the standing guard.
