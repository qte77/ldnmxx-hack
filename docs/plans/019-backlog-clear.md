---
title: "Plan 019 — backlog clear: gazetteer widen · ops watchdog · deps · gated (TRUD/ESLint10) · Track A scope"
type: plan
status: "open (2026-07-25) — minted after 018 shipped (v1.9.0). Clears the entire post-018 backlog in one arc, Phase A/B/C shaped."
refs: ["#185 (gazetteer ONSPD widen)", "#199 (freshness watchdog)", "#168 (deps)", "#150 (jsx-a11y/ESLint10)", "#161 (real Care via ODS/TRUD)", "#8 (Track A Open311)", "ADR 0002 (read-through store / redistribute_ok)"]
---

# Plan 019 — backlog clear

## Context (why)

Arc 018 (v1.9.0) shipped all its polish; the six remaining issues are unrelated backlog. Owner asked to
fold ALL into one arc. Honest sequencing per the Phase A/B/C shape: front-load every agent-runnable item
(A), pre-stage the two gated ones (B — a TRUD account, an upstream ESLint-10 release), and make a scope
call on the one real feature (#8). **Highest user-value item = #185** (today only ~6,656 postcodes are in
the D1 gazetteer, so most London postcodes resolve to "no data").

## Progress — queue (tick per merged PR)

| # | Item | Phase | Status |
|---|---|---|---|
| P1 | **#185 gazetteer widen** — full-London ONSPD postcode units | A (agent) | ☐ |
| P2 | **#199 freshness watchdog** — alert when the 04:47 ingest cron goes stale | A (agent) | ☐ |
| P3 | **#168 deps** — drop `sharp` override; assess TS 7 + zod 4 | A (agent chore) | ☐ |
| P4 | **#161 real Care corpus (NHS ODS/TRUD)** — build DORMANT behind the TRUD credential | B (owner-gated) | ☐ |
| P5 | **#150 jsx-a11y** — adopt once eslint-plugin-jsx-a11y supports ESLint 10 | BLOCKED (upstream) | ☐ watch |
| P6 | **#8 Open311 read-only slice** — DEFERRED: needs a live fetch to council/FixMyStreet endpoints ("no live to others for now") | deferred | ☐ |

## ⚠ CONSTRAINT + OPEN DECISION (owner, 2026-07-25) — READ FIRST

**Owner constraint: "we don't want to fetch data live from other sources as of now."** This BLOCKS all
three DATA items — each needs a live/one-off external fetch: **#185** (ONSPD from ONS), **#161** (NHS
TRUD), **#8** (Open311 councils). It does NOT tear down the existing daily cron (the current corpora stay
live) — it holds off ADDING new external fetching.

**Runnable NOW with no external fetch (do these):** **#199** freshness watchdog (reads only our own D1
`corpus_meta`) and **#168** deps (npm only). These override the queue's Phase-A row for #185.

