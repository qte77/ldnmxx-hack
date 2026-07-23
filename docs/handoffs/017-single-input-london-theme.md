---
title: "Handoff 017 — one input, London-themed. Start at P1 (theme). Zero owner gates."
type: handoff
updated: 2026-07-23
pairs_with: docs/plans/017-single-input-london-theme.md
---

# Handoff 017 — resume point

**Read [`docs/plans/017-single-input-london-theme.md`](../plans/017-single-input-london-theme.md)
FIRST** — it carries the full **source map** (theme files, the single routing resolution point, the
reuse points, e2e) with `file:line` refs, so do **NOT** re-map or re-gather context. Predecessor
**016 is CLOSED** (5 real corpora live in D1, 118,810 rows; v1.7.0 deployed).

## The one-line why

Two owner decisions: (1) **one input** — the user types a free-text ask and the app picks + builds
the workflow (no manual switcher); (2) **not flat EyeRest** — adopt the fo `linear.css` system with
three trademark-safe **London accent variants**, light + dark, everything self-hosted.

## State at handoff (2026-07-23)

- **Live:** v1.7.0 on `sortmy.london`; 5 corpora in D1; daily ingest cron batched under the
  subrequest cap (#197); tier3 monitor green.
- ☐ **P0 finishes with this PR** (plan + handoff + tracker **#201** + ADR stubs).
- **NEXT = P1 (theme)**: `tokens.css` EyeRest→fo Linear neutrals + `[data-variant]` A/B/C blocks
  (light+dark), `@fontsource/jetbrains-mono` re-added, `variant-init.js` + cycle control mirroring
  the existing theme toggle. **ADR 0005.** Then P2 router → **P2b bbox prefilter** → P3 UI/wording
  → P4 release v1.8.0.
- **P2b is a hard prerequisite for P3, not an optimisation.** Corpus queries read the WHOLE view
  today (66,871 rows for food-hygiene) against D1's 5M row-reads/day ⇒ ~75 asks/day. P3's free-text
  input invites exploratory asking, so the bbox prefilter must land BEFORE the UI ships.
- **P2b ships an INDEX MIGRATION or it is a no-op.** The store has no indexes at all
  (`git grep -in "create index" -- worker/migrations` → nothing) and D1 bills rows **scanned**, so
  a bare `WHERE lat BETWEEN …` still scans 66,871 rows. Prove the win with `meta.rows_read` from a
  `--remote` query, never a mocked-D1 call count — a stub cannot model scanning and would go green
  on a production no-op. Full spec in the plan's P2b bullet.

## Carried over from 016 — do this first, it is quick

- **Verify the real 04:47 UTC edge cron populated D1 at full load:**
  `cd worker && ./node_modules/.bin/wrangler d1 execute DB --remote --config wrangler.toml
  --command "SELECT * FROM corpus_meta" --json` — every `ingested_at` should have advanced past
  2026-07-23T18:22Z. **The `db.batch()` fix already shipped (#197, live-verified)**, so this is
  confirmation, not remediation. If stamps did NOT advance, the cause is something else (asset
  fetch, CPU time) — check the Worker logs before changing insert code.
- Parallel/unblocked backlog: **#185** (gazetteer is 6,656 units vs London's ~180k+ — the one row
  count that is too SMALL), **#199** (freshness watchdog — a dead cron is currently invisible).

## Read the plan's "Binding corrections from the P0 review" section

Five corrections found reviewing the plan; the biggest: **never auto-route to `sort-my-route`** —
its render is canned and origin-agnostic, so auto-routing it would answer a real journey question
with a fabricated one. Also: suggestions must appear in the INITIAL empty state (the switcher was
the only discovery surface), router keywords belong on `CorpusDef` (keeps corpora register-only),
and P1 is bigger than it looks (A2UI card restyle + `ui_sweep.py` variant/axe iteration).

## Decisions already made — do NOT re-litigate

- **All three accents ship as selectable variants**, default **A Thames Teal** `#0e7581`/`#2ea9b6`
  (B Heritage Indigo `#4b53c4`/`#5e6ad2`, C Westminster Green `#2f6f4f`/`#4fae82`). The owner chose
  the fuller scope *after* an explicit KISS/YAGNI challenge.
- **Hybrid router** (heuristic + model escalation) — also chosen after the YAGNI challenge.
- **No agent framework** (ADR 0003). Pydantic-AI is Python (dead on a TS Worker); Vercel AI SDK
  assumes `process.env` + bundle cost; reuse `callModelTool`/`runChain`/zod instead.
- **No silent flagship default.** An unrecognised ask → *"I didn't understand — here's what I can
  help with"* + suggestions + the use-case list. **`founders-copilot` IS offered there** (never
  auto-routed). This is why the usecase catalog stays as DATA even though the switcher control goes.
- **`?usecase=` remains a bypass** (deep links + founders demo). **Keep `sortmy.london`.**

## How to run this arc (the loop)

1. Branch per topic → module-TDD (**RED observed → GREEN**; modules only — CSS/config/copy/glue are
   verified by e2e, not unit tests) → gates (`make test`, tsc, eslint worker/shared/ui, ruff,
   markdownlint, semgrep) → push → PR → **squash-merge ONLY on green** → prune remote + local.
2. Per phase: deploy → **hash-asserting MIME pre-flight (browser headers)** → edge-settle → sweep
   (`uv run --project /workspaces/qte77/polyfetch-scrape python tests/e2e/ui_sweep.py <url> <label>`
   from the repo root) → commit the `runs.jsonl` line (**keep honest FAILs**).
3. Per milestone: hygiene ritual — CHANGELOG/README/architecture/UserStory/glossary/ADR/plan+handoff
   synced · URLs/env/CLI documented · issues opened/updated/closed · tick the plan Progress table ·
   **progress report** (shipped · next · % · blocked/deferred).
4. **Decide-by-defaults are in the plan — apply them silently; never stall.** Owner gates: NONE
   (only the one-per-session `--admin` merge go-ahead).

## Gotchas (inherited + new — do not relearn)

- **Body reads once:** the classifier needs `prompt` BEFORE `getUsecase` resolves at
  `worker.ts:438`, but `readRunBody` runs at `:448`. Move the body-read earlier in `fetch()` and
  thread it into both the router and `resolveRun`. This is the one real refactor in P2.
- **`tokens.css` is vendored** from `qte77/brand` and says "don't hand-tune — re-vendor upstream".
  ADR 0005 deliberately breaks that; **do not "fix" it by re-vendoring EyeRest.**
- **e2e sweep manifest must match what's deployed** — a flow for an unshipped feature FAILs honestly
  (016 hit this). Verify from the branch matching live, or expect the FAIL.
- **Recency/marker asserts:** compute expected values with the APP's own origin + metric, never an
  offline approximation (016 lost a sweep to a 330 m-off marker).
- **wrangler in `worker/`:** ALWAYS `--config wrangler.toml`; creds from root `.env` / `~/.cf-token`.
- **markdownlint MD004:** never let a wrapped line start with `+`/`-`/`*`.
- **CodeFactor is a REQUIRED check** `--admin` cannot bypass.
- **No apostrophes inside `bash -c '…'`** gh/git message strings; avoid heredocs in Bash (classifier).
- Data honesty: labels/officialLink/attribution live in **reviewed TS**, never in ingested data.

## Conventions (hard — unchanged)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) ·
`--no-gpg-sign` · `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · SHA-pin new Actions · KISS/DRY/
YAGNI/AHA · worker stays TS 6 · strict module-TDD only · **self-host all js/css/fonts (no CDN)**.
