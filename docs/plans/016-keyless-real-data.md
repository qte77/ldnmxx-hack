---
title: "Plan 016 — keyless real data: one pipeline, three real corpora (no TRUD)"
type: plan
updated: 2026-07-23
status: "in progress — P0 arc mechanics"
refs: ["#181? (016 tracker — see handoff)", "#10 (cron)", "#161 (TRUD/ODS — 016 backlog, additive)", "#168 (upstream watch)", "ADR 0002", "plan 015 (closed)"]
---

# Plan 016 — keyless real data

> Plan 015 CLOSED at ≈90% (W6 D1 store, licence gate, W5·B1 monitor, v1.4.0 live+verified); its only
> remainder (NHS-ODS Care + its cron) was TRUD-gated and user-deferred → **migrated here as backlog**.
> The 19-source licence audit (`data/sources.json` `redistribute_ok`) opened a **TRUD-free path**:
> this arc builds the ingest pipeline ONCE and lands real data THREE times, using only keyless,
> redistribution-cleared sources. **Every phase is agent-only — zero owner gates.**

## Progress — queue (tick per merged PR)

| # | Phase | Status |
|---|---|---|
| P0 | Arc mechanics: close 015 · mint this plan + handoff · tracker issue · #113 closed | ☐ |
| P1 | Pipeline: `ingest/seed.py` parsers (TDD) · `ingest.yml` → release asset · CF cron `scheduled()` → D1 shadow→validate→swap · `attribution` surface in labels/render | ☐ |
| P2 | Wander REAL (NHLE + OS Open Greenspace) + freshness-recency e2e assert → release v1.5.0 | ☐ |
| P3 | Care REAL via CQC (flagship; coverage-honest copy) → release v1.6.0 | ☐ |
| P4 | Sort My Food Hygiene — NEW register-only usecase (FHRS) → release v1.7.0 | ☐ |
| P5 | Hygiene (woven in): pin patchright in tier3 · `release.yml` · drop dead care `category` · reserved env vars · D1 steps in deploy docs | ☐ |

## Source map — do NOT re-explore; all session-verified 2026-07-23

**Corpus seam (`worker/src/corpus/`)**

- `contract.ts` — FROZEN `CorpusRecord` (`id/name/authority/why/officialUrl/lastUpdated/lat/lng`),
  `CorpusLabels` (curated copy + `officialLink` — NEVER data-supplied), `CorpusRow`, `CorpusQuery`.
  P1 adds `attribution: string[]` to `CorpusLabels`.
- `registry.ts` — the ONLY file a new corpus touches engine-side: `corpora` map (`records`,
  `postcodes`, `labels`, `d1View?`). `care` carries `d1View: "care_signposts"`; P2 flags `wander`,
  P4 adds the food-hygiene entry. `corpusIds` feeds the usecase load-guard.
