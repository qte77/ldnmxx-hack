# Changelog

All notable changes are documented here (keep-a-changelog; hand-curated).

## [Unreleased]

### Plan 015 — civic usecase expansion + real data

- **e2e: axe-core WCAG 2 A/AA gate, self-hosted + vendored** — the sweep now injects a **vendored**
  `axe-core` (`tests/e2e/vendor/axe.min.js`, MPL-2.0) via `page.evaluate` — past the strict CSP's
  `script-src`, since `add_script_tag` would be blocked — and runs a WCAG 2 A/AA scan on the desktop
  config. GATES on `critical` (keeps the sweep a usable green/red signal) and REPORTS `serious`+ (loud
  console output + `summary.json` + an `axe-desktop.json` artifact). Caught 1 real serious issue on its
  first run — card official-link contrast 4.42 < 4.5 on the light card surface (a11y issue #154; the fix
  is upstream in the vendored brand token, then the gate flips to `serious`). Vendored libs are
  self-hosted (never fetched from an external server, mirroring the app's own no-external-resources CSP)
  and excluded from CI scanners via a new `.semgrepignore`, marked vendored in `.gitattributes`.
- **e2e: `runs.jsonl` cross-session resume manifest** — each sweep run now appends a compact JSON record
  (target, label, verdict, model-host hits, axe counts, broken flows) to a COMMITTED
  `tests/e2e/runs.jsonl`, alongside the existing gitignored per-run `summary.json` — a durable run-history
  log a later session can read instead of re-parsing stdout.
- **Lint: curated `eslint-plugin-unicorn` on worker+ui (S5, #152)** — the last of the five S5
  deepest-strictness knobs; a curated rule subset rather than the full recommended set, to avoid churn
  unrelated to real bugs.
- **Deferred: `eslint-plugin-jsx-a11y` (S5, #150)** — its latest release peers ESLint `^3`–`^9`,
  incompatible with the repo's ESLint 10; forcing it on would need `legacy-peer-deps`, undermining the
  same dependency strictness S5 is adding. Deferred until the plugin supports ESLint 10.
- **Lint: `eslint-plugin-security` on worker+shared (S5, #148)** — `detect-object-injection` off (too
  noisy for this codebase's patterns) plus 2 reviewed `detect-unsafe-regex` exceptions in
  `shared/guard.ts`.
- **Types: `noPropertyAccessFromIndexSignature` (S5, #147)** — both tsconfigs; a 60-site
  bracket-notation fix across worker+ui.
- **Types: `verbatimModuleSyntax` (S5, #146)** — both tsconfigs; the first of the five S5
  deepest-strictness knobs, each shipped as its own PR.
- **Engine: e2e now asserts On It + records both orientations (H7, #144)** — `tests/e2e/flows.json` gives
  On It a `query`/`cta`/`markers` triple like Care/Wander/Scam, so the sweep **types the example prompt and
  asserts the route cards render** instead of clicking the CTA and asserting nothing (the same gap #126
  fixed for Care); video capture now records **both orientations** — desktop (landscape) + mobile-portrait
  — instead of desktop-only.
- **Engine: `RENDER_MODES`/`STAGE_EXECS` single-sourced, unions derived (H6, #143)** — `usecases.ts`'s
  `RENDER_MODES`/`STAGE_EXECS` are now `as const` arrays that are the SINGLE source; the `RenderMode`/
  `StageExec` union types are DERIVED from them (`(typeof ARR)[number]`), and `workflows.ts`'s
  `registry.render` is a total `Record<RenderMode, RenderFn>` — so `tsc`, not just tests, now catches
  drift. Closes ADR-0001's "two sources of truth" Consequences minus.
- **Engine: validate the `asOf` freshness date format (H5, #142)** — new `worker/src/dates.ts`
  (`isIsoDate` + `oldestIsoDate`): the corpus + scam queries now compute "data as of …" as the oldest
  **valid** ISO date across the shown rows, excluding any non-ISO value, so a malformed date can never
  advertise a wrong freshness. A trust-claim fix landed ahead of W4's real ingest.
- **Chain: transient-vs-fatal model-error taxonomy + one bounded retry (H3/H4, #141)** —
  `agent/model.ts`'s `callModelTool` now retries ONCE on a transient HTTP status (`429/500/502/503/504`),
  honoring `Retry-After` (capped 60 s), and fails fast on everything else (401/407 auth, 404/410 gone, 451
  legal) via `describeModelStatus`; a thrown fetch (network error / abort) is never retried. The `… | null`
  fallback contract callers rely on is unchanged.
- **Sort My Scam Check (W2, #140)** — new civic usecase: a clone-firm / FCA-register **flag** (firm name
  or FRN → register status + a deterministic clone look-alike note), signposting to verify on the FCA
  register — never a verdict. A **match** shape, not the geo nearest-N corpus: needed a new `query_scam`
  exec + a new `scam` render mode, living in its own `worker/src/scam/{registry,query,render}.ts` module
  (reuses the geo-agnostic `CorpusRow` + `a2ui/cards.ts`'s `cardsBatch`/`appendDisclaimer`). Synthetic +
  **fictional** firms; curated link = the FCA Financial Services Register; `mode:demo`. 19 scam tests.
- **Fixed: the Care flagship's prefilled postcode had no sample data (#139)** — `E8 3GT` is the Care
  example query, but the sample gazetteer lacked it (an empty state on first load). Added `E8 3GT` + local
  Hackney rows to `data/care/*` and `data/wander/*` samples.
- **Sort My Wander (W3, #138)** — new civic usecase: free heritage sites + green spaces near a London
  postcode. **Register-only** — the nearest-N proof of W1's generic corpus seam:
  `data/wander/*.sample.json` + one `corpus/registry.ts` entry + `usecases/sort-my-wander.json` + a UI
  entry, no engine TS. Curated Historic England "The List" official link. Also introduced the data-driven
  e2e manifest `tests/e2e/flows.json`. Worker+ui tsc/lint/tests green (135+22).
- **Engine: strict usecase schema at load (#133)** — `assertUsecaseDef` now rejects **unknown keys**
  (envelope `{id, title, render, stages}`, stage `{name, kind, events, exec, corpus}`), so a misspelled
  optional field — e.g. `exex` — fails loudly at load instead of being silently dropped (which would
  quietly play canned events instead of running the query). Adopts `azure-doc-workflows`' pydantic
  `extra="forbid"` (their ADR-0012) as a *pattern*, reimplemented in idiomatic TS with no dependency; the
  shared `workflow-definition/v1` schema stays `additionalProperties:true` so cross-engine extras pass.
  134 tests green.
- **Chain: dropped the GitHub Models tier (#127)** — the third keyless free provider
  (`models.github.ai`, `openai/gpt-4o-mini`) **retires 2026-07-30**, after which it would 404 and cost a
  guaranteed-fail round-trip on every keyless run before falling through. Removed `githubModelsProvider`,
  `GITHUB_MODELS_BASE`, `DEFAULT_GITHUB_MODEL`, the `githubToken`/`githubModel` build options, and the
  `GITHUB_MODELS_TOKEN`/`GITHUB_MODEL` env + `.dev.vars.example` entries. The keyless chain is now two
  tiers (Workers AI → OpenRouter :free); BYOK and the deterministic stub are unchanged. 131 tests green.
- **Engine: a corpus usecase is now register-only (W1, #80)** — the per-workflow render mode `care` and
  query exec `fetch_care_services` are replaced by a **generic `corpus` mode + `query_corpus` exec
  parameterised by a corpus id** carried on the stage def. Adding a deterministic corpus workflow
  (Wander #73, Scam #74 next) now needs **no engine TS**: one `worker/src/corpus/registry.ts` entry
  (records + postcodes + curated labels), a `usecases/<id>.json`, and a UI entry —
  `runUsecase`/`renderBatch`/`cardsBatch` stay closed. The query pre-formats each row's display line, so
  the render is shape-agnostic and a future match-shaped workflow reuses it verbatim; the curated
  official link moved out of a hardcoded constant into per-corpus labels. A `query_corpus` stage naming
  an unregistered corpus is now a **startup error** instead of a silently empty batch, and query fns
  return a `Promise` so the W4 D1-backed source is a drop-in with no seam change. Sort My Care is
  migrated to the generic path (same output); the bespoke `worker/src/care/*` is deleted. 132 tests
  green, including an end-to-end proof that a corpus usecase runs from its def alone.

- **`shared/*.ts` now linted (C, plan 015)** — the `shared/` security boundary (`guard.ts`,
  `sanitize.ts`, the tool validators) was the last unlinted TS in the repo: ESLint 10 refuses files
  above a config's own directory, so `worker/eslint.config.js` could never reach `../shared`. Added a
  root `eslint.config.js` that re-uses the worker's strict ruleset (DRY) scoped via `basePath: "shared"`,
  with the parser pinned to the worker tsconfig (which now includes `../shared`); wired into
  `worker`'s `lint` script so CI gates it. Fixed the 6 findings — notably `isValidAssessResult` /
  `isValidSearchResult` cast straight to `Partial<T>`, which told the type-checker the untrusted parsed
  model JSON could never be `null` and made their null-guards look redundant; they now narrow before
  casting (same runtime behaviour, guard preserved). Also `RegExp#exec` in `normalisePostcode` and a
  complexity split of `isSelfContainedBatch`. No behaviour change (119 tests green).
- **Fixed: malformed model output could crash the search validator (C, plan 015)** — `isValidSearchResult`
  threw `TypeError: Cannot read properties of null` on a `matches: [null]` payload instead of returning
  `false`, so an untrusted model response could fault the run rather than fall back to the canned cards.
  Root cause was a *circular* cast: `value as Partial<T>` asserts the very field types the validator
  exists to verify, so the type-checker believed the elements could never be null and no guard was
  written. Both validators now narrow to `Record<string, unknown>` before reading — every property is
  `unknown`, so each `typeof` check does real work — and each `matches` element is object-guarded.
  `shared/` also no longer inherits the worker's ESLint relaxations (`no-non-null-assertion`,
  `no-confusing-void-expression`): the security boundary is now a strict superset (121 tests green).

## [1.1.0] - 2026-07-19

Post-hackathon work on `main` (plans 013 + 014), after the v1.0.0 tag: the browser-BYOK security pivot, the
civic landing + `sortmy.london` rebrand, load performance, and max strictness / security hardening — live.

### Plan 014 — civic landing · performance · max strictness · deploy fixes

- **Civic landing + rebrand (U, #109/#110)** — task-first, progressive-disclosure page; **Sort My Care**
  is the flagship (a London postcode → NHS & care services), **On It** (step-free routes) revealed on
  demand; Founder's Copilot dropped from the civic default (kept at `?usecase=founders-copilot`). Added a
  real 1200×630 `og:image` + `robots.txt` + `sitemap.xml` + a WCAG footer statement, and a tested
  `readUsecase()` flow-router. Mobile-first; verified live via the e2e sweep.
- **Load performance (P, #98/#101)** — immutable `Cache-Control` on `/assets/*`; deduped zod to v3
  (-17.9 KB gz JS); latin-only Inter, dropped JetBrains Mono (-14.5 KB gz CSS); a gzip bundle-size CI guard.
- **Max strictness (S1–S4, #105/#106/#111/#112)** — `engines` / `.nvmrc` / `.npmrc`; pinned + broadened
  Semgrep, `npm audit`, CodeQL `security-extended`, SHA-pinned dependency-review; `Permissions-Policy` +
  HSTS; dependabot `cooldown` + `.npmrc` `min-release-age` supply-chain hardening. Worker ESLint
  (strictTypeChecked — 70 findings fixed, `resolveRun`/`runUsecase`/`assertUsecaseDef` refactored) + the 7
  strict tsconfig flags to `ui` parity — no behaviour change (119 tests green).
- **Deploy/dev CLI fixes (#99/#102/#104)** — `make deploy` now builds + ships the SPA (was worker-only);
  worker `dev`/`deploy` pass `--config wrangler.toml` (wrangler v4 else misreads the root Pages config);
  `provision_cf.sh` tolerates the benign code-10000 worker-route step; deleted the dead `seed` target.
- **Docs (#103)** — `docs/engineering-practices.md` playbook + `AGENT_LEARNINGS.md` ledger.

### Security
- **Removed the entire browser BYOK/model path** (#83, plan 013 · A). The deployed SPA had inlined a real
  OpenRouter key (`VITE_BYOK_API_KEY`, via Vite) and called OpenRouter **directly from the browser** (live
  `401 "User not found"`). Deleted `ui/src/agent/liveAgent.ts` + the `runByokPath`/`useByok` branch; every
  run now streams through the Worker `POST /api/run` (SSE), and a BYOK key rides as an `Authorization`
  header resolved **server-side** (`resolveRun`) — the browser never contacts a model host. The
  `VITE_BYOK_*` env surface and the `@ai-sdk/openai` + `ai` deps are gone; no `VITE_*` var can inline a key
  again. A red-first `runWorkerPath` test + an e2e sweep enforce the invariant across devices.

### Changed
- **Console-gate → civic-clean default** (#85, plan 013 · B). The default UI is now just prompt + Run +
  the A2UI surface; the AG-UI event console and the ⚙ Key panel are hidden behind a **dev mode** (Ctrl+K /
  Ctrl+I or `?dev=1`, persisted in `localStorage["qte77-dev"]`). New pure, tested `ui/src/devmode.ts`. The
  ◫ Catalog and the Live/Demo toggle were **deleted** (civic runs are always Live; the Worker's `?demo=1`
  stays available).
- **Brand theme — vendored, registry-independent** (#86, plan 013 · C, #82). Design tokens moved to a
  single provenance-headed `ui/src/tokens.css` (from `qte77/brand`, `@qte77/ui-theme@0.2.0`) instead of a
  hand-copied `@theme` block — keeping the build free of the `@qte77` private registry (no `.npmrc` / no
  `NODE_AUTH_TOKEN`). Real fonts (`@fontsource/inter` + `jetbrains-mono`) now load (were named but never
  `@font-face`d), and the favicon is recolored to the **zero-blue** EyeRest palette (was GitHub blue).
- **Hosting → full Cloudflare.** The SPA now deploys to **Cloudflare Pages** at `sortmy.london`, and the
  Worker serves **same-origin `/api/*`** via a Worker route (was: GitHub Pages + a cross-origin
  `*.workers.dev` Worker over CORS). Endpoints are now `POST /api/run` / `POST /api/trace`; GitHub Pages
  (`gh-pages.yml`) retired; deploy via `scripts/provision_cf.sh` + `scripts/finish_cf.sh`
  ([`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md)).
- **Adopted the shared `workflow-definition/v1` contract.** Renamed `StageDef.span` → `name` across
  `usecases/*.json` and the Worker (`usecases.ts`, `worker.ts`) so a shipped usecase def is a valid
  `workflow-definition/v1` envelope — the cross-engine core is a non-empty `id` + ordered, non-empty
  `stages[].name`; our `title` / `render` / `kind` / `events` / `exec` stay permitted extras
  (`additionalProperties:true`). Added an ajv contract test validating every `usecases/*.json` against the
  schema vendored from `qte77/protocols@workflow-definition/v1.0.0` (`worker/test/fixtures/contract/`), and
  asserting the TS guard `assertUsecaseDef` rejects each vendored `invalid/*` fixture.

### Fixed
- **`npm ci` unbroken.** Two Dependabot combined-bumps left conflicting peers on `main` (each PR was green
  alone): `typescript` bumped to `~7.0.2` while `typescript-eslint@8.63.0` requires `<6.1.0`, and
  `wrangler@4.110` needed `@cloudflare/workers-types@^5` (pinned `^4`). Pinned `typescript` back to `~6.0.3`
  and aligned `workers-types` to `^5`; lockfiles regenerated.
- **Workers AI free provider now actually runs in the deployed Worker.** `workersAiProvider` invoked the
  `ai.run` binding **detached** from `ai`, so the binding's private-field access (`this.#options`) threw
  (`Cannot set properties of undefined`) and *every* keyless run silently fell back to the stub — since
  #37 the deployed demo had never been model-driven. Bind `ai.run` to `ai`. The live site now streams real
  `assess_stage` / `search_opportunities` reasoning + a model-grounded render (the model even drops
  opportunities that don't fit). Regression test added (a `this`-dependent fake binding).

### Added
- **e2e UI sweep harness** (#84, plan 013 · D). `tests/e2e/ui_sweep.py` (Patchright, headless Chromium)
  drives the SPA across viewport × device × orientation, capturing the DevTools console + network,
  screenshots, an a11y snapshot, and desktop video — and **fails if the browser ever contacts a model
  host**, so it doubles as the item-A regression gate. Plus `tests/e2e/devmode_check.py` for the dev-mode
  gate. Runs via polyfetch's venv; artifacts in `tests/e2e/results/` (gitignored).
- **Civic essentials** (#87, plan 013 · G). WCAG-AA accessibility (an sr-only `<h1>`, a results `<h2>`, a
  labelled query input, `role="alert"` errors, `aria-live` results, focus-visible rings), civic SEO +
  OpenGraph/Twitter metadata, a cookie-free privacy footer (Cloudflare Web Analytics is enabled per-project
  in the CF dashboard — cookieless, no token in code), and friendly failure copy (raw detail only in dev
  mode).
- **Sort My Care + a general workflow engine** (#72). New `worker/src/workflows.ts` registry dispatches
  render by `mode` and deterministic query by `exec`, so adding a **corpus workflow** is register + a JSON —
  `runUsecase`/`renderBatch` never change (open/closed; `founders`/`route`/`care` all register). **Sort My
  Care** is the pilot: a **model-free + fetch-free** postcode → nearest public-health/care-services query
  (`shared/sanitize.ts` UK-postcode boundary — no SSRF; `worker/src/geo.ts` haversine + nearest-N;
  `worker/src/care/*` over a **synthetic** corpus `data/care/*.json`), rendered as A2UI cards with corpus
  **freshness** ("data as of …") + a curated "confirm with the official source" disclaimer (`cards.ts`
  `appendDisclaimer`). Deterministic runs now report `USAGE mode:demo` (not a degraded `stub`). Reachable at
  `?usecase=sort-my-care` (postcode passed as the run prompt); no new env/secret or CLI switch. Real ingest +
  CF D1 (#13) are follow-ups.
- Phase 2 (#18) PR-3 — a **HUD status bar**. The Worker now emits ONE terminal `USAGE` event per run
  (`{ mode, model?, provider?, promptTokens, completionTokens, totalTokens }`, between the render write and
  `RUN_FINISHED`), summed across the live stages + render. The SPA renders an **honest 3-state chip** in the
  events header — `LIVE · <model> · ~N tok` / `DEMO · deterministic` / `STUB · fell back` (never "LIVE" when
  the model path fell back). A **Demo⇄Live toggle** (default Live) finally wires the documented `?demo=1`
  switch from the browser — it was unreachable before (`App.tsx` never forwarded `demo`). Tokens, not `$`
  (the free chain never spends). Pure `toStatus` mapper; `USAGE` intercepted in `useAgentSSE.dispatch` (like
  `RUN_ERROR`).
- Phase 2 (#18) — the founder workflow's early stages are now **model-driven**: `assess_stage` (classify
  the founder's stage + unlock steps) and `search_opportunities` (rank/filter the corpus) run as forced
  tools on the keyless free chain, each streaming its `reasoning` as a live event and emitting its own
  Arize **LLM** span (`model:<exec>`, token usage attached); the ranked matches ground the render. Any
  model miss falls back to the canned stage text (never worse than before). Generalized the provider chain
  (`runChain` + per-provider `tryCall`) so it runs any tool, and stages opt in via `exec` in `usecases/*.json`.
- CI + repo-hygiene parity with `agenthud-agui-a2ui`: **CodeQL** security scanning (`codeql.yaml`), a
  self-contained **Lint MD and Links** workflow (markdownlint, moved out of `ci.yml`'s `docs` job), and
  **Dependabot** (npm for `ui/` + `worker/`, plus github-actions), and the README badge row restyled to
  match (license · version · CI · CodeQL · CodeFactor · Lint · Dependabot). All workflow actions are
  SHA-pinned to satisfy the repo Actions policy (`allowed_actions=selected` + `sha_pinning_required`).
- Phase 2 groundwork (#18): generalized the forced-tool model call into `callModelTool` / `extractToolArgs`
  (runs any tool), with `callRenderModel` now a thin `render_ui` wrapper — no behavior change; added
  dependency-free `shared/assessTool.ts` + `shared/searchTool.ts` (tool schemas + structural validators; the
  search validator rejects invented opportunity ids) as the contracts for the upcoming live `assess_stage` /
  `search_opportunities` stages.
- UI: **Track B (Founder's Copilot) is the default workflow**, with its example prefilled; the workflow
  **no longer auto-runs on page load** — it runs only when the visitor clicks Run.
- Workers AI default model → `@cf/openai/gpt-oss-120b` (live-verified 2026-07-08; `@cf/zai-org/glm-4.7-flash`
  hits capacity `429`). Documented the required Cloudflare API-token permissions (incl. **Workers AI Read**
  for `/ai/run`) + Arize ingestion setup in `worker/README.md`.
- Browser-BYOK founders render now appends the **same** verified incorporate card as the Worker: the
  how-to pack moved to dependency-free `shared/incorporate.ts`, imported by both paths (#37 fast-follow).
- Free chain: the OpenRouter `:free` tier now walks a fallback **list** of 6 verified free + tool-capable
  models (they rate-limit / rotate), first-valid-wins, each miss logged for `wrangler tail`; the winning
  model id rides into the render span. Override via `OPENROUTER_FREE_MODELS` (csv). (#37 fast-follow)
- Two-path model access (#37) — shared dependency-free `shared/` foundation (prompt/tool/validator), a
  prompt-injection guard (flagged prompt → deterministic stub), and a per-IP rate-limit (429) on `/run` (#42).
- Keyless free-fallback render chain: Workers AI → OpenRouter `:free` → GitHub Models → stub, first-valid
  wins with each tier structurally validated; a BYOK header stays the paid path, our key feeds `:free`
  (never a paid call), so the Worker rarely/never spends (#43).
- Real Arize **OTLP** export (OpenInference spans → `otlp.arize.com` when `ARIZE_API_KEY`+`ARIZE_SPACE_ID`
  are set; console otherwise) + a CORS-allowlisted `POST /trace` forwarder for browser spans (closes #21).
- A2UI render-surface theming, EyeRest-branded (port of base PR #168) (#31).
- Externalized both workflows' plan→tool→render choreography to `usecases/*.json`, read at runtime by a
  small `runUsecase` interpreter (`worker/src/usecases.ts`, guarded at load); render modes stay in code.
  "Swap a JSON, swap the app" is now literal for stage choreography (#28).
- Track-B **incorporate how-to-pack card**: a verified, static set of real gov.uk / Companies House
  links (clickable markdown anchors, never LLM-generated), appended to the founders render on both the
  stub and model paths, plus a `tool:incorporate` HUD stage. Not a live filing (#12; the live filing
  stays deferred).
- Style A2UI-surface markdown links (`<a>`) as links (primary colour + underline) so the incorporate
  card's verified links read as clickable (they were already anchors; this is the visible affordance).

## [1.0.0] - 2026-07-04

Final **Londonmaxxing 003** hackathon build — the state at the end of the hack day (commit `01d2c95`).

### Added
- Repo scaffold + docs (architecture, user stories, use-case workflows, build plan, submission).
- Phase 1 first E2E: SPA → `POST /run?usecase=<id>` (SSE) → built-in A2UI cards; `useAgentSSE`
  transport; `runStages` per usecase (`founders-copilot` + thin `on-it`); console Arize span
  per stage; optional in-dashboard BYOK; `ui`/`worker` CI jobs + GitHub Pages deploy workflow.
- Real OpenRouter call for Track B's `search_opportunities` render, with a deterministic stub
  fallback on any failure (#19).
- Theme toggle + `?demo=1` keyless auto-run (#20).
- Raised model `max_tokens` so the `render_ui` batch isn't truncated (#22).
- Live A2UI component catalog + Track-A default on load + 100% worker observability (#24).
- Usecase toggle now swaps the example input query to match the selected track (#25).
