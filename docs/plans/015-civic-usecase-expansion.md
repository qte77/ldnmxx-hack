---
title: "Plan 015 — civic usecase expansion + real data (fast-follow to 014)"
type: plan
updated: 2026-07-19
status: "proposed — not started"
refs: ["#113 (015 tracker)", "#80 query-stage/manifest", "#74 Scam", "#73 Wander", "#13 real Care corpus", "#10 ingest cron", "014 plan/handoff (predecessor, shipped+live)"]
---

# Plan 015 — civic usecase expansion + real data

> Predecessor **014 is shipped + live** on `sortmy.london` (task-first civic landing, perf, strictness,
> security, docs). 015 **broadens the civic usecases** and moves the flagship **from synthetic to real
> data**. Read `docs/plans/014-*` for the Source Map + `docs/engineering-practices.md` for the how/why.

## Context

The engine is *swap a JSON, swap the app*: a usecase is a `usecases/<id>.json` stage-def read at runtime by
`runUsecase`, dispatched by a render `mode` + optional query `exec` in `worker/src/workflows.ts` (the
registry). Adding a **deterministic corpus workflow** today = register a render mode, a query exec, a JSON,
and a corpus. 015 generalises that seam and adds real civic content on top of it. Strategy stays **"signpost,
not adjudicator"**: every workflow shows freshness ("data as of"), a curated official-source link, and an
honest deterministic-mode HUD (`USAGE mode:demo`) — never advice, triage, or a verdict.

## Progress — queue

