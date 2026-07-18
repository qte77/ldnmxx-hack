---
title: "Plan 012 — full-CF deploy (shipping) + Sort My Care on a general engine"
type: plan
updated: 2026-07-17
status: "Effort 1 in PR #75 (green, user-gated); Effort 2 not started"
refs: ["#75 (deploy PR)", "#72 Care", "#73 Wander", "#74 Scam", "#69 roadmap", "qte77/protocols workflow-definition/v1"]
---

# Plan 012 — full-CF deploy + Sort My Care

> Two independent efforts, ship **(1) first**. **(1)** move hosting to full Cloudflare (SPA→Pages, Worker
> same-origin `/api` on `sortmy.london`). **(2)** build **Sort My Care** — the pilot that also lands the
> general engine foundation (workflow registry + `workflow-definition/v1` align + ADR). This plan carries a
> **Source map** so the next session doesn't re-explore. Data = **our pre-generated JSON corpora → CF D1
> later; NO live external fetch.** Engine is **general** (not a "wayfinder"); each workflow owns its contract.

## Effort 1 — full-CF deploy (DONE in PR #75, green; user-gated)

All coded, tested, documented on branch `feat/cf-pages-deploy`. Changes: worker `/run`,`/trace`→`/api/run`,
`/api/trace` (`worker/src/worker.ts` routing) + `routes = [{pattern="sortmy.london/api/*", zone_name=...}]`
- CORS→`sortmy.london` (`worker/wrangler.toml`); SPA `WORKER_BASE=""` (`ui/src/config.ts`), `/api/*`
(`ui/src/agent/useAgentSSE.ts`), `base:"/"` + dev proxy `/api` (`ui/vite.config.ts`); new `wrangler.jsonc`
(Pages, `pages_build_output_dir: ui/dist`), `ui/public/_redirects`+`_headers`, `scripts/provision_cf.sh`+
`finish_cf.sh` (adapted from `/workspaces/sfsanity/sfclarity/scripts/*`), `docs/deploy-cloudflare.md`;
retired `.github/workflows/gh-pages.yml`. **User to finish:** add `sortmy.london` zone to CF +
`CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID`, run the 2 scripts, verify, then **merge #75 with the deploy** (merging
alone retires gh-pages before CF is live). CI stays lint/test only.

## Effort 2 — Sort My Care (NOT started)

**Order:** (2a) `span`→`name` v1-align PR · (2b) engine registry + care module (this pilot) · then #73/#74.

### 2a. workflow-definition/v1 alignment (own small PR first)
Re-apply the **preserved tag** `wip/workflow-definition-contract` (commit `69bb925`): `git show
wip/workflow-definition-contract` is the exact diff — `StageDef.span`→`name` in `worker/src/usecases.ts`,
`stage.span`→`stage.name` at `worker/src/worker.ts:~315`, `"span"`→`"name"` in `usecases/*.json`, plus an
**ajv contract test** (`worker/test/usecases.contract.test.ts`) validating `usecases/*.json` against the
**vendored** schema (`bash /workspaces/qte77/protocols/scripts/sync.sh` → `worker/test/fixtures/contract/`),
and `ajv`+`ajv-formats` in `worker/package.json`. Contract = `qte77/protocols`, schema at
`schemas/workflow-definition/v1/workflow-definition.schema.json`; **only `id` + `stages[].name` are
mandatory**, `additionalProperties:true` allows our `title`/`render.mode`/`kind`/`events`/`exec` extras.

### 2b. General engine foundation + Care (open/closed via a registry)
- **`worker/src/workflows.ts` (new) — registry** `{ render: Record<mode, RenderFn>, query: Record<exec, QueryFn> }`.
  `founders`/`route` register too (regression-covered by `run.test.ts`). Adding a workflow never edits `runUsecase`.
  (Distinct from the **idea catalog** `data/usecase-catalog.json`.)
- **Care modules (own dir, own contract):** `worker/src/care/contract.ts` (`CareService {id,name,why,officialUrl,
  authority,distanceKm,lastUpdated}`), `careServices.ts` (deterministic query: postcode→nearest-N over the
  bundled corpus; empty/invalid fallback), `render.ts` (`buildCareCards` → `cardsBatch`).
