---
title: "Plan 018 — post-launch polish: input forgiveness, honesty, config-separation, UX"
type: plan
status: "open (2026-07-25) — P1/P2/scam/P3/P4/P5b SHIPPED+deployed+live-verified; P5 code done on branch fix/018-p5-visual-ux (@e91f215, gates green) needs PR→merge→deploy→owner screenshot review; then P6 release v1.9.0. Resume via docs/handoffs/018."
refs: ["#223 (018 tracker)", "#224 (P2 outward postcodes)", "#225 (P3 date honesty)", "#201 (017 tracker, closed-out)", "ADR 0002 (bounded reads / record dates)", "#185 (gazetteer widening)", "#199 (freshness watchdog)", "plan 017 (deployed)"]
---

# Plan 018 — post-launch polish

## Context (why)

Arc 017 shipped the single-input UX + auto-router + theme and **deployed to `sortmy.london`**. Live
testing (2026-07-24) surfaced a coherent set of follow-ups — the single free-text input *invites*
natural input that the postcode-only backend, the composite index, and the flat card design don't yet
serve well. This arc fixes them, in priority order (correctness/honesty first, polish last).

**Honest caveat carried from 017:** P2b claimed a "≥10× row-read cut" but the LIVE measurement (below)
showed the shipped 5 km-first widen gives only ~1.2× for dense central corpora. The fix is small (start
the widen at 0.5 km) but the *claim* was wrong; P1 corrects both the code and the docs.

## Progress — queue (tick per merged PR; progress report after each)

| # | Phase | TDD boundary | Status |
|---|---|---|---|
| P0 | Mint arc (plan + handoff + tracker + issues) | docs | ☑ #226 (tracker #223, bugs #224/#225) |
| P1 | **Row-read correction** — widen starts at 0.5 km; correct the false ≥10× claim; re-measure LIVE | constant + LIVE measure; docs | ☑ #230 (LIVE 3,248 ≤4k, 11.3×) |
| P2 | **Input forgiveness — outward postcodes** (SE1, E8): the broken-example bug | **MODULE** `shared/sanitize` → RED-first · gazetteer data | ☑ #233 (0006 applied + durable) |
| scam | **Scam natural-language match** — "is X a scam" resolves (found by the P1 live sweep) | **MODULE** `matchFirms` → RED-first | ☑ #232 |
| P3 | **Record-date honesty** — heritage shows a listing date, not "data as of 1974" | render label + per-corpus `CorpusLabels` → RED-first | ☑ #234 |
| P4 | **Config/code separation** — one shared usecase catalog (kills the UI `routable`/`example` drift) | **MODULE**/data → RED-first | ☑ #235 |
| P5 | **Visual/UX pass** — distances, glyphs, chips, rotating placeholder, progressive hero, sources expander, de-dupe | CSS/copy/glue → **e2e + axe** | ☑ #237 |
| P5b | **No-match card — "type this" vs "open this"** — founders/route get a blurb + `?usecase=` link | render + copy → e2e | ☑ #236 |
| P6 | **Release v1.9.0** (single release for all of 018; v1.8.0 folded here) | docs · issues | ☐ in progress |

## LIVE measurements (2026-07-24, prod food_hygiene = 66,871 rows) — the P1 evidence

| widen box | rows_read | cut | in-box rows |
|---|---|---|---|
| 5 km (shipped) | 55,201 | 1.2× | — |
| 1 km | 8,144 | 8.2× | 946 |
| **0.5 km** | **3,810** | **17.5×** | 249 |

`EXPLAIN QUERY PLAN` on the bbox query already shows
`SEARCH fhrs_establishments USING INDEX idx_fhrs_establishments_lat_lng (lat>? AND lat<?)` — the index
(migration `0005`) works; a composite B-tree can only range the **leading** column, so the win depends
on a SMALL first box. **No cell column needed** (KISS): 0.5 km clears the ADR-0002 ≥10× target.

## Carried from 017 (owed live verifications — do in P1's deploy ritual)

017 deployed but two verifications were never run and must not be stranded:

- **First LIVE remote sweep** against `sortmy.london` — `ui_sweep.py` (typed-ask routing markers + the
  3-variant × light/dark axe matrix + no-match flow), and **commit the `runs.jsonl` line** (honest
  FAIL kept if any). Only a lightweight liveness/MIME check ran post-deploy; the full sweep is owed.
