---
title: "Plan 016 — keyless real data: one pipeline, three real corpora (no TRUD)"
type: plan
updated: 2026-07-23
status: "CLOSED — P0–P5 shipped; all 5 corpora live in D1 (110k+ rows), v1.7.0 deployed"
refs: ["#181? (016 tracker — see this plan's Handoff section)", "#10 (cron)", "#161 (TRUD/ODS — 016 backlog, additive)", "#168 (upstream watch)", "ADR 0002", "plan 015 (closed)"]
---

# Plan 016 — keyless real data

## Handoff (read this first)

**Originally handoff 016 — "keyless real data; resume at P1 (pipeline). Zero owner gates." (updated
2026-07-23).** Predecessor **015 is CLOSED** (≈90% shipped; remainder migrated here — see
`015-civic-usecase-expansion.md` for the historical record). Strategy stands: **signpost, not
adjudicator**; licence-gated self-serve (ADR 0002).

### The one-line why

The 19-source licence audit made TRUD irrelevant for real data: build the ingest pipeline once
(P1), then land real corpora three times — Wander (P2), Care-via-CQC (P3), NEW Food Hygiene (P4) —
all keyless, all `redistribute_ok`, all agent-only.

### ARC CLOSED — 2026-07-23 (P0–P5 all shipped)

**v1.7.0 live on `sortmy.london`; all 5 corpora seeded in D1** (postcodes 6,656 · nhle 23,741 ·
greenspace 12,197 · cqc 9,345 · fhrs 66,871 = 118,810 rows), each swap-gated on rows + licence
attribution, each with a bundled-sample fallback. Pipeline proven end-to-end live (Action → release
→ daily cron → D1). Two follow-ups carried to the NEXT arc (NOT stranded):

1. **Edge-cron subrequest limit UNVERIFIED at full load** — every live prove fired through local dev
   (no subrequest cap). The real 04:47 UTC run does all 5 targets in one invocation (~110k rows).
   **First next-arc action: read `corpus_meta` timestamps after 04:47 tomorrow; if they didn't
   advance, wrap chunk-inserts in `db.batch()` groups (≈75× fewer subrequests) — ~10 LOC + 1 test.**
2. **Backlog (open issues):** #185 gazetteer widening (ONSPD full-London), #161 NHS-ODS additive
   enrichment, #168/#150 upstream watches. Freshness watchdog (alert on stale `corpus_meta`) is a
   suggested enhancement.

The rest of this section is the historical arc record.

