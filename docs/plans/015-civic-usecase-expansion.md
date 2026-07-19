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
| W1 | Engine: general query stage + workflow manifest (#80) — make a new corpus usecase register-only | ☐ to ship |
| W2 | Sort My Scam Check (#74) — clone-firm fraud **flag** (Companies House / FCA), never a verdict | ☐ to ship |
| W3 | Sort My Wander (#73) — free/obscure heritage discovery (Historic England / OSM / Wikidata) | ☐ to ship |
| W4 | Real Care corpus (#13) — replace synthetic `data/care/*` with an ingested NHS directory + freshness | ☐ to ship |
| W5 | Ingest cron (#10) — scheduled re-seed (CF Cron Trigger); pairs with the e2e Tier-3 monitor | ☐ to ship |
| W6 | Data store (#13) — CF **D1** only if the corpus outgrows bundled JSON | ☐ to ship |
| C | **014 carry-over** (small; do first / in parallel) — see below | ☐ to ship |

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
- **W6 · Data store (#13).** If the ingested corpus outgrows a bundled JSON, move it to **CF D1**; the query
  exec reads D1 instead of the JSON import. Only when W4 forces it (YAGNI until then).

## C — 014 carry-over (small; independent of the above)

- **S5 · deepest strictness (plan 014):** `verbatimModuleSyntax` · `noPropertyAccessFromIndexSignature` (both
  tsconfigs) · `eslint-plugin-jsx-a11y` (ui) · `eslint-plugin-security` (worker) · `eslint-plugin-unicorn`
  (curated, both). **Each knob its own PR; expect a fix wave** like S3/S4.
- **`shared/*.ts` lint** — `guard.ts`/`sanitize.ts` are security-critical and still unlinted (S3 was
  worker-only). Small cross-dir eslint setup.
- **Release cut** — tag **v1.1.0**, move CHANGELOG `[Unreleased]` under a dated heading (`make bump`).
- **axe-core in the e2e sweep** — inject axe for a concrete WCAG pass/fail (today: aria snapshot only).
- **e2e Tier-2 handoff** — a committed `tests/e2e/runs.jsonl` manifest so an in-flight/long sweep resumes
  across sessions (summary.json already lands per run; #116).

## Order · conventions · verification

- **Order:** C (carry-over, quick) → W1 (engine, unblocks the rest) → W2/W3 (new usecases) → W4/W5 (real
  data + cron) → W6 (store, if forced). Each usecase adds its e2e sweep label + screenshots.
- **Conventions (hard, unchanged from 014):** branch-per-topic → Conventional Commits → CI-gated PR →
  squash-merge `--admin` **only on green** → **prune**. `env -u GH_TOKEN -u GITHUB_TOKEN` · noreply ·
  `--no-gpg-sign` (rebase: `-c commit.gpgsign=false`) · SHA-pin Actions · **strict module-TDD** (tests first
  for load-bearing modules only) · assume strict lint+typing+sec · worker stays on **TS 6** (eslint compat).
- **Verify per usecase:** `make test` + `tsc` + `eslint` (ui+worker) + markdownlint + the e2e sweep clean
  (0 model-host, a11y heading/button, `summary.json` PASS); "signpost not advice" disclaimer + freshness
  present; deterministic honesty (`USAGE mode:demo`). Real data ToU-gated + gitignored.