**OPEN owner decision for #185 (pick BEFORE building it):**
- **A —** ONE-TIME committed ONSPD-London import: owner downloads ONSPD once (or hands over the file); we
  process + COMMIT the full-London gazetteer as static data and load it into D1 via a migration. NO
  recurring external fetch — same "committed reference data" pattern as the sample corpora, just complete.
  Coverage 6,656 → full London. **(recommended — delivers #185's value within the constraint.)**
- **B —** defer all three data items (#185/#161/#8) → arc 019 = **#199 + #168** only.
- **C —** rescope further (e.g. pause the existing cron too — owner to specify).

**#161 and #8 stay deferred** under this constraint regardless (both need external fetching). The
per-item source maps below still apply for when external fetching is back on the table.

## Phase A — agent-runnable now (do these first, in order)

### P1 · #185 gazetteer widen (highest value)
- **Why:** `ingest/seed.py:main()` builds `universe = {CQC postcodes} | {6-postcode seed set}` (~lines
  188–194) → the D1 `postcodes` table has only **6,656** rows, so most London postcodes miss. Widen it.
- **Approach (KISS):** ingest **ONSPD** (ONS Postcode Directory — every UK postcode WITH lat/long, **OGL**)
  from the ONS Open Geography Portal, **filter to London**, and build the gazetteer from it. ONSPD already
  carries coordinates → **no postcodes.io bulk geocode needed** for the widened set (fewer subrequests).
- **STEP 1 (research, do first):** confirm the current ONSPD download URL + file layout on the ONS Open
  Geography Portal (a zipped CSV; key columns: `pcds` postcode, `lat`/`long` or `oseast1m`/`osnrth1m` BNG,
  `oslaua` local-authority code, `doterm` = terminated-date null⇒live). Prefer the columns that give WGS84
  lat/long directly; if only BNG, reuse `parsers.py` `bng_to_wgs84`. Filter to London by `oslaua` ∈ the 33
  London borough codes (or fall back to `parsers.py` `_in_london(lat,lng)` / `GREATER_LONDON_BBOX`), and
  drop terminated postcodes (`doterm` non-null) + NI/BT (licence, mirror `parse_postcodes`).
- **Source map:**
  - `ingest/parsers.py` — add `parse_onspd(rows) -> [{postcode, lat, lng}]` (pure, **RED-first** in
    `ingest/tests/test_parsers.py` with a small captured-real fixture). Reuse `bng_to_wgs84` if BNG-only.
  - `ingest/seed.py` — add `fetch_onspd()` (mirror `fetch_greenspace`'s zip-download pattern with
    `fetch_bytes` and `zipfile`); in `main()` set `gazetteer` from ONSPD-London (keep `with_outcodes`), keep the CQC
    universe as a fallback for any CQC postcode not in ONSPD (rare). Raise `FLOORS["postcodes"]` from 1000
    to a realistic London floor (verify the real count first — London has ~O(10^5) live units).
  - `data/sources.json` — add ONSPD with `license: OGL`, `redistribute_ok: true`, `last_checked`.
  - `ingest/README.md` / CHANGELOG — document the new source.
- **Done-when:** ingest run publishes a `postcodes.json` with ~O(10^5) London rows (floor passes); the
  04:47 cron swaps it into D1; `SELECT COUNT(*) FROM postcodes` jumps from 6,656; a **previously-failing**
  central London postcode (pick one NOT in today's seed set) now resolves + renders LIVE; ADR-0002
  fetch-free hot path intact (postcode lookup is a PK exact match — no perf concern at 10^5 rows).

### P2 · #199 freshness watchdog
- **Why:** if the 04:47 ingest cron silently dies, D1 serves stale data invisibly.
- **Source map:** new `.github/workflows/freshness-watchdog.yml` — mirror `tier3-monitor.yml` (schedule +
  `workflow_dispatch`, `issues: write`) plus `d1-verify.yml`'s D1 read (needs the existing
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets). Query `SELECT corpus, ingested_at FROM corpus_meta`; if any
  `ingested_at` is older than ~48h, `gh issue create`/`comment` the alert (same open-or-update pattern as
  tier3-monitor's failure step). SHA-pin every action (repo policy). **Glue → verified by a dispatch run**,
  no unit test.
- **Done-when:** a dispatched run reports all corpora fresh (green); the stale branch is exercised (e.g.
  a temporary 0h threshold dispatch opens the alert issue, then revert).

### P3 · #168 deps
- **Source map:** `ui/package.json` + `worker/package.json` (check the `overrides`/`resolutions` for
  `sharp`; drop it, run `npm ci` + `npm audit --omit=dev --audit-level=high` — if still green, keep dropped).
  `.github/dependabot.yml` (the TS + zod ignores) — assess TS 7 + zod 4: bump when the ui/worker typecheck
  and tests pass, else keep the ignore and note why. **Done-when:** `sharp` override gone (or a one-line why-kept);
  TS7/zod4 either adopted (green) or an explicit deferral note; CI green.

## Phase B — owner-gated / blocked (pre-stage; activate on the gate)

### P4 · #161 real Care corpus (NHS ODS/TRUD) — needs a TRUD account (owner provisions)
- **Build-behind-gate:** write the ODS ingest DORMANT — `ingest/parsers.py` `parse_ods()` (RED-first over a
  captured TRUD sample), `ingest/seed.py` `fetch_ods()` behind an `ODS_TRUD_KEY` env/secret; the `care`
  corpus's `d1View` (`care_signposts`) already exists (ADR 0002) — ODS just fills `nhs_services` with real
  rows instead of the CQC-directory sample. `data/sources.json` ODS: `access: free-key`, verify
  `redistribute_ok` against the TRUD/ODS licence (NHS live Directory of Services is `redistribute_ok: no`
  — use the ODS **bulk** OGL equivalent per ADR 0002). **Owner gate:** provision a TRUD account + add the
  secret. **Done-when:** code + tests ready; activates when the credential lands (a swept live care query
  returns real ODS-backed rows).

### P5 · #150 jsx-a11y — BLOCKED upstream
- `eslint-plugin-jsx-a11y` does not yet support ESLint 10. **Action = watch**, not implement. Keep the
  issue open; adopt when upstream ships. No agent work possible now beyond a periodic upstream check.

## Phase C — deferred (owner decisions recorded)

### P6 · #8 Open311 — DEFERRED (owner: read-only slice preferred, but "no live to others for now")
- **Owner decisions (2026-07-25):** (1) scope = the READ-ONLY slice ("nearby OPEN civic reports near a
  postcode"), NOT the write/`file_report` feature — the write path is its own future arc + a live-write
  ADR + a positioning call (signpost→action). (2) But **no live third-party fetch for now** — and even the
  read-only slice needs a live GET to a council / FixMyStreet Open311 endpoint (unlike our other sources,
  which are bulk gov-data DOWNLOADS). A synthetic "fake reports" corpus would risk the product's honesty
  (real user, fabricated reports) — rejected. **So #8 is DEFERRED** until ready to go live to councils. Do
  NOT build it in arc 019.
- **Design captured for when unblocked (read-only slice — mirrors the food-hygiene 016-P4 register-only
  add, ZERO engine edits):** `ingest/parsers.py` `parse_open311(responses) -> [CorpusRecord]` (RED-first:
  service_request → `{id, name: summary, authority: <council>, why: "<status> · <category>", officialUrl:
  <report url>, lastUpdated: requested_datetime→ISO, lat, lng}`; filter `_in_london`); `ingest/seed.py`
  `fetch_open311` (keyless GeoReport-v2 `GET requests.json?status=open&…`, source TBD — FixMyStreet
  aggregator or a borough endpoint, licence → `data/sources.json`); `worker/migrations/000N_open311.sql`
  (raw table + corpus view, mirror `0004_food_hygiene.sql`); `usecases/sort-my-reports.json`
  (`render.mode:"corpus"`, keywords `["pothole","report","fault","graffiti","fly-tipping","street issue"]`,
  example, blurb, a `query_corpus` stage) registered in `worker/src/usecases.ts` + `shared/usecaseCatalog.ts`;
  `worker/src/corpus/registry.ts` new corpus (labels + glyph 🛠️ + `dateLabel` + `d1View`); a
  `tests/e2e/flows.json` flow.
- **When ready:** revisit the "live to others" stance (reports are semi-dynamic → a daily cron snapshot is
  honest per ADR-0002; NOT a real-time feed). The write half (`file_report` + ReportCard) stays its own arc.

## Standing execution contract (unchanged from 018)

Branch per topic → strict module-TDD (RED first; glue/CSS/copy/CI → e2e/dispatch) → gates (`npm --prefix
worker|ui …` lint/typecheck/test[/build/size] · `uvx ruff@0.15.22 check` · `uvx pytest -q ingest` · semgrep
· markdownlint via `rtk proxy npx … <files>`) → push → PR → CI green → squash-`--admin` on green → `git
switch main && git pull` → per data/deploy phase: `make deploy` + tier3 sweep. Creds repo-self-contained
(`.env` token-only). Conventional Commits · noreply · `--no-gpg-sign` · `env -u GH_TOKEN -u GITHUB_TOKEN`.
See `docs/handoffs/019-backlog-clear.md` for onboarding + the env watch-outs.
