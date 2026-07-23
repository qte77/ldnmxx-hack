---
title: "Handoff 016 — keyless real data; resume at P1 (pipeline). Zero owner gates."
type: handoff
updated: 2026-07-23
pairs_with: docs/plans/016-keyless-real-data.md
---

# Handoff 016 — resume point

**Read [`docs/plans/016-keyless-real-data.md`](../plans/016-keyless-real-data.md) FIRST** — it carries
the full **source map** (seam, store, tests, CI pins, e2e, per-source licence obligations) so do NOT
re-map or re-gather context. Predecessor **015 is CLOSED** (≈90% shipped; remainder migrated here —
see `docs/handoffs/015-*.md` for the historical record). Strategy stands: **signpost, not
adjudicator**; licence-gated self-serve (ADR 0002).

## The one-line why

The 19-source licence audit made TRUD irrelevant for real data: build the ingest pipeline once
(P1), then land real corpora three times — Wander (P2), Care-via-CQC (P3), NEW Food Hygiene (P4) —
all keyless, all `redistribute_ok`, all agent-only.

## ARC CLOSED — 2026-07-23 (P0–P5 all shipped)

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

The rest of this doc is the historical arc record.

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

## How to run this arc (the loop)

1. Branch per topic → module-TDD (RED observed → GREEN) → gates (`make test`, tsc, eslint
   worker/shared/ui, ruff, markdownlint) → push → PR → **squash-merge ONLY on green** → prune
   remote+local.
2. Per phase: deploy (`make deploy`; worker-only/Pages-only when applicable) → **MIME pre-flight
   with browser headers → edge-settle → sweep** (`ui_sweep.py <url> <label>`) → commit the
   `runs.jsonl` line (keep honest FAILs). Release per phase (v1.5.0/6/7): roll CHANGELOG →
   `make bump VERSION=` → PR → tag → `gh release create` → deploy ritual.
3. Per milestone: hygiene ritual — changelog/README/architecture/UserStory/glossary/plan+handoff
   synced · URLs/env/CLI documented · issues opened/updated/closed · tick the plan-016 Progress
   table · progress report (shipped · next · % · blocked/deferred).
4. **Decide-by-defaults are in the plan — apply them silently; never stall waiting for the owner.**
   Owner-gated items: NONE (courtesy emails to CQC/Give Food are optional follow-ups).

## Gotchas (cost hours this arc — do not relearn)

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

## Conventions (hard — unchanged)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) ·
`--no-gpg-sign` · `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · SHA-pin new Actions (pins to copy
are in the plan's CI section) · KISS/DRY/YAGNI/AHA · worker stays TS 6 · strict module-TDD only.