- **General primitives:** `shared/sanitize.ts` (UK-postcode validate/normalise — the security boundary, no
  SSRF since no external fetch), `worker/src/geo.ts` (haversine + nearest-N, pure), `worker/src/a2ui/cards.ts`
  new `appendDisclaimer` (mirror `appendIncorporate`).
- **Corpus:** hand-authored synthetic `data/care/services.sample.json` (+ small postcode→coords sample);
  real ingest (`ingest/`, unbuilt) + CF D1 (#13, cron #10) are follow-ups.
- **usecase:** `usecases/sort-my-care.json` (`render.mode:"care"`, a `plan` stage + a `tool` stage
  `exec:"fetch_care_services"` — deterministic query, no model).
- **Care is model-free + fetch-free.** HUD: corpus workflows report deterministic + `lastUpdated` → chip
  `DATA · as of <date>` (extend USAGE mode at `worker/src/worker.ts` USAGE block).
- **Arize observability (kept):** each stage still emits a `⌁ span` via the injectable emitter (`makeEmitter`),
  like model workflows — so the query stage + render get spans (run/plan/query/render). Arize live export is
  Phase-2 PR-4 (blocked account-side #50); console spans work meanwhile.

### Engine edits (worker/src/worker.ts, usecases.ts)
- `usecases.ts`: `RenderMode` += `"care"`; guard validates mode/exec against **registry keys**; register `sort-my-care`.
- `worker.ts`: stage-loop gate — fetch/query execs run **regardless of `ctx.providers.length`** (deterministic);
  add `runStageFetch` (dispatch `registry.query[exec]` over bundled data, thread result to render, parallel to
  `runStageModel`); `renderBatch` dispatch via `registry.render[mode]`; USAGE mode extended.

### Strict module-TDD (tests first; NOT glue)
`shared/sanitize.ts`, `worker/src/geo.ts`, `worker/src/care/careServices.ts`, `care/render.ts` +
`appendDisclaimer`; integration in `worker/test/run.test.ts` (`/api/run?usecase=sort-my-care` → care batch +
deterministic USAGE; bad postcode → graceful). Node env, no jsdom.

## Source map (jump straight in — line numbers are `main` @ bb597ba)

**Engine — `worker/src/worker.ts`**
- `Env` interface `:19-35` (add `POSTCODES_BASE_URL`/`NHS_*` ONLY if we ever go live-fetch — NOT for Care).
- `RenderMeta` `:58-62`; **`renderBatch` `:64-100`** — render dispatch: `if (render.mode === "route")` `:70`,
  founders path `:71-96`, `meta` null for canned. Add the `care` branch here (via the registry).
- `corsHeaders` `:102-115`; `modelLabel` `:137-141`; `readSpans` `:144-154`.
- `resolveRun` `:159-204`; **stage loop** in `runUsecase` `~:293-316` (gate `if (stage.exec && ctx.providers.length>0)`
  `~:296`); **`runStageModel` `~:228-254`** (exec dispatch: `assess_stage` `~:229`, `search_opportunities` `~:241`) —
  mirror for `runStageFetch`; **`groundOpps` `~:209-217`** (grounding pattern); **terminal USAGE `~:325-331`**
  (mode decision `~:325`) → RUN_FINISHED `~:332`; **routing `~:341`** (`isRun`/`isTrace`; now `/api/*` on #75).

**Stage-def — `worker/src/usecases.ts`**: `AgentEvent` `:7-11`, `StageExec`+`STAGE_EXECS` `:14-15`, `StageDef`
`:17-22` (`span`→`name` in 2a), `RenderMode` `:23`, `UsecaseDef` `:27-32`, `RENDER_MODES` `:34`, guard
`assertUsecaseDef` `:38-57`, `registry` `:64-67`, `getUsecase` `:71-73`. Usecases are **trusted build-time JSON**.

**Cards — `worker/src/a2ui/cards.ts`**: `CardSpec` `:33-37`, `cardComponents` `:46-65`, **`cardsBatch` `:67-87`**
(self-contained batch: `beginRendering` + `surfaceUpdate`, all ids defined, `literalString`), `buildOpportunityCards`
`:90`, `buildRouteCards` `:109`, `withIncorporate` `:129`. Build `buildCareCards` here reusing `cardsBatch`.

**Shared (`shared/`)**: `incorporate.ts` `appendIncorporate(batch)` `:41-54` + `INCORPORATE_LINES` `:8-15` —
the **verified-links + append** precedent for `appendDisclaimer`; `searchTool.ts` `isValidSearchResult(value,
allowedIds)` `:49-65` — reject-invented-ids validator pattern; `renderTool.ts` `isSelfContainedBatch` `:22-51`;
`prompt.ts` `A2UI_RULES` `:7-14`; `guard.ts` `detectInjection` `:33-38`.

**Tests — `worker/test/`** (node, no jsdom; no `vitest.config`): `run.test.ts` — `post()` `:30-36`,
`parseFrames` `:38-43`, `assertSelfContained` `:47-67`, `stageAwareAi()` `:102-112` (fake `env.AI` branching on
`tool_choice.function.name`), span assertion `~:142-148`, USAGE-frame assertions. `cards.test.ts` — card-builder
- `VERIFIED_URLS` invariant. `model.test.ts` — unit via `vi.stubGlobal("fetch",…)`. Runner `worker/src/worker.ts`
`runUsecase` `~:281-333`.

**Deploy (Effort 1, on `feat/cf-pages-deploy`)**: `worker/src/worker.ts` routing `~:341`; `worker/wrangler.toml`
`routes`+CORS; `ui/src/config.ts` WORKER_BASE; `ui/src/agent/useAgentSSE.ts` `:93` (/trace) + `:153` (/run);
`ui/vite.config.ts` base+proxy; `wrangler.jsonc`; `ui/public/_redirects`+`_headers`; `scripts/*.sh`;
`docs/deploy-cloudflare.md`.

**Family / reuse**: contract SSOT `/workspaces/qte77/protocols` (`workflow-definition/v1`); Python peer
`/workspaces/qte77/claude-azure-workflows-gui` (`src/doc_workflows/core/runner.py` looks up stages **by name**);
render base `/workspaces/qte77/agenthud-agui-a2ui` (no workflow contract — render only); deploy scripts base
`/workspaces/sfsanity/sfclarity/scripts/*`. **No shared TS types package** — vendor the schema, ajv-validate.

## Docs/ADR/issues on ship
ADR `docs/adr/0001-general-workflow-engine.md` (open/closed registry · per-workflow contracts · pre-generated
corpora→D1, not live fetch · "wayfinder"=pattern · corpus-freshness honesty). `docs/UserStory.md` (drop Track
A/B, add Care story). `docs/architecture.md` (registry + query stage). `docs/usecase-workflows.md` (query-stage
kind + "how to add a workflow"). `worker/README.md` (corpus). CHANGELOG. `data/usecase-catalog.json`
(`sort-my-care`→building). Open issue **"engine: general query stage + workflow manifest"** (#72/#73/#74 depend
on it). **Housekeeping:** drop "Track A/B" (`grep -rin "track[ -][ab]"` excl. node_modules + sibling `ldnmxx/`):
comments in `cards.ts`/`ui/src/App.tsx`; docs README/usecase-workflows/architecture/submission/demo-script/
UserStory/design/plans-001/CHANGELOG.

## Conventions (hard)
Plan-mode before code · strict module-TDD (not glue/scripts) · KISS/DRY/YAGNI/AHA · SOC + per-workflow
contracts · general engine · align to `qte77/protocols` · branch-per-topic · Conventional Commits · CI-gated
PR · `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · GitHub noreply + `--no-gpg-sign` · Actions policy
`allowed_actions=selected`+`sha_pinning_required` (SHA-pin every action) · agent can't self-merge (branch
protection; `--admin` only when the user says so; auto-merge disabled).

## Verification
`make test` · `tsc --noEmit` · lint + CodeQL green. `make dev`: `?usecase=sort-my-care` + postcode → nearest
NHS from the sample corpus + disclaimer + freshness; bad postcode → graceful. Then `/verify` the deployed endpoint.