- **Live:** v1.4.0 on `sortmy.london` (sweep-verified); D1 `sortmy_london_corpus` bound + EMPTY +
  fail-safe-verified (#171); Tier-3 monitor sweeping 6-hourly (`tier3-monitor.yml`).
- **Shipped by 015 (don't rebuild):** `CorpusSource` seam + `VIEW_SQL` whitelist + empty-store
  fallback; migration 0001; licence matrix in `data/sources.json`; glossary/ADR 0002/archive docs.
- ☑ **P0 shipped** (#181: 015 closed, 016 minted, tracker #182, #113 closed).
- ☑ **P1 SHIPPED + LIVE-PROVEN** (#183 merged `a6e0aaf`, 2026-07-23): parsers (24 pytest,
  captured-real fixtures) · `seed.py` · `ingest.yml` → all 5 artifacts on the rolling `corpus-data`
  release (nhle 23,741 · greenspace 12,197 · cqc 9,345 · fhrs 62,909 · postcodes 6,656) · Worker
  `scheduled()` + daily cron `47 4 * * *` deployed · **cron fired for real → prod D1 `postcodes` =
  6,656 rows, `corpus_meta` stamped** · empty-view⇒bundled fallback + attribution swap-gate live.
  **Source reality shifted — see plan P1 details:** CQC API 403s unauthenticated (keyless path =
  weekly directory CSV, no ratings → link out); OS Greenspace = GeoPackage (BNG→WGS84 in parsers);
  NHLE = `NHLE_v02_VIEW` layer 0. Cron-firing verification gotcha → AGENT_LEARNINGS.
- ☑ **P2 SHIPPED + v1.5.0 RELEASED/DEPLOYED** (#187 + #188, tag v1.5.0, 2026-07-23): migration
  0002 applied remote · wander flips to `wander_places` D1 view with REAL attribution (HE + OS
  Crown copyright) · **wander-nhle swapped live: 23,741 rows** (`corpus_meta` as_of 1949-02-24);
  wander-greenspace (12.2k) completes via re-fire/daily cron (local-dev proxy inserts are slow —
  the edge cron is not). Recency-marker lesson: compute markers with the APP's origin (real
  gazetteer coords) + haversine, NOT offline approximations — first sweep FAILed honestly on a
  marker 330m off; fixed marker = "Stockwell Road Sw9" (stable pre/post greenspace).
- ☑ **P3 SHIPPED + v1.6.0 RELEASED/DEPLOYED** (#191 + #192, tag v1.6.0, 2026-07-23): migration
  0003 (care_signposts REPOINTED to `cqc_locations`; nhs_services dropped) · **care swapped live:
  9,345 CQC rows** (as_of 2026-07-22, the directory date) · CQC OGL attribution + coverage-honest
  copy (no pharmacies, no ratings — link out) · parser dedupe for pipe-duplicated service types ·
  greenspace as_of ISO pad (self-heals on the next weekly Action).
- **NEXT = P4 Sort My Food Hygiene** (in flight on `feat/016-p4-food-hygiene`): migration 0004
  (`fhrs_establishments` + `food_hygiene` view) · registry entry (REAL-rows bundled sample, FHRS
  OGL attribution, own card never the FSA badge) · usecase JSON + UI USECASES entry + flow
  (markers: "O2 Academy Brixton" 3m from SW9 9SL + FSA attribution) · release v1.7.0. Then P5
  hygiene micro-PRs (pin patchright in tier3 · release.yml · drop dead care `category` · reserved
  env vars · D1 steps in deploy docs) and the arc close-out.

### How this arc ran (the loop)

1. Branch per topic → module-TDD (RED observed → GREEN) → gates (`make test`, tsc, eslint
   worker/shared/ui, ruff, markdownlint) → push → PR → **squash-merge ONLY on green** → prune
   remote+local.
2. Per phase: deploy (`make deploy`; worker-only/Pages-only when applicable) → **MIME pre-flight
   with browser headers → edge-settle → sweep** (`ui_sweep.py <url> <label>`) → commit the
   `runs.jsonl` line (keep honest FAILs). Release per phase (v1.5.0/6/7): roll CHANGELOG →
   `make bump VERSION=` → PR → tag → `gh release create` → deploy ritual.
3. Per milestone: hygiene ritual — changelog/README/architecture/UserStory/glossary/plan synced ·
   URLs/env/CLI documented · issues opened/updated/closed · tick the plan-016 Progress
   table · progress report (shipped · next · % · blocked/deferred).
4. **Decide-by-defaults are in the plan — apply them silently; never stall waiting for the owner.**
   Owner-gated items: NONE (courtesy emails to CQC/Give Food are optional follow-ups).

### Gotchas (cost hours this arc — do not relearn)

- **bash quoting:** NO apostrophes inside `bash -c '…'` gh/git message strings (two parse failures).
- **wrangler in `worker/`:** ALWAYS `--config wrangler.toml`; creds = export `CLOUDFLARE_API_TOKEN`
  from root `.env` / `~/.cf-token`. Deploy token has NO Cache-Purge and NO All-Zones (route
  re-assert fallback is benign).
- **Never sweep in the same breath as a deploy:** the edge cached a fallback-HTML asset as
  immutable once (see AGENT_LEARNINGS "Pages SPA fallback…"); `ui/public/404.html` now prevents it,
  but still pre-flight the asset MIME (browser headers — curl can lie per encoding-variant), settle,
  then sweep. A release (`make bump`) rotates the bundle hash via `__APP_VERSION__` if recovery is
  ever needed.
- **Local Chromium page-crashes** under devcontainer memory pressure (parallel claude sessions) ⇒
  dispatch `tier3-monitor.yml` (`gh workflow run`) as the authoritative verifier instead.
- **Blocked fetches:** WebFetch 403/JS-only ⇒ polyfetch env-borrow
  (`uv run --directory ../polyfetch-scrape polyfetch fetch <url> --show-body --max-tier curl_cffi`);
  the CLI does NOT follow 3xx (polyfetch#188).
- **markdownlint MD004:** never let a wrapped line start with `+`/`-`/`*`.
- **CodeFactor is a REQUIRED check** `--admin` cannot bypass; its findings are readable from the PR
  page's embedded model JSON (fetch via polyfetch, key `"Issues":{"List":[…]`).
- Data honesty: labels/officialLink/attribution live in **reviewed TS** (`registry.ts`), never in
  ingested data; a data slip must not be able to alter copy.

### Conventions (hard — unchanged)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) ·
`--no-gpg-sign` · `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · SHA-pin new Actions (pins to copy
are in the plan's CI section) · KISS/DRY/YAGNI/AHA · worker stays TS 6 · strict module-TDD only.

> Plan 015 CLOSED at ≈90% (W6 D1 store, licence gate, W5·B1 monitor, v1.4.0 live+verified); its only
> remainder (NHS-ODS Care + its cron) was TRUD-gated and user-deferred → **migrated here as backlog**.
> The 19-source licence audit (`data/sources.json` `redistribute_ok`) opened a **TRUD-free path**:
> this arc builds the ingest pipeline ONCE and lands real data THREE times, using only keyless,
> redistribution-cleared sources. **Every phase is agent-only — zero owner gates.**

## Progress — queue (tick per merged PR)

| # | Phase | Status |
|---|---|---|
| P0 | Arc mechanics: close 015 · mint this plan + handoff · tracker issue · #113 closed | ☑ #181 |
| P1 | Pipeline: `ingest/seed.py` parsers (TDD) · `ingest.yml` → release asset · CF cron `scheduled()` → D1 shadow→validate→swap · `attribution` surface in labels/render | ☑ #183 |
| P2 | Wander REAL (NHLE + OS Open Greenspace) + freshness-recency e2e assert → release v1.5.0 | ☑ #187 |
| P3 | Care REAL via CQC (flagship; coverage-honest copy) → release v1.6.0 | ☑ #191 |
| P4 | Sort My Food Hygiene — NEW register-only usecase (FHRS) → release v1.7.0 | ☑ #193 |
| P5 | Hygiene: patchright pin · `release.yml` · dead care `category` dropped · env-var ref · D1 deploy docs · FHRS 1900-date honesty fix | ☑ #195 + close-out |

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
validate [`row_count ≥ 50` AND registry `attribution` non-empty for the corpus] → atomic view swap →
stamp `corpus_meta`); module-TDD the pure validate/swap planner against a mocked D1, not the
handler glue.

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
  **Live-verified reality (2026-07-23, supersedes the assumptions above):** OS Greenspace has NO
  GeoJSON offering → GB **GeoPackage** (~59MB) → stdlib sqlite + GPKG-WKB point decode + pure
  OSGB36→WGS84 Helmert (`parsers.py`); the CQC API **403s all unauthenticated clients tried**
  (urllib + browser-impersonated curl_cffi, two sessions; docs still claim keyless — WAF or quiet
  key-gating, unproven) → keyless path = the weekly **`*_CQC_directory.csv`** on the using-cqc-data page
  (link discovered per run; NO ratings carried → copy links out for ratings — cleaner
  signpost-honesty than stale ratings); NHLE = `NHLE_v02_VIEW` FeatureServer layer 0 (Listed
  Building points, London bbox paging). Smoke artifacts: nhle 23.7k · greenspace 12.2k · cqc 9.3k
  · fhrs 62.9k · gazetteer 6.7k rows (407KB).
  Action publishes → CF cron consumes. Attribution surface: `CorpusLabels.attribution` rendered via
  `appendDisclaimer`; the swap validator ALSO refuses a corpus whose registry `attribution` is
  empty — licence obligations as a hard gate, not convention (attribution stays reviewed-TS-only).
  Done-when: dispatched Action produces the asset; triggered cron fills D1
  (shadow→swap, `corpus_meta` stamped); 172+ tests green; D1-off fallback untouched.
- **P2 Wander real** — migration 0002 (nhle/greenspace raw + `wander_places` view), registry
  `d1View` + `VIEW_SQL`, attribution labels, sweep freshness-RECENCY assert. Release v1.5.0.
- **P3 Care real via CQC** — care fed from the directory-CSV rows (geocoded via postcodes.io in
  `seed.py`; the CSV carries no ratings → copy says "regulated by CQC — see the official page for
  current ratings", which is MORE signpost-honest and kills the stale-rating liability); labels +
  coverage honesty; ODS (#161) additive later. Release v1.6.0.
- **P4 Food Hygiene** — register-only proof at scale: corpus + registry + `usecases/
  sort-my-food-hygiene.json` + UI entry + flow. Release v1.7.0.
- **P5 hygiene** — see queue; each its own small PR between phases.

## Backlog (not built this arc)

Scam-via-CH-bulk · **gazetteer widening to full-London postcode units** (ONSPD via the keyless ONS
geoportal; P1 universe = corpus-referenced postcodes + seed set) · Crisis Support (Give Food —
CC-BY, link-back per foodbank, NO list-reorder, NO bulk-contact, courtesy email) · 360Giving
per-RECORD licence pattern · GLA cultural / planning
datasets (conditional) · **#161 TRUD/ODS + verification checklist (user-deferred)** · real-time data
pattern (EA warnings, air, transport) — needs its own ADR.

## Decide-by-defaults (apply silently; owner may override at any checkpoint)

CQC via keyless directory CSV, never the key-gated API (partnerCode default is dead) · ingester
weekly Mon 05:17 UTC + dispatch · release tag `corpus-data` ·
cron daily 04:47 UTC · swap gate = ≥50 rows/corpus + non-empty registry `attribution` · London
filter = postcode-area allowlist
(CQC: localAuthority list) · per-phase releases v1.5.0/v1.6.0/v1.7.0.

## Standing execution contract — e2e hands-off, UNATTENDED

Binds `.claude/rules/unattended-execution.md`: branch+commit per topic → push → squash-merge ONLY on
green CI+tests → prune remote+local · strict module-TDD (RED first; modules only, never
scripts/config/glue) · assume strict lint+typing+sec · e2e via polyfetch/patchright locally AND
remote (viewports, device emulation, click interactive elements, screenshots+videos both
orientations, console/network capture) · deploy ritual: deploy → MIME pre-flight (browser headers) →
edge-settle → sweep → `runs.jsonl` (honest FAILs kept); local page-crash (devcontainer memory) ⇒
dispatch `tier3-monitor.yml` as the verifier — never skip verification · per-milestone hygiene
ritual: docs (changelog/README/architecture/UserStory/glossary/plan) · URLs/env/CLI
documented · issues opened/updated/closed · progress report (shipped · next · % · blocked/deferred).

## Verification

Per PR: `make test` + tsc + eslint(worker/shared/ui) + ruff + markdownlint + CI green. Per phase:
deploy ritual → sweep PASS (markers + freshness recency + 0 model-host + axe 0/0 + 0 console
errors). Pipeline proven by REAL Action + cron runs, never mocks (verify-live rule). Tier-3 monitor
is the standing guard.
