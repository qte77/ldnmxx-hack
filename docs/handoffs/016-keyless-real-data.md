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

## State at handoff (2026-07-23)

- **Live:** v1.4.0 on `sortmy.london` (sweep-verified); D1 `sortmy_london_corpus` bound + EMPTY +
  fail-safe-verified (#171); Tier-3 monitor sweeping 6-hourly (`tier3-monitor.yml`).
- **Shipped by 015 (don't rebuild):** `CorpusSource` seam + `VIEW_SQL` whitelist + empty-store
  fallback; migration 0001; licence matrix in `data/sources.json`; glossary/ADR 0002/archive docs.
- ☐ **P0 finishes with this PR** (015 closed, 016 minted, tracker issue, #113 closed).
- **NEXT = P1**: `ingest/seed.py` parsers (pytest, RED first) → `ingest.yml` → release asset
  `corpus-data` → CF cron `scheduled()` → D1 shadow→validate(≥50 rows + non-empty registry
  `attribution`)→swap→`corpus_meta`.
- **P1 in flight (2026-07-23, branch `feat/016-p1-ingest-pipeline`):** worker half + parsers +
  seed.py + ingest.yml built and smoke-verified live (artifacts: nhle 23.7k · greenspace 12.2k ·
  cqc 9.3k · fhrs 62.9k · gazetteer 6.7k). **Source reality shifted — see plan P1 details:** CQC
  API is key-gated → keyless directory CSV; OS Greenspace = GeoPackage (BNG→WGS84 in parsers);
  NHLE = `NHLE_v02_VIEW` layer 0. Remaining: PR → green merge → dispatched-Action + triggered-cron
  live prove.

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
