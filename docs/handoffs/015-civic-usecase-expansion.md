---
title: "Handoff 015 — C+W1+W2+W3 shipped, H hardening 2/5; resume at W6/D1+W4 (real data) or H3/H4"
type: handoff
updated: 2026-07-21
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

## Progress (2026-07-21)

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
- ☑ **Workstream H (engine hardening & cross-stack alignment) — folded into the 015 plan.** H1 dropped the
  GitHub Models tier (#127/#132, it retired 2026-07-30); H2 strict usecase schema — reject unknown keys at
  load (#133/#136), adopting azure `extra="forbid"`. **H3/H4 (transient-vs-fatal taxonomy + one bounded
  retry) are next and FULLY PRE-SCOPED in the plan's "H3/H4 design" block** (reuse `polyfetch-scrape`
  `errors.py`/`retry.py`; lands in `callModelTool`; transient set `{429,500,502,503,504}`). H5 `asOf` date
  validation (#128, do before W4), H6 registry-derived unions (#129), H7 e2e On It+video (#130).
- ☑ **Estate contract alignment (cross-repo):** `qte77/qte77#162` updated, `azure-doc-workflows#288` +
  `protocols#2` filed — the "share the contract" half; sibling repos' work, not this repo's flow.
- Remaining C (original carry-over, still open): S5 knobs (each its own PR), axe-core in the sweep,
  `runs.jsonl` manifest.

## Queue & order

~~`C` carry-over~~ ☑ · ~~`W1` engine (#80)~~ ☑ · ~~`W3` Wander (#73)~~ ☑ (#138) · ~~`W2` Scam (#74)~~ ☑ (#140) →
**`W6`/D1 foundation + `W4` real Care corpus (#13) ← START HERE** · `W5` ingest cron (#10).

**W3 before W2** (swapped from the original order): Wander is nearest-N, so it is genuinely register-only
and proves W1 end-to-end with zero engine TS. Scam is a *match* shape and needs one new `query_scam` exec,
so it is no longer the cheaper of the two.

## Resume — two ready options

- **W6/D1 + W4 · real data foundation (#13)** — the decided data architecture: the request path reads an
  in-house CF **D1** store; sources are fetched **out-of-band** on a cron + explicit trigger, with
  migrations + one SQL view per corpus projecting onto the frozen `CorpusRecord`. W6/D1 precedes/merges
  with W5 (a cron can't write a build-time JSON import). **Do H5 (#128 `asOf` date validation) BEFORE W4**
  — it is a trust claim. See the W4/W5/W6 workstreams in the plan.
- **H3/H4 · taxonomy + bounded retry (#134/#135)** — one PR, model-chain robustness; the entire design
  (polyfetch reuse, transient set, where it lands, test plan) is pre-written in the **plan's "H3/H4
  design" block** — implement straight from there, no re-derivation.

Both are independent. ~~W3 Wander~~ ☑ (#138, register-only) · ~~W2 Scam~~ ☑ (#140, match-shape) — the two
civic usecases 015 set out to add are now in.

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

## Backlog from the 015 review (not blocking W3)

Dated / trust-critical first:

- **#127 · GitHub Models tier retires 2026-07-30** — delete the third free-chain tier before it becomes a
  guaranteed-fail round-trip. Time-boxed.
- **#128 · `asOf` freshness depends on an unvalidated date format** — `lastUpdated.sort()[0]` is only
  chronological because the samples are ISO `YYYY-MM-DD`. W4's real ingest could silently break the
  "data as of …" trust claim. Fix at the ingest boundary **before** W4 exists.
- **#129 · derive `RENDER_MODES`/`STAGE_EXECS` from the registry keys** — closes ADR 0001's known
  "two sources of truth" minus, which W1 only half-fixed (corpus ids are validated; the mode/exec
  constants are still hand-maintained).
- **#130 · e2e: assert On It + record video in both orientations** — On It has the same unasserted hole
  #126 just fixed for Care; video is currently desktop-only.

Lower value: `docs/submission.md` is a stale v1.0.0 deck (references `runStages`/KV/`UsecaseInspector` —
none exist) and holds the only roadmap content; dead `category` field in the care corpus; reserved-unread
env vars (`CF_ACCOUNT_ID`, `CF_GATEWAY_ID`, `COMPANIES_HOUSE_KEY`); the `renderTool`/`incorporate` shape
casts (improvable, not unsafe); `eslint-plugin-security` (S5) lands most valuably on `shared/`.

## Open / context

`sortmy.london` live (014 + 015·C/W1 in, deployed + e2e-verified). Legacy-showcase issues closed in 014
triage; the civic-relevant backlog is this plan / #113. Note #116 is a merged **PR**, not an open issue —
the stray root `MEMORY.md` gitignore already landed there.
