---
title: "Handoff 015 — v1.2.0 LIVE+verified · D1 provisioned (empty, fail-safe) · W5·B1 monitor live; ALL remaining work blocked on #161 (TRUD, user-deferred)"
type: handoff
updated: 2026-07-22
pairs_with: docs/plans/015-civic-usecase-expansion.md
---

# Handoff 015 — resume point

**Read [`docs/plans/015-civic-usecase-expansion.md`](../plans/015-civic-usecase-expansion.md) FIRST** — it
carries a full **Source Map** (file:line for the engine registry, care flow, UI, shared, data, config) + an
**add-a-usecase recipe**, so do NOT re-map or re-gather context.
Predecessor **014 is shipped + live** on `sortmy.london` — see `docs/handoffs/014-*` (its Source Map, still
the canonical file:line map) and `docs/engineering-practices.md`. 015 broadens the civic usecases and moves
the flagship from synthetic → real data. Tracker: **#113**.

## The one-line why

014 built the civic *product* (task-first landing, Care flagship, perf, strictness, security) — all live.
015 makes it *broader and real*: generalise the engine so a new corpus usecase is register-only
(**W1**, #80); add **Sort My Scam Check** (#74) and **Sort My Wander** (#73); and replace the synthetic
Care corpus with a real ingested NHS directory plus a scheduled re-seed (**W4/W5**, #13/#10). Plus a small **014 carry-over**
(S5 strictness, shared lint, axe-core, e2e Tier-2 manifest; **v1.1.0 shipped** #120 and the
`v1.1.0` tag is now pushed — it points at the release commit `8286890`, NOT `main`, which carries
unreleased work).

## Progress (2026-07-22 · session close — deployed, D1 live, monitor live)

- ☑ **v1.2.0 DEPLOYED + verified** — `make deploy` (Pages + Worker), then the sweep: **PASS**, 0
  model-host, **axe 0 critical / 0 serious** (first live pass of the `serious` gate incl. #154),
  flagship 5/5 viewports (`runs.jsonl` #170).
- **A1 (TRUD account) DEFERRED by user — no ETA** (recorded on #161). Blocks W5·B2/B3 + W4.
- ☑ **A2 · prod D1 COMPLETE (#13 closed)** — DB `sortmy_london_corpus` (`cc6bb743…`) created,
  migration applied (5 statements), `DB` binding live on the deployed Worker; Pages config kept
  **D1-free** (Worker is the sole data access, ADR 0002 — a dashboard-added block was removed).
  Provisioning surfaced a real gap: an **empty-but-healthy gazetteer** was a legit miss, so an
  unseeded store would have answered every postcode with an empty state. Fixed test-first (#171):
  `d1Source.origin` probes the gazetteer on a miss — EMPTY ⇒ throw ⇒ the bundled fallback. Verified
  LIVE against the empty store: sweep **PASS**, flagship 5/5 via the fallback (#172).
- ☑ **W5·B1 · Tier-3 uptime monitor SHIPPED** (#173) — `.github/workflows/tier3-monitor.yml`: every
  6h + `workflow_dispatch`, credential-free, runs the sweep against live `sortmy.london`; FAIL ⇒ red
  run + artifact bundle + a deduped alert issue. First dispatched run: **success** (29966125343).
- **Open issues now:** #10 (W5·B2/B3, blocked) · #113 (this tracker) · #150 (jsx-a11y, upstream) ·
  #161 (TRUD, deferred — carries the licence follow-ups + lawyer checklist) · #168 (upstream watch:
  sharp/TS-7/zod-4). #13, #69, #5 closed this session.

## Progress (2026-07-22 · later session — W6 shipped, v1.2.0 released)

- ☑ **W6 · D1 read-through corpus store (#13)** — PR #162: `CorpusSource` seam (`corpus/source.ts` —
  bundled default/fallback + `d1Source` over one SQL view per corpus), pure `corpusRows` core,
  `CorpusDef.d1View` (care → `care_signposts`), `env.DB → ModelCtx → QueryCtx` threading (interpreter
  stays closed), `worker/migrations/0001_corpus_store.sql` (+ `postcodes` gazetteer + `corpus_meta`).
  The `[[d1_databases]]` binding ships **commented out** until provisioning — unbound/failed D1 serves
  the bundled sample, so an outage can never break Care. Strict TDD: 5 new mocked-D1 tests, 171 green.
- ☑ **Licensing (ADR 0002)** — serving from our own store is REDISTRIBUTION → licence-gated:
  `license`/`redistribute_ok`/`redistribute_note` on the 11 audited sources in `data/sources.json`.
  Verdicts: **NHS live DoS/Service Search forbids caching → W4 pivots to `nhs-ods` (OGL bulk via
  TRUD)**; **FCA proprietary → live/link-only** (confirms shipped W2); OSM = ODbL share-alike
  conditional; the rest OGL-storable with attribution. Med-confidence follow-ups tracked in #161.
- ☑ **Deps/security** — dependabot batch cleared (#149/#151/#108, regenerated #164/#165); ignore rules
  encode the deliberate TS-6 + zod-3 pins (#163); transitive **sharp → 0.35.3 via npm override**
  (#166, `wrangler dev --local` boot-smoked). Upstream watch: #168.
- ☑ **v1.2.0 RELEASED** — changelog rolled, README/architecture synced (dropped GitHub-Models from
  the free chain; D1 seam + NHS-ODS ingest replace the KV framing; zod-3 pin), versions stamped
  (#167); annotated tag on `1e63374` + a GitHub Release. **NOT deployed** — `make deploy` publishes
  the whole 1.2.0 stack (incl. the #154 a11y fix + H3–H6).
- ☑ **Docs** — `docs/glossary.md` (+ AGENTS pointer) · `docs/archive/` (submission + demo-script
  archived with banners; links fixed) · `ingest/README` (KV → NHS-ODS→D1 + the polyfetch env-borrow
  CLI + its 3xx caveat, polyfetch#188).
- ☑ **Issues groomed** — #113 ticked; #13/#10 rewritten (KV-era → D1/hybrid); #69 + #5 closed with
  rationale; NEW **#161** (W4 deferred: TRUD account + licence follow-ups) · **#168** (upstream watch).

## Progress (2026-07-22)

- ☑ **W2 · Sort My Scam Check (#74)** — #140. A **match-shape** usecase: a new `query_scam` exec + a
  dedicated `scam` render mode (engine seam unchanged — no `playStage`/`runUsecase`/`renderBatch` edits;
  the frozen geo `CorpusRecord` is untouched). Own `worker/src/scam/*` module reusing the geo-agnostic
  `CorpusRow` + shared card primitives; **all honest copy is derived in reviewed code, never authored in
  data** (so a data slip can't introduce a verdict). The clone flag is **deterministic** — it only
  annotates look-alikes *among the search's own results* (shared name stem + differing FCA status), never
  a fuzzy dataset-wide guess. Synthetic + **fictional** firms; curated FCA-register link; `mode:demo`.
  Strict module-TDD (19 scam tests). e2e `flows.json` now covers scam (manifest field `postcode`→`query`).
- ☑ **W3 · Sort My Wander (#73)** — #138. The register-only proof of W1: a nearest-N corpus usecase
  with **zero engine TS** (data + registry entry + usecase JSON + UI entry). Corpus is synthetic
  `data/wander/*.sample.json` (heritage + green space), curated Historic England official link. The
  e2e sweep is now **data-driven** — civic flows live in `tests/e2e/flows.json` and the sweep runs +
  **asserts** every corpus flow (Care + Wander), so adding a workflow to the sweep is a manifest edit,
  not a test-source change. Verified: worker+ui tsc/lint/tests green (135+22); live browser render is
  the user's CF-gated env.
- ☑ **C · `shared/*.ts` lint** — #123 + #124 (issue #122). Root `eslint.config.js` was required (ESLint 10
  refuses files above its config dir); fixing the findings surfaced a real bug (`isValidSearchResult`
  threw on `matches: [null]`) from a circular `as Partial<T>` cast. See `AGENT_LEARNINGS.md`.
- ☑ **W1 · engine register-only (#80)** — #125. Generic `corpus` mode + `query_corpus` exec over a corpus
  id; `worker/src/corpus/*` replaces `worker/src/care/*`; load-guard on the corpus id; query fns return a
  `Promise` (D1-ready). **W2/W3 are now unblocked and need no engine TS.**
- **Data architecture decided:** the request path reads an **in-house CF D1** store; sources are fetched
  out-of-band on a **cron + explicit trigger**, with **migrations** for schema and **one view per corpus**
  projecting onto `CorpusRecord`. This promotes W6/D1 from "only if forced" to the foundation W4/W5 build
  on.
- ☑ **e2e now asserts the flagship** — #126. The sweep clicked the CTA but never typed a postcode and
  asserted nothing, so a broken `query_corpus`/corpus-render would still have PASSED. It now types
  `SW9 9SL` and requires the summary + `data as of` + disclaimer markers, per config.
- ☑ **Deployed + verified live** — Pages + Worker on `sortmy.london`; the corpus seam renders real rows
  (`3 services near SW9 9SL · data as of 2026-06-01`) on all 5 configs, 0 console errors, 0 model-host hits.
- ☑ **`v1.1.0` tag pushed** (on `8286890`, the release commit).
- ☑ **Workstream H (engine hardening & cross-stack alignment) — FULLY SHIPPED (5/5), folded into the 015
  plan.** H1 dropped the GitHub Models tier (#127/#132, it retired 2026-07-30); H2 strict usecase schema —
  reject unknown keys at load (#133/#136), adopting azure `extra="forbid"`. H3/H4 transient-vs-fatal
  model-error taxonomy + one bounded retry (#141) — `callModelTool` retries once on `{429,500,502,503,504}`,
  fails fast on the rest (401/407/404/410/451). H5 `asOf` date validation (#142) — `worker/src/dates.ts`
  advertises only the oldest VALID ISO date. H6 registry-derived `RENDER_MODES`/`STAGE_EXECS` unions (#143)
  — `tsc`-locked, not just test-locked. H7 e2e On It assert + video both orientations (#144).
- ☑ **H-stream complete** — all five H items (H1–H7) are shipped; no H work remains open in 015.
- ☑ **Estate contract alignment (cross-repo):** `qte77/qte77#162` updated, `azure-doc-workflows#288` +
  `protocols#2` filed — the "share the contract" half; sibling repos' work, not this repo's flow.
- ☑ **C · S5 deepest strictness — 4/5 shipped, 1 deferred; axe-core + `runs.jsonl` shipped.**
  `verbatimModuleSyntax` (#146) · `noPropertyAccessFromIndexSignature` (#147, 60-site bracket-notation
  fix) · `eslint-plugin-security` (worker+shared, #148, `detect-object-injection` off + 2 reviewed
  `detect-unsafe-regex` exceptions in `guard.ts`) · curated `eslint-plugin-unicorn` (worker+ui, #152)
  are all merged; `eslint-plugin-jsx-a11y` (#150) is **DEFERRED** — its latest release peers ESLint
  `^3`–`^9`, incompatible with this repo's ESLint 10, and `legacy-peer-deps` would undermine the same
  strictness. The e2e sweep now injects a **self-hosted, vendored** `axe-core`
  (`tests/e2e/vendor/axe.min.js`, past the CSP via `page.evaluate`) for a WCAG 2 A/AA scan — gates on
  `critical`, reports `serious`+ — which already caught 1 real serious issue (card official-link
  contrast 4.42 < 4.5, a11y issue #154). A committed `tests/e2e/runs.jsonl` also now carries per-run
  history across sessions. **The C carry-over is essentially complete.**
- ☑ **Follow-on hardening — all shipped:** `ruff` + a SHA-pinned `lint-py` CI gate for the e2e Python
  (#156) · `actionlint` on the workflows (#157) · ESLint `reportUnusedDisableDirectives` +
  `eslint-plugin-regexp` (#158 — caught 3 real regex fixes) · **a11y-strict**: #154's contrast fixed
  (light-mode link override `#725810` = 4.98:1, no vendored-token edit) + the axe gate flipped to
  `serious` + axe on the mobile-portrait viewport. Cross-repo standardization captured as
  **`qte77/qte77#164`** (estate baseline) — NOT started here, per direction. Only
  `eslint-plugin-jsx-a11y` (#150) stays deferred, pending upstream ESLint 10 support.
- **Deploy pending:** the #154 contrast fix + the H3–H6 Worker internals are on `main` but NOT live —
  a `make deploy` makes them live; then run the sweep (now gating axe on `serious`) → expect 0
  critical/serious.

## Queue & order

~~`C`~~ ☑ · ~~`W1`~~ ☑ · ~~`W3`~~ ☑ · ~~`W2`~~ ☑ · ~~`W6`/D1~~ ☑ (#162) · ~~deploy~~ ☑ (v1.2.0 live) ·
~~D1 provisioning~~ ☑ (#13 closed) · ~~`W5`·B1 monitor~~ ☑ (#173) → **EVERYTHING remaining (W5·B2/B3
and W4) is blocked on #161 (TRUD, user-deferred) ← the ONLY gate.**

**W3 before W2** (swapped from the original order): Wander is nearest-N, so it is genuinely register-only
and proves W1 end-to-end with zero engine TS. Scam is a *match* shape and needs one new `query_scam` exec,
so it is no longer the cheaper of the two.

## Resume — next up

**One gate, then a straight line.** The live site self-monitors every 6h (tier3-monitor.yml); the D1
store is live, empty, and fail-safe. Nothing is buildable until:

1. **#161 · NHS ODS TRUD account (user)** — register, subscribe to the ODS release, **verify the
   per-item licence is OGL on the accept screen**, take the API key (→ a GitHub Actions secret).
2. Then, in order: **W5·B2** ingester Action (`ingest/seed.py`: ODS ZIP/CSV → `CorpusRecord`,
   test-first parsers; geocode via postcodes.io → the D1 `postcodes` gazetteer; publish as a release
   asset — no CF creds in CI) → **W5·B3** CF Cron `scheduled()` (pull asset → shadow → validate
   row-count → atomic view swap → stamp `corpus_meta`) → **W4 verified live** (freshness-recency
   assert in the sweep; OGL attribution strings in the corpus labels). That completes plan 015 →
   mint handoff 016.

~~W3 Wander~~ ☑ (#138, register-only) · ~~W2 Scam~~ ☑ (#140, match-shape) — the two civic usecases 015
set out to add are now in. ~~H3/H4 taxonomy + retry~~ ☑ (#141) — the H-stream (H1–H7) is now fully shipped,
so W6/D1+W4 is the only open thread in 015.

## Register-only corpus recipe (shipped as W3 #138; the pattern for future nearest-N usecases)

**The add-a-usecase recipe below CHANGED in W1.** Do NOT add a render mode or query exec — that is
exactly what #80 removed. A nearest-N corpus usecase is register-only (this is exactly what W3 did —
`data/wander/*` + one `registry.ts` entry + `usecases/sort-my-wander.json` + one UI entry):

1. **Corpus** — `data/wander/{places,postcodes}.sample.json` matching `CorpusRecord`
   (`id/name/authority/why/officialUrl/lastUpdated` + `lat/lng`). Keyless sources: Historic England NHLE,
   OSM Overpass, Wikidata, OS Open Greenspace. Synthetic + committed; real/scraped stays ToU-gated.
2. **Register** — one entry in `worker/src/corpus/registry.ts`: `records`, `postcodes`, and `labels`
   (`noun: "place"`, a `summaryLine`, the **curated** `officialLink`, and the two empty-state hints).
   Do NOT cast the JSON imports — left uncast, the data is structurally *checked* against `CorpusRecord`,
   so a malformed row is a compile error rather than a silently-asserted shape.
3. **Usecase JSON** — `usecases/sort-my-wander.json`: `"render": { "mode": "corpus" }` + a tool stage
   `"exec": "query_corpus", "corpus": "wander"`; add the import + entry to the `usecases.ts` registry map.
   An unregistered corpus id is a **startup error**, so a typo fails loudly.
4. **UI** — a `USECASES` entry in `ui/src/App.tsx` (`civic: true` to surface it).
5. **Verify** — `make test` + `tsc` + `eslint` (worker+shared+ui) + markdownlint, then the e2e sweep.
   **No new module tests**: the generic `queryCorpus`/`buildCorpusCards` are already covered, and a corpus
   is data, not a module. Keep `runUsecase`/`renderBatch`/`cardsBatch` closed.

## Conventions (hard — unchanged)

- Branch-per-topic → Conventional Commits → push → **squash-merge `--admin` ONLY on green CI+tests** →
  **prune** remote+local. `env -u GH_TOKEN -u GITHUB_TOKEN` · noreply (`qte77` /
  `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` (rebase: `-c commit.gpgsign=false`) ·
  SHA-pin new Actions · KISS/DRY/YAGNI · assume strict lint+typing+sec.
- **Strict module-TDD**: test FIRST for load-bearing MODULES only, never config/glue/CSS. The engine
  generalisation (W1) is a real module → test-first; usecase JSON/corpus wiring is data/glue.
- **Signpost, not adjudicator**: every workflow shows freshness + a curated official-source link + honest
  deterministic HUD (`USAGE mode:demo`); never advice/triage/verdict. Real/scraped data is **ToU-gated →
  `data/real/` gitignored; only synthetic committed.**

## Gotchas (save hours — carried from 014)

- **`gh pr merge` intermittently blocked by the auto-mode classifier** — retry (usually passes) or the user
  runs it. **Production deploys are the user's** (`make deploy`, fixed in 014) — creds/classifier-gated.
- **markdownlint MD004**: never let a wrapped line start with `+`/`-`/`*` (a `A + B` line-break becomes a
  list item + flips bullet style). Bullets stay `-`.
- **Worker is on TS 6** (typescript-eslint can't parse TS 7) — keep aligned with `ui`. Worker + ui are both
  strictTypeChecked + full strict tsconfig now; new code must pass on the first try.
- **e2e** via `/workspaces/qte77/polyfetch-scrape/.venv/bin/python tests/e2e/ui_sweep.py <url> <label>` —
  writes `results/<label>/summary.json` (verdict). Since #126 it **types a postcode and asserts the Care
  flagship renders**, so it now REQUIRES a running Worker (`make dev` or a deployed target) — a vite-only
  run serves the landing page and correctly fails. `_headers`/CSP only live after a Pages deploy.
- **ESLint 10 cannot lint files above its config dir** (`basePath` only scopes *downward*), and the typed
  project *service* walks UP from each file. Hence the root `eslint.config.js` for `shared/`. Do not
  blanket-inherit a consumer's rule relaxations into the security boundary. See `AGENT_LEARNINGS.md`.
- **Never cast untrusted input to `as Partial<T>`** — it asserts the field types you are trying to verify,
  makes real null-guards look redundant, and hid a live throw (#124). Narrow, then use
  `Record<string, unknown>`.
- **Deploy = Pages-only for UI changes**: `wrangler pages deploy ui/dist --project-name sortmy-london
  --branch main`. Worker-route re-assert wants Zone→Workers-Routes→Edit (else benign code 10000).

## Backlog from the 015 review — #127–#130 now all shipped

- ☑ **#127 · GitHub Models tier retires 2026-07-30** — dropped (#132, H1).
- ☑ **#128 · `asOf` freshness depends on an unvalidated date format** — validated at the ingest boundary
  via `worker/src/dates.ts` (#142, H5), ahead of W4.
- ☑ **#129 · derive `RENDER_MODES`/`STAGE_EXECS` from the registry keys** — closes ADR 0001's known
  "two sources of truth" minus (#143, H6).
- ☑ **#130 · e2e: assert On It + record video in both orientations** — done (#144, H7).

Lower value: `docs/submission.md` is a stale v1.0.0 deck (references `runStages`/KV/`UsecaseInspector` —
none exist) and holds the only roadmap content; dead `category` field in the care corpus; reserved-unread
env vars (`CF_ACCOUNT_ID`, `CF_GATEWAY_ID`, `COMPANIES_HOUSE_KEY`); the `renderTool`/`incorporate` shape
casts (improvable, not unsafe); `eslint-plugin-security` (S5) lands most valuably on `shared/`.

## Open / context

`sortmy.london` live (014 + 015·C/W1 in, deployed + e2e-verified). Legacy-showcase issues closed in 014
triage; the civic-relevant backlog is this plan / #113. Note #116 is a merged **PR**, not an open issue —
the stray root `MEMORY.md` gitignore already landed there.
