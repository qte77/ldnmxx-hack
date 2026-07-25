---
title: "Handoff 018 — resume at: deploy P5 (branch pushed), then P6 release v1.9.0. Everything else shipped."
type: handoff
updated: 2026-07-25
pairs_with: docs/plans/018-polish-input-honesty.md
---

# Handoff 018 — resume point

**Read [`docs/plans/018-polish-input-honesty.md`](../plans/018-polish-input-honesty.md) too** — it holds
the per-phase source map + LIVE measurements. This handoff onboards you to WHAT is done and HOW to finish.

## Onboarding — the 30-second picture

Arc 018 = post-launch polish (input forgiveness · honesty · config-separation · UX). **7 of 8 items are
merged, deployed to `sortmy.london`, and live-verified.** Only **P5's PR merge+deploy** and **P6 (release
v1.9.0)** remain. The repo is the SSOT; work e2e-unattended with the loop below.

## SHIPPED this arc (merged to main + deployed + tier3-sweep-verified live)

| Item | PR | What |
|---|---|---|
| P1 row-read | #230 | `WIDEN_KM [5,15]→[0.5,2,8]`; LIVE rows_read 3,248 ≤4k (**11.3×**); ADR 0002 + CHANGELOG corrected |
| P2 outward postcodes | #233 | `shared/sanitize.ts` outcode parse; migration **0006 applied `--remote`** (SE1/E8/N1/SW1A centroids live, 6,656→6,931 rows); durable — `ingest.yml` re-dispatched so `corpus-data` postcodes.json now carries 275 outcodes (04:47 cron keeps them) |
| scam NL match | #232 | `matchFirms` also matches the firm name-STEM inside a natural-language ask ("is X a scam"); flag-never-a-verdict preserved |
| P3 record-date honesty | #234 | `dates.ts` `formatDateLabel` + required `CorpusLabels.dateLabel`; care→"data as of", wander→omit (kills false "1974" freshness), food→"inspected" |
| P4 shared catalog | #235 | `shared/usecaseCatalog.ts` — UI + Worker read ONE source; `example`/`blurb` on each `usecases/*.json`; routable derived from keywords |
| P5b no-match card | #236 | routable→"Try typing"; never-auto-routed→`[Open X →](?usecase=)` link (verified rendering clean live) |

Live verify: tier3 sweep GREEN each phase (axe 0/0 across 3 variants × light/dark, no model-host hits).
CI run history is the durable record (committed `runs.jsonl` is a local manifest by design).

## NEXT — resume here (2 things left)

### 1. P5 (visual/UX pass) — CODE DONE, pushed; needs PR → merge → deploy → screenshots

- Branch **`fix/018-p5-visual-ux`** @ `e91f215`, pushed. **All local gates green** (worker + ui:
  lint/typecheck/test/build/size). **Open the PR** (retry if GitHub write 5xxs — it was flaky earlier):
  `gh pr create --head fix/018-p5-visual-ux --base main --title "feat(ux): visual/UX pass (018 P5)" --body-file <write one>`
- Then the loop (below): CI green → squash-merge `--admin` → `make deploy` → dispatch tier3 sweep →
  **download screenshots + eyeball for the OWNER's taste review** (owner explicitly wants a before/after).
- **OWNER IS AWAITING A TASTE REVIEW OF P5.** Glyphs (🩺 care 🚶 wander 🍽️ food 🔍 scam 🚀 founders 🧭 route)
  are decide-by-default picks — swappable; 🔍 scam is deliberately NOT a shield/✅ (never a "verified" badge).
  Deliver desktop `01-load` (empty state: chips + rotating placeholder), `run-care` (human distances +
  de-duped authority tag + glyph + title-as-link), `run-no-match`.

### 2. P6 — release v1.9.0 (owner chose ONE release covering all of 018)

`make bump VERSION=1.9.0` → commit → `git tag -a v1.9.0` → push tag → `gh release create v1.9.0` → final
deploy + tier3 sweep PASS. The v1.8.0 HOLD is resolved: **one v1.9.0** covers all of 018.

