---
title: "Handoff 015 — start: civic usecase expansion + real data (0/7 not started; 014 shipped+live)"
type: handoff
updated: 2026-07-19
pairs_with: docs/plans/015-civic-usecase-expansion.md
---

# Handoff 015 — resume point

**Read [`docs/plans/015-civic-usecase-expansion.md`](../plans/015-civic-usecase-expansion.md) FIRST.**
Predecessor **014 is shipped + live** on `sortmy.london` — see `docs/handoffs/014-*` (its Source Map, still
the canonical file:line map) and `docs/engineering-practices.md`. 015 broadens the civic usecases and moves
the flagship from synthetic → real data. Tracker: **#113**.

## The one-line why

014 built the civic *product* (task-first landing, Care flagship, perf, strictness, security) — all live.
015 makes it *broader and real*: generalise the engine so a new corpus usecase is register-only
(**W1**, #80); add **Sort My Scam Check** (#74) and **Sort My Wander** (#73); and replace the synthetic
Care corpus with a real ingested NHS directory plus a scheduled re-seed (**W4/W5**, #13/#10). Plus a small **014 carry-over**
(S5 strictness, shared lint, release cut, axe-core, e2e Tier-2 manifest).

## Queue & order

`C` 014 carry-over (quick — S5 knobs each its own PR · shared lint · v1.1.0 tag · axe-core · e2e runs.jsonl)
→ `W1` engine general query-stage + manifest (#80, unblocks the rest) → `W2` Scam (#74) · `W3` Wander (#73)
→ `W4` real Care corpus (#13) · `W5` ingest cron (#10) → `W6` D1 store (only if the corpus outgrows JSON).

## First actions

1. This plan+handoff are step 0 — commit on `docs/015-plan-handoff`, PR, squash-merge on green, prune.
2. Cheapest win first: knock out a **C** item (e.g. `shared/*.ts` lint or the v1.1.0 release cut), then
   start **W1** (the engine generalisation) since W2/W3 depend on it.
3. For each new usecase: register a render/query mode in `worker/src/workflows.ts`, a `usecases/<id>.json`,
   and a corpus; add a `ui/src/App.tsx` `USECASES` entry (civic ones surface; demos stay `?usecase=`); add
   an e2e sweep label. Keep `runUsecase`/`renderBatch` closed (open/closed).

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
  writes `results/<label>/summary.json` (verdict). Full local run needs the user's `CLOUDFLARE_API_TOKEN`
  (worker AI binding); vite-only renders the landing; `_headers`/CSP only live after a Pages deploy.
- **Deploy = Pages-only for UI changes**: `wrangler pages deploy ui/dist --project-name sortmy-london
  --branch main`. Worker-route re-assert wants Zone→Workers-Routes→Edit (else benign code 10000).

## Open / context

`sortmy.london` live (014 in). `MEMORY.md` at repo root = stray auto-memory (gitignored, #116; do not
commit). Legacy-showcase issues closed in 014 triage; the civic-relevant backlog is this plan / #113.