- `source.ts` — `CorpusSource` seam: `bundledSource` (default + fallback), `d1Source` (origin via
  `postcodes` table; records via the **`VIEW_SQL` whitelist** — fully static SQL, one entry per view;
  new corpora add a line here). `origin()` carries the **empty-gazetteer seed-probe throw** (#171):
  unseeded store ⇒ bundled fallback. `QueryCtx { db? }`.
- `query.ts` — `queryCorpus(input, ctx?, n)`: `d1View` + `ctx.db` ⇒ D1 (try/catch ⇒ bundled on ANY
  failure); pure `corpusRows` core (nearestN + display line + conservative `asOf` via `dates.ts`);
  `queryCorpusDef` stays for the pure tests.
- `render.ts` `buildCorpusCards` + `../a2ui/cards.ts` `appendDisclaimer(batch, link)` — attribution
  strings render here (P1, module-TDD).

**Worker (`worker/src/worker.ts`)** — `Env.DB?: D1Database`; `ModelCtx.db` set in `resolveRun`;
`playStage` passes `{ db: ctx.db }` to query fns; the interpreter (`runUsecase`/`playStage`/
`renderBatch`) stays CLOSED. P1 adds the `scheduled()` export beside `fetch` (asset → shadow →
validate `row_count ≥ 50` → atomic view swap → stamp `corpus_meta`); module-TDD the pure
validate/swap planner against a mocked D1, not the handler glue.

**Store** — D1 `sortmy_london_corpus` (`cc6bb743-4041-455e-bf30-b4ecd5d184c3`) LIVE + bound + EMPTY
(fail-safe verified in prod). `worker/migrations/0001_corpus_store.sql` = `nhs_services` +
`care_signposts` view + `postcodes` + `corpus_meta`. P2 adds `0002` (raw tables + views for
wander/cqc/fhrs). Apply: `./node_modules/.bin/wrangler d1 migrations apply DB --remote --config
wrangler.toml` (creds: root `.env` / `~/.cf-token` exported as `CLOUDFLARE_API_TOKEN`). **Every
wrangler call in `worker/` needs `--config wrangler.toml`.** P1 adds `[triggers] crons` to
`worker/wrangler.toml`.

**Tests** — `worker/test/corpus.test.ts`: `stubDb` (method-shape routed: `.bind().first()` = origin,
bare `.first()` = seed-probe, `.all()` = view read; `gazetteerEmpty`/`fail` knobs), 6 D1 + 7 pure +
3 seam tests, 172 total green. Ingest parsers: pytest under `ingest/` (the CI `lint-py` job already
globs `ingest/`; add pytest invocation there in P1).

**Ingest (`ingest/`)** — only `README.md` exists (env-borrow contract). P1 builds `seed.py` + pure
per-source parsers. Fetch via polyfetch env-borrow:
`uv run --directory ../polyfetch-scrape polyfetch fetch <url> --show-body --max-tier curl_cffi`
(3xx NOT followed — polyfetch#188; escalate tier for JS pages; sandbox-off for network).

**CI (`.github/workflows/`)** — copy pin style from `tier3-monitor.yml`: checkout
`9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0` · setup-python
`ece7cb06caefa5fff74198d8649806c4678c61a1 # v6.3.0` · upload-artifact
`b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6`. P1 adds `ingest.yml` (weekly Mon 05:17 UTC +
`workflow_dispatch`, `GITHUB_TOKEN` only, publishes normalised JSON to the rolling release tag
`corpus-data`). No CF credential ever enters CI.

**e2e** — `tests/e2e/ui_sweep.py <url> <label>` via
`/workspaces/qte77/polyfetch-scrape/.venv/bin/python`: 5-config viewport/device matrix, clicks
switch-buttons + CTAs, videos BOTH orientations, console/network capture (fails on model-host or
console errors), vendored axe (gates critical+serious). Flows are DATA: `tests/e2e/flows.json`
(P2 adds recency marker; P4 adds the food-hygiene flow). History: committed `tests/e2e/runs.jsonl`.

**Sources + obligations** — `data/sources.json` (19 audited; read `redistribute_note` per source):
NHLE OGL ("© Historic England [year]" + OS line for spatial) · OS Open Greenspace OGL ("Contains OS
data © Crown copyright and database right [year]") · CQC OGL (`partnerCode` param, ack "using CQC
information", show rating date; NO community pharmacies → coverage-honest copy) · FHRS OGL (show
inspection date; OWN card, never the FSA badge) · postcodes.io OGL (GB only, never BT rows).

## Phases (details)

- **P1 pipeline** — parsers test-first (RED observed) for: NHLE ArcGIS GeoJSON, OS Greenspace
  GeoJSON, CQC paginated `/locations` (London localAuthority allowlist), FHRS London establishments,
  postcodes.io bulk gazetteer. `seed.py` orchestrates → per-corpus normalised JSON artifacts.
  Action publishes → CF cron consumes. Attribution surface: `CorpusLabels.attribution` rendered via
  `appendDisclaimer`. Done-when: dispatched Action produces the asset; triggered cron fills D1
  (shadow→swap, `corpus_meta` stamped); 172+ tests green; D1-off fallback untouched.
- **P2 Wander real** — migration 0002 (nhle/greenspace raw + `wander_places` view), registry
  `d1View` + `VIEW_SQL`, attribution labels, sweep freshness-RECENCY assert. Release v1.5.0.
- **P3 Care real via CQC** — care fed from CQC rows (lat/lng in payload; postcodes.io only for
  user-input gazetteer), labels + rating date + coverage honesty; ODS (#161) additive later.
  Release v1.6.0.
- **P4 Food Hygiene** — register-only proof at scale: corpus + registry + `usecases/
  sort-my-food-hygiene.json` + UI entry + flow. Release v1.7.0.
- **P5 hygiene** — see queue; each its own small PR between phases.

## Backlog (not built this arc)

Scam-via-CH-bulk · Crisis Support (Give Food — CC-BY, link-back per foodbank, NO list-reorder, NO
bulk-contact, courtesy email) · 360Giving per-RECORD licence pattern · GLA cultural / planning
datasets (conditional) · **#161 TRUD/ODS + verification checklist (user-deferred)** · real-time data
pattern (EA warnings, air, transport) — needs its own ADR.

## Decide-by-defaults (apply silently; owner may override at any checkpoint)

`partnerCode=sortmy-london` · ingester weekly Mon 05:17 UTC + dispatch · release tag `corpus-data` ·
cron daily 04:47 UTC · swap threshold ≥50 rows/corpus · London filter = postcode-area allowlist
(CQC: localAuthority list) · per-phase releases v1.5.0/v1.6.0/v1.7.0.

## Standing execution contract — e2e hands-off, UNATTENDED

Binds `.claude/rules/unattended-execution.md`: branch+commit per topic → push → squash-merge ONLY on
green CI+tests → prune remote+local · strict module-TDD (RED first; modules only, never
scripts/config/glue) · assume strict lint+typing+sec · e2e via polyfetch/patchright locally AND
remote (viewports, device emulation, click interactive elements, screenshots+videos both
orientations, console/network capture) · deploy ritual: deploy → MIME pre-flight (browser headers) →
edge-settle → sweep → `runs.jsonl` (honest FAILs kept); local page-crash (devcontainer memory) ⇒
dispatch `tier3-monitor.yml` as the verifier — never skip verification · per-milestone hygiene
ritual: docs (changelog/README/architecture/UserStory/glossary/plan+handoff) · URLs/env/CLI
documented · issues opened/updated/closed · progress report (shipped · next · % · blocked/deferred).

## Verification

Per PR: `make test` + tsc + eslint(worker/shared/ui) + ruff + markdownlint + CI green. Per phase:
deploy ritual → sweep PASS (markers + freshness recency + 0 model-host + axe 0/0 + 0 console
errors). Pipeline proven by REAL Action + cron runs, never mocks (verify-live rule). Tier-3 monitor
is the standing guard.
