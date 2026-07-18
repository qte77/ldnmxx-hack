# Changelog

All notable changes are documented here (keep-a-changelog; hand-curated).

## [Unreleased]

Post-hackathon work on `main`, after the v1.0.0 tag.

### Changed
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