- **016 `corpus_meta` freshness check** — `wrangler d1 execute DB --remote --config wrangler.toml
  --command "SELECT * FROM corpus_meta" --json` (confirm the 04:47 UTC cron advanced `ingested_at`).

## Phases — TDD rule: load-bearing MODULES get RED-first tests; glue/config/copy/CSS are verified by e2e

- **P1 Row-read correction.** `worker/src/corpus/query.ts` `WIDEN_KM` `[5,15]` → `[0.5, 2, 8]` (a tuning
  constant — existing `corpus.bbox.test.ts` still covers the widen logic; no new unit test). **Correct
  the docs** that over-claim (CHANGELOG P2b entry, ADR 0002 "bounded reads" consequence) to state the
  real numbers + that the win comes from the small first box. Redeploy the Worker, then run the two
  **carried 017 verifications above** as part of the deploy ritual. **Done-when:** LIVE `d1-verify -f
  check=bbox_rows_read` (or a direct `--remote` measure) on food-hygiene reads ≤ ~4k (≥10×); docs match
  reality; sparse corpora still answer (widen); the live sweep is committed to `runs.jsonl` and
  `corpus_meta` is confirmed fresh.

- **P2 Input forgiveness — outward postcodes** (the `food hygiene near SE1` bug — SE1 is the app's own
  placeholder, yet fails). **MODULE (RED-first):** extend `shared/sanitize.ts` to accept an OUTWARD-only
  code (`SE1`, `E8`, `N1`, `SW1A`) when no full postcode is present, returning a normalised token; a full
  postcode still wins. **Data:** the gazetteer needs outcode centroids — add them to the bundled sample
  gazetteers (`data/*/postcodes.sample.json`) AND to D1 (a migration `INSERT … SELECT <outcode>,
  AVG(lat), AVG(lng) … GROUP BY <outcode>` over the seeded postcodes, or via the ingester — decide by
  measurement of centroid quality on the sparse gazetteer). **Done-when:** RED→GREEN for the outward
  parse; `food hygiene near SE1` resolves + renders live; the placeholder example works. Note ADR 0002
  fetch-free hot path is INTACT (outcode centroids are pre-computed data, no live geocode).

- **P3 Record-date honesty** (`data as of 1974-08-08` on wander). `worker/src/corpus/render.ts:25` shows
  `q.asOf` (oldest `lastUpdated`) as "data as of"; for heritage (NHLE listing dates ~1949) that CONFLATES
  the record's own age with data freshness — the P3-copy-spec constraint #1. **Fix:** a per-corpus date
  label in `CorpusLabels` (e.g. heritage → `listed {year}` or omit; CQC/FHRS → `inspected {date}`);
  drop the bare "data as of" where the record date isn't freshness. **RED-first** for the label chooser
  (pure). **Done-when:** wander no longer advertises "data as of 1974"; each corpus's date line matches
  its date semantics; the two dates (snapshot vs record) are never conflated.

- **P4 Config/code separation — one usecase catalog.** Today the worker registry (`usecases/*.json` +
  keywords) and the UI (`App.tsx` `USECASES`: label/example/`routable`) are TWO sources that drift —
  the `routable` flag literally duplicates keyword-presence. **Fix:** a single shared catalog
  (`{id, title, keywords, example, blurb}`) in `shared/` or `data/`, consumed by BOTH the worker
  `routableUsecases`/`usecaseCatalog` and the UI. Note `blurb` is carried for EVERY usecase (incl. the
  never-auto-routed `founders-copilot`/`sort-my-route`), for the no-match card (P5). **MODULE
  (RED-first):** the shared loader + validator. **Done-when:** no duplicated usecase config; `routable`
  is derived (keywords present), not re-declared; adding a workflow is ONE edit; register-only property
  (ADR 0001) preserved end to end.