| # | Workstream | Status |
|---|---|---|
| W1 | Engine: general query stage + workflow manifest (#80) — make a new corpus usecase register-only | ☑ shipped (#125) |
| W2 | Sort My Scam Check (#74) — clone-firm fraud **flag** (Companies House / FCA), never a verdict | ☑ shipped (#140) |
| W3 | Sort My Wander (#73) — free/obscure heritage discovery (Historic England / OSM / Wikidata) | ☑ shipped (#138) |
| W4 | Real Care corpus (#13) — replace synthetic `data/care/*` with an ingested NHS directory + freshness | ☐ to ship |
| W5 | Ingest cron (#10) — scheduled re-seed (CF Cron Trigger); pairs with the e2e Tier-3 monitor | ☐ to ship |
| W6 | Data store (#13) — CF **D1** as the FOUNDATION for W4/W5 (no longer "only if forced") | ☐ to ship |
| C | **014 carry-over** (small; do first / in parallel) — see below | 🟡 shared-lint + tag done; S5/axe/runs.jsonl open |
| H | **Engine hardening & cross-stack alignment** (a distinct theme, folded in — see below) | ☑ shipped (5/5) |

## Workstream H — engine hardening & cross-stack alignment

A distinct theme from the civic W-stream (which broadens usecases + real data): H hardens the *engine
itself* and aligns it with the sibling `qte77/azure-doc-workflows` (Python) — **patterns, never code; the
shared `workflow-definition/v1` contract is the only shared artifact.** Folded into 015 (not a separate
plan) while 015 is open. Independent small PRs, each its own issue.

| H | Item | Status |
|---|---|---|
| H1 | Drop the GitHub Models free tier (#127) — retired 2026-07-30 | ☑ shipped (#132) |
| H2 | Strict usecase schema — reject unknown keys at load (#133), adopt azure `extra="forbid"` | ☑ shipped (#136) |
| H3 | Transient-vs-fatal model-error taxonomy (#134) — align azure `core/errors`; **reuse `polyfetch-scrape`'s typed taxonomy** | ☑ shipped (#141) |
| H4 | One bounded retry on transient errors (#135) — align azure `core/providers` + `polyfetch retry.py`; lands in `callModelTool` (covers keyed + free), transient set `{429,500,502,503,504}` | ☑ shipped (#141) |
| H5 | Validate the `asOf` date format (#128) — a trust claim; fix **before W4** ingest exists | ☑ shipped (#142) |
| H6 | Derive `RENDER_MODES`/`STAGE_EXECS` from registry keys (#129) — closes ADR-0001's known "two sources of truth" minus | ☑ shipped (#143) |
| H7 | e2e: assert On It + record video in both orientations (#130) | ☑ shipped (#144) |

**Estate alignment (cross-repo; the "share the contract" half):** `qte77/qte77#162` (hub tracker,
updated), `qte77/azure-doc-workflows#288` (reciprocal: commit their contract test + back-ref adopted
patterns), `qte77/protocols#2` (evolve the contract: standardize/mark deferred fields; document
local-strict consumers). These are the sibling repos' work — informational here.

**H3/H4 design (pre-scoped from `qte77/polyfetch-scrape` `errors.py`/`retry.py` — reuse this, don't
re-derive):** one PR closing both. Land the retry in **`worker/src/agent/model.ts` `callModelTool`**
(not just `openRouterFreeProvider`) — that's where the HTTP status lives, and it covers the BYOK keyed
path (`callRenderModel`) too. Keep `callModelTool`'s `… | null` return contract unchanged (callers rely
on null = fallback); add the retry INTERNALLY.

- **Transient set (retry):** `{429, 500, 502, 503, 504}`. **Fatal (fail fast, one concise warn):**
  everything else — notably 401/407 (auth), 404/410 (gone), 451 (legal).
- **Policy:** `maxAttempts = 2` (one retry — the Worker render has a 20 s abort budget + the free tier
  walks ≤6 models, so keep it small), backoff `≈ 0.25 s · 2^attempt`, honor a `Retry-After` header capped
  at 60 s. Retry ONLY on transient HTTP status; the `catch` (network throw / AbortSignal timeout) returns
  null with NO retry (must not retry an abort). Respect `opts.signal` between attempts.
- **H3 taxonomy:** a `describeModelStatus(status) → label` helper ("auth"/"gone"/"legal"/"rate-limited"/
  "server"/"http") replacing the generic `console.warn("model fallback: HTTP", status)`.
- **Testable:** add an optional `retryBackoffMs` to the `ModelCall` opts (default ≈250; tests pass 0) so
  the suite doesn't sleep. Test-first in `model.test.ts`: transient status retries-then-succeeds; fatal
  status fails fast (no retry); abort is not retried. Existing mocks return `{ok:false}` with no `status`
  → not transient → no retry, so they stay green.

## Source Map — W1 delta (the map below predates #125; apply these renames)

`worker/src/care/*` was **deleted** and replaced by `worker/src/corpus/*`:
`registry.ts` (corpus id → records/postcodes/labels + `corpusIds`), `query.ts` (`queryCorpus` async +
`queryCorpusDef`), `render.ts` (`buildCorpusCards`), `contract.ts` (`CorpusRecord`/`CorpusRow`/
`CorpusLabels`/`CorpusQuery` — **frozen**; W4 ingest + the D1 view project onto it). Unions in
`usecases.ts`: `RenderMode = founders|route|corpus`, `StageExec = …|query_corpus` (drop `care`/
`fetch_care_services`); `StageDef.corpus?`; `assertUsecaseDef` now rejects unknown keys (#133) + validates
the corpus id. `workflows.ts` registry: `render.corpus` + `query.query_corpus`; `QueryFn` returns a
`Promise`. `a2ui/cards.ts` `appendDisclaimer(batch, link)` (link now per-corpus). Free chain in
`agent/providers.ts` is two tiers now (Workers AI → OpenRouter :free; GitHub Models dropped, #127).

## Workstreams

- **W1 · Engine generalisation (#80) — do first; unblocks W2/W3.** Today the render `mode`s (`founders`/
  `route`/`care`) and query `exec`s (`fetch_care_services`) are hardcoded in `workflows.ts`. Generalise so a
  new **deterministic corpus** usecase is *register + JSON + corpus* with no bespoke worker code: a generic
  `query` stage that takes a postcode/query + a corpus id and returns nearest-N/matched records, and a
  generic card renderer (title + lines + official link + disclaimer, already in `a2ui/cards.ts`). Keep
  `runUsecase`/`renderBatch` closed (open/closed). Module → **test-first**.
- **W2 · Sort My Scam Check (#74).** A clone-firm / fraud **flag** over Companies House + FCA warning data:
  given a firm name/number, surface registration facts + FCA-register status + "does this match a cloned
  firm pattern?" as a **flag to investigate**, never a verdict. Wayfinder + a mandatory "verify on the FCA
  register" link. ToU-check the sources.
- **W3 · Sort My Wander (#73).** Free/obscure heritage + green-space discovery near a postcode (Historic
  England NHLE, OSM Overpass, Wikidata). Direct mode; the value is curation, not advice.
- **W4 · Real Care corpus (#13).** Replace the synthetic `data/care/*.json` with an **ingested** NHS service
  directory (`ingest/` Python → normalised corpus), keeping the deterministic nearest-N signpost + a real
  `lastUpdated` freshness stamp. **Scraped/real data is ToU-gated → `data/real/` gitignored; only synthetic
  `data/demo|care/*` committed.**
- **W5 · Ingest cron (#10).** A **CF Cron Trigger** (scheduled Worker) re-seeds the corpus on a cadence and
  records freshness. This is the natural home for a **Tier-3 e2e uptime monitor** too (run the sweep against
  the live URL on a schedule, write the verdict to KV / a status badge, alert on FAIL).
- **W6 · Data store (#13) — DECIDED: D1 is the foundation, not a contingency.** The chosen model is
  **read-through-a-store**: the request path reads an in-house **CF D1** ONLY; sources are fetched
  **out-of-band** on a cron + an explicit trigger. This is *more* aligned with the locked invariants than
  live-per-request fetch — the hot path stays **fetch-free** (no SSRF/ToU/rate-limit online), **secrets stay
  off the hot path** (only the ingester holds source keys), `asOf` becomes a real ingest timestamp, and
  ToU-gated raw data lives server-side (never in git or the bundle). Use `wrangler d1 migrations` for
  versioned schema and **one SQL view per corpus** (`care_signposts`, `wander_places`, …) projecting onto
  the frozen `CorpusRecord` — **the view is the corpus contract in SQL**, so ingest-schema churn updates the
  view, not the query code. W1 already returns `Promise` from query fns, so a `D1CorpusSource` is a drop-in;
  the `CorpusSource` interface gets designed here, when a real second implementation exists (AHA).
  **Ordering consequence:** W6 precedes or merges with W5 — a cron cannot write into a build-time static
  JSON import, so the store must exist first.

## C — 014 carry-over (small; independent of the above)

- **S5 · deepest strictness (plan 014):** `verbatimModuleSyntax` · `noPropertyAccessFromIndexSignature` (both
  tsconfigs) · `eslint-plugin-jsx-a11y` (ui) · `eslint-plugin-security` (worker) · `eslint-plugin-unicorn`
  (curated, both). **Each knob its own PR; expect a fix wave** like S3/S4.
- **`shared/*.ts` lint** — ☑ shipped (#123 + #124, issue #122). NOT the quick win assumed: ESLint 10
  refuses files above its config dir, so it needed a root `eslint.config.js` (`basePath: "shared"` +
  pinned worker tsconfig project), chained into worker's `lint`. Fixing the findings surfaced a real
  bug — `isValidSearchResult` threw on `matches: [null]` — caused by a circular `as Partial<T>` cast.
  See `AGENT_LEARNINGS.md`.
- **Release** — v1.1.0 **shipped** (#120) and the **tag is pushed** — annotated `v1.1.0` on the release
  commit `8286890`, deliberately NOT `main` (which carries unreleased C/W1 work).
- **axe-core in the e2e sweep** — inject axe for a concrete WCAG pass/fail (today: aria snapshot only).
- **e2e Tier-2 handoff** — a committed `tests/e2e/runs.jsonl` manifest so an in-flight/long sweep resumes
  across sessions (summary.json already lands per run; #116).

## Order · conventions · verification

- **Order (revised):** ~~C~~ ☑ → ~~W1~~ ☑ → ~~W3 Wander~~ ☑ (#138) → ~~W2 Scam~~ ☑ (#140) → **W6/D1 foundation + W4/W5**. Two
  changes from the original: **W3 before W2** (Wander is nearest-N and therefore genuinely register-only,
  so it proves W1 with zero engine TS; Scam is a *match* shape needing one new `query_scam` exec), and
  **W6/D1 is no longer "only if forced"** — the decided data architecture makes it the foundation W4/W5
  build on (see below). Each usecase adds its e2e sweep label + screenshots.
- **Review backlog — now all shipped:** #127 GitHub Models tier retired (#132) · #128 `asOf` freshness
  date format validated (#142) · #129 `RENDER_MODES`/`STAGE_EXECS` derived from registry keys, closing ADR
  0001's known minus (#143) · #130 e2e asserts On It and records video in both orientations (#144).
- **Conventions (hard, unchanged from 014):** branch-per-topic → Conventional Commits → CI-gated PR →
  squash-merge `--admin` **only on green** → **prune**. `env -u GH_TOKEN -u GITHUB_TOKEN` · noreply ·
  `--no-gpg-sign` (rebase: `-c commit.gpgsign=false`) · SHA-pin Actions · **strict module-TDD** (tests first
  for load-bearing modules only) · assume strict lint+typing+sec · worker stays on **TS 6** (eslint compat).
- **Verify per usecase:** `make test` + `tsc` + `eslint` (ui+worker) + markdownlint + the e2e sweep clean
  (0 model-host, a11y heading/button, `summary.json` PASS); "signpost not advice" disclaimer + freshness
  present; deterministic honesty (`USAGE mode:demo`). Real data ToU-gated + gitignored.

## Source Map (jump straight in — do NOT re-explore)

Line numbers current as of 2026-07-19 (worker refactored in 014·S3/S4). The **W1 "register-only" target**
is `worker/src/workflows.ts` — generalise it so a new corpus usecase needs no bespoke TS.

**Engine / dispatch (`worker/src/`)**

- `workflows.ts` (**KEY, 35 LOC**) — the whole registry: `registry.render: Record<RenderMode, RenderFn>` +
  `registry.query: Partial<Record<StageExec, QueryFn>>` (`:23-35`). `render.founders`→opportunity cards
  (model-backed), `render.route`→`buildRouteCards()`, `render.care`→`buildCareCards(data as CareQuery)`;
  `query.fetch_care_services`→`queryCareServices(prompt)`. Adding a corpus usecase **today** = extend the
  `RenderMode`/`StageExec` unions + add a `render.<mode>`/`query.<exec>` here. **W1** = make this
  manifest-driven (one generic query + one generic render), so it is register-only.
- `worker.ts` — `runUsecase` (`:365`, the data-driven interpreter: loop `def.stages`→`playStage`→
  `renderBatch`), `playStage` (`:326`, dispatch deterministic-query vs model-exec vs canned), `renderBatch`
  (`:66`), `resolveRun` (`:197`, injection-guard + `ModelCtx`), `runStageModel` (`:254`), `fetch` handler
  (`:404`; `/api/run`|`/api/trace` allowlist + rate-limit). `interface Env` (`:20-36`).
- `usecases.ts` — `type RenderMode` (`:26`) + `type StageExec`/`STAGE_EXECS` (`:17-18`): **extend both for a
  new mode/exec**; `UsecaseDef`/`StageDef` (`:20-35`); `assertUsecaseDef` load-guard (`:76-94`); `registry`
  (`:101-105`, add the `usecases/<id>.json` import + entry); `getUsecase` (`:109`).
- `a2ui/cards.ts` — `cardsBatch(CardSpec[])` (`:67`, generic builder), `appendDisclaimer` (`:121`,
  "signpost not advice" caveat), `buildRouteCards`/`buildOpportunityCards`; `CardSpec` (`:33`).

**Care flow (flagship; W4 makes it real)** — `care/careServices.ts` `queryCareServices` (`:28-51`); imports
the **synthetic** corpus at **`:4-5`** (`data/care/services.sample.json` + `postcodes.sample.json`) — **W4
replaces those two imports** with ingested data. `care/contract.ts` `CareService`/`CareQuery` (`:9-25`);
`care/render.ts` `buildCareCards` (`:7-33`, freshness `asOf` + disclaimer). `geo.ts` `nearestN`/`haversineKm`
(`:13-35`).

**Model chain** — `agent/providers.ts` `buildProviders` (`:154`, free chain Workers-AI → OpenRouter `:free`
→ GitHub Models), `runChain` (`:134`); `agent/model.ts` `callModelTool`/`callRenderModel` (`:73`/`:124`),
`ORResponse` (`:32`).

**Shared (security boundary)** — `shared/sanitize.ts` `normalisePostcode` (`:13-20`, the ONLY user string
reaching a query — no external fetch, no SSRF); `shared/guard.ts` `detectInjection` (`:33`, ReDoS-safe
patterns); `assessTool.ts`/`searchTool.ts` (forced-tool schemas + validators), `prompt.ts`, `incorporate.ts`,
`renderTool.ts` `isSelfContainedBatch` (`:22`, the render-safety invariant). **S5: these are still UNLINTED**
(worker eslint `files` glob is `worker/**` only).

**UI (`ui/src/`)** — `App.tsx` `USECASES` array (`:11-45`: `sort-my-care` flagship, `on-it`,
`founders-copilot` civic:false demo) — **add a new civic usecase entry here**; `FLAGSHIP_ID` (`:48`).
`usecase.ts` `readUsecase` (`:4`, `?usecase=` router). `agent/useAgentSSE.ts` `runWorkerPath` (`:114`, the
ONLY transport → `POST /api/run` SSE; the browser never calls a model host).

**Data** — `usecases/{founders-copilot,on-it,sort-my-care}.json` (stage defs). `data/care/{services,
postcodes}.sample.json` (**synthetic; W4 target**). `data/sources.json` (~60 vetted sources — e.g.
`nhs-service-directory`, `historic-england`, `companies-house`/`fca-register`, `osm-overpass` for W2/W3/W4;
`gaps[]` documents holes). `data/usecase-catalog.json` (backlog/idea layer). **`ingest/` has NO code yet —
only `ingest/README.md`** (planned `seed.py`: polite scrape → JSON → KV): the **W4/W5 empty starting point**.

**Config / S5 + W5 targets**

- `worker/tsconfig.json` + `ui/tsconfig.app.json` — full strict set already; **S5 adds** `verbatimModuleSyntax`
  and `noPropertyAccessFromIndexSignature`.
- `worker/eslint.config.js` (strictTypeChecked + sonarjs, node) — **S5 adds `eslint-plugin-security`** + a
  `shared/*.ts` glob; `ui/eslint.config.js` — **S5 adds `eslint-plugin-jsx-a11y`**; both **+ `unicorn`**.
- `worker/wrangler.toml` — routes `sortmy.london/api/*`, `[ai]`, `[[ratelimits]]` 20/60; **no `[triggers]`
  yet → W5 adds `[triggers] crons=[…]` + a `scheduled()` handler in `worker.ts`**.
- `.github/workflows/ci.yml` — jobs security / ui / worker / dependency-review (SHA-pinned; worker has no
  build step). `tests/e2e/ui_sweep.py` — `CONFIGS` 5 viewports (`:35`), `sweep()` clicks the civic labels
  (`:60`), `write_summary`→`summary.json` (`:191`). `Makefile` — `dev`/`test`/`deploy`(→`provision_cf.sh`)/`bump`.

**Add-a-usecase recipe** (deterministic corpus): ① `usecases/<id>.json` (stage def: a `plan` + a `query`-exec
stage). ② extend `RenderMode`/`StageExec` (usecases.ts) + register `render.<mode>`/`query.<exec>`
(workflows.ts). ③ corpus in `data/<id>/*.json` + a `queryXServices`-style fn. ④ `ui/src/App.tsx` `USECASES`
entry (civic → surfaces; demo → `?usecase=` only). ⑤ e2e sweep label + `make test` + `tsc`/`eslint` green +
a Pages redeploy (user runs). Keep `runUsecase`/`renderBatch`/`cardsBatch` CLOSED (open/closed).