## Docs & issues audit (owner asked) — do at P6

- **CHANGELOG**: ✅ per-phase P1–P5 entries in `[Unreleased]` — roll into the v1.9.0 heading at bump.
- **README**: only the version badge (via `make bump`). **No new URL / env var / CLI switch** in 018 —
  P2's migration `0006` is documented in the migration file + CHANGELOG; `?usecase=` bypass is pre-existing.
- **architecture.md**: optional short note that `shared/usecaseCatalog.ts` (P4) is the first `shared/*`
  module the SPA imports (one-way `shared/`→consumers; the UI never pulls worker-only modules).
- **ADR**: none needed — P3/P4/P5 are implementations, not decisions. ADR 0002 was corrected in P1.
- **roadmap / userstory**: no change (018 is polish).
- **Issues**: tick **#223** (018 tracker) P1–P5; **close #224 (P2) + #225 (P3)** (shipped). The scam fix had
  no issue (found by the P1 sweep, fixed in-arc) — note it in the #223 close. `#161/#168/#185/#150` remain
  backlog (untouched).

## The loop (per phase / PR)

branch per topic → strict module-TDD (RED first; glue/CSS/copy → e2e+axe) → gates → push → open PR →
CI green → `gh pr merge <n> --squash --admin --delete-branch` → `git switch main && git pull` →
`make deploy` → dispatch `tier3-monitor.yml` → download artifact → confirm green + eyeball screenshots.

## Commands (creds present: root `.env` token-only; account_id in `wrangler.toml`; prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`)

- Gates: `npm --prefix worker run lint|typecheck` · `npm --prefix worker test -- --run` · `npm --prefix ui run lint|typecheck|build|size` · `npm --prefix ui test -- --run` · `uvx ruff@0.15.22 check` · `uvx pytest -q ingest`. Markdownlint (CI form): `rtk proxy npx --yes markdownlint-cli2 "<file.md>"` (raw `npx` is hook-rewritten → use `rtk proxy`; pass explicit files, the `**/*.md` glob lints node_modules locally).
- Deploy: `make deploy`. Live sweep (local patchright OOMs → CI): `gh workflow run tier3-monitor.yml`, `gh run watch <id> --exit-status --compact`, `gh run download <id> --name tier3-results --dir <dir>` (screens named `{config}-{shot}.png`, e.g. `desktop-01-load.png`).
- D1: source `.env`; `cd worker`; `./node_modules/.bin/wrangler d1 execute DB --remote --config wrangler.toml --json --command "…"`. Migrations: `… d1 migrations apply DB --remote --config wrangler.toml`.

## Watch-outs (env quirks — do not relearn)

- **`gh pr merge --admin` is classifier-gated** — needs a settings.local.json allow-rule or live approval; owner authorized `--admin` squash (never touch GitHub rulesets). If auto-blocked, surface to owner.
- **Bash filter denies** `grep`/`ls`/`head`/`tail`/`find`-into-node_modules/curl-to-external-URL and many compound `;`|pipe commands → use `git grep`, `python3` to list dirs, redirect to a log + `Read` a slice, single-purpose commands. Emoji/`×`/unicode in a command can trip the filter → commit via `-F <file>`.
- **markdownlint MD004**: never let a WRAPPED changelog line start with `+`/`-`/`*`.
- **exactOptionalPropertyTypes** both tsconfigs; **cyclomatic complexity ≤12/function** (P4 + P5 both hit it → extract a helper / subcomponent, e.g. P5's `Hero`).
- **`shared/*` stays import-root** (SPA never imports worker-only modules); `ui/tsconfig.app.json` `include` has `../shared`.
- Data honesty: labels/glyph/officialLink/attribution live in reviewed TS, never in ingested data.
- P5 render: `[title](url)` renders as a clean clickable a2ui link (verified live); "Sources & licence:" one-line join keeps all attribution VERBATIM (no A2UI disclosure primitive exists).

## Conventions (hard)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` ·
`env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · squash-`--admin` on green (never modify rulesets) · prune.