- **P5b No-match discovery card — "type this" vs "open this".** The card lists every workflow, but the
  never-auto-routed ones (`founders-copilot`, `sort-my-route`) currently show a BARE title while the
  routable ones show `e.g. <keywords>`. Giving the bare two a typed `e.g.` example would advertise an
  input that no-matches (the SE1 trap) — they have no keywords ON PURPOSE. **Fix:** render two kinds —
  routable → `type: <keywords>`; non-routable → its `blurb` (P4) + a **`?usecase=` link** ("open →").
  Server-rendered A2UI (`worker/src/a2ui/cards.ts` `buildNoMatchCards`), so a markdown link is enough;
  no client change. **Done-when:** founders/route are discoverable from the no-match card via an
  accurate "open" affordance, never a fake typed keyword; e2e asserts the link, not a keyword line.

- **P5 Visual/UX pass** (the "dull + complicated" critique — CSS/copy/glue, so **e2e + axe are the test,
  no unit tests**). Address, roughly in impact order: (a) human distances (`0 km` → `<50 m` / `~2-min
  walk`); (b) progressive hero (full dek/microcopy on the EMPTY state; collapse after a search so results
  lead); (c) collapse licence attributions behind a "Sources & licence" expander; (d) de-dupe result
  cards (lift the shared type into a tag/summary); (e) per-workflow glyph + stronger title scale + link
  the title to the official page; (f) suggestion chips on the empty state; (g) rotating example
  placeholders (routable examples only — each a working input). **Done-when:** the sweep's variant×scheme
  axe matrix stays 0/0; the page reads differentiated + front-loads results; every advertised example
  resolves.

- **P6 Release v1.9.0.** Full docs sync + issues + `make bump` + tag + GH release + live sweep PASS.

## The v1.8.0 tag — OWNER GATE (decide-by-default below)

017's code is deployed but **untagged** (prod footer still shows v1.7.0). Two options:
1. **Tag v1.8.0 now for 017** (deployed state) with honest release notes naming the caveats (row-read
   ~1.2× until P1, SE1 until P2), then 018 ships as v1.9.0. Cleanest versioning (deployed = tagged).
2. **Hold the tag** until 018 P1–P3 (row-read + SE1 + date) land, then tag v1.8.0 covering 017 + the
   must-fixes — so the released version never errors on its own example.
**Decide-by-default: option 2** (hold), because the SE1 self-example failure is the kind of first-run
bug a release shouldn't carry. Owner overrides at any point.

## Source map (verified 2026-07-24, file:line)

- **Row-read:** `worker/src/corpus/query.ts:49` `WIDEN_KM`; `source.ts` bbox SQL; migration `0005`.
- **Outward postcode:** `shared/sanitize.ts:10` `UK_POSTCODE` regex + `normalisePostcode`; gazetteer
  `data/{care,wander,food-hygiene}/postcodes.sample.json`; D1 `postcodes` table (migration 0001);
  `worker/src/corpus/source.ts` `origin()`.
- **Record date:** `worker/src/corpus/render.ts:25` (`data as of ${q.asOf}`); `dates.ts` `oldestIsoDate`;
  `CorpusLabels` in `worker/src/corpus/contract.ts` + `registry.ts` (per-corpus labels).
- **Catalog drift:** `ui/src/App.tsx` `USECASES` vs `worker/src/usecases.ts` `routableUsecases`/
  `usecaseCatalog` + `usecases/*.json` `keywords`.
- **UX/render:** `worker/src/a2ui/cards.ts` (`cardsBatch`, `disclaimerCard`, `buildCorpusCards` via
  `corpus/render.ts`); `ui/src/index.css` `.a2ui-surface`; `ui/src/theme/a2uiTheme.ts`; `tokens.css`.
- **e2e:** `tests/e2e/ui_sweep.py` (typed-ask + variant×scheme axe matrix), `tests/e2e/flows.json`.

## Standing execution contract (unchanged from 017)

Branch per topic → strict module-TDD (RED first; modules only, glue/CSS/copy → e2e) → gates
(`make test` + tsc + eslint worker/shared/ui + ruff + markdownlint + semgrep) → push → squash-merge on
green (`--admin`, never touch rulesets) → prune. Per phase: deploy → MIME pre-flight → sweep →
`runs.jsonl` (honest FAILs kept). Creds are repo-self-contained (`.env`; no `~/.cf-token`; account_id in
`wrangler.toml`). Conventional Commits · noreply · `--no-gpg-sign` · `env -u GH_TOKEN -u GITHUB_TOKEN`.
