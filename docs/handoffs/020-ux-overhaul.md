---
title: "Handoff 020 — UX overhaul. Full comprehensive arc (owner chose thorough after a KISS challenge — do NOT re-litigate). P1 routing → P2 place-names(+D1) → P3 examples → P4a-e visual/motion/layout/cards. Deploy is owner-gated."
type: handoff
updated: 2026-07-25
pairs_with: docs/plans/020-ux-overhaul.md
---

# Handoff 020 — resume point

**Read [`docs/plans/020-ux-overhaul.md`](../plans/020-ux-overhaul.md) FIRST** — it carries the per-phase
source map (files:line), the approach, the RED-first targets, and the done-when for each.

## Onboarding — the 30-second picture

Arc 019 shipped the credential-free freshness watchdog (endpoint `GET /api/freshness` #247 + watchdog #248 +
fix #249). Arc 020 is a **UX overhaul** from four owner complaints: (#2) routing feels narrow / uses the same
no-match card; (#1) place-name input ("wander nearby tower") dead-ends on "Enter a valid UK postcode"; (#3)
example chips vanish after the first search; (#4) the UI is dull + hard for elderly / less-technical Londoners.

**Owner locked (after a KISS challenge — do NOT re-open):** FULL comprehensive scope (all phases, P4 in 5
sub-phases, sweep each); place-names = fuller curated `data/places.json` **+ a D1 table/migration**; keep the 3
theme variants (ADR 0005), default Thames Teal; richer cards but NO map tiles; keep the P3 pure-gate test.

## Queue (do in order; details + source map in the plan)

1. **P1 routing** (module, RED-first) — word-boundary + synonyms in `classifyHeuristic`
   (`worker/src/agent/router.ts:32-48`), expanding `usecases/*.json` keywords; RED-first `worker/test/router.test.ts`.
2. **P2 place-names** (module + data + D1) — `data/places.json` + pure `shared/places.ts` `resolvePlace`, hook the
   `!postcode` seam (`worker/src/corpus/query.ts:46-47,105-106`), + a D1 `places` table/migration (mirror `0006`).
3. **P3 examples** (glue + pure gate) — "Try another" row + `shouldShowSuggestions` gate (`ui/src/App.tsx:287,322`).
4. **P4a-e UX** (CSS/tokens/components → axe + screenshot sweep is the test, no unit tests) — type/spacing/≥44px
   targets → colour refresh → motion/skeleton → layout+header → richer cards.

## Owner gates (batch)

- **Deploy** — dispatch `deploy.yml` (production Environment); the agent CANNOT deploy (no CF creds in the
  devcontainer + dispatch is classifier-blocked). Batch UI/data phases into owner deploy sittings, then the
  tier-3 sweep verifies live (axe 0/0 + screenshots). The `/api/freshness` endpoint is already live.

## The loop (per phase / PR)

branch per topic → RED-first (modules only; CSS/wiring → e2e) → gates (`npm --prefix worker|ui run
lint|typecheck|test` [ui: `build`+`size`] · `uvx ruff@0.15.22 check` + `uvx pytest -q ingest` if ingest touched ·
semgrep · markdownlint `rtk proxy npx --yes markdownlint-cli2 "<file.md>"`) → push → PR → CI green → `gh pr merge
<n> --squash --admin --delete-branch` → `git switch main && git pull` → per UI/data phase: deploy (owner) + sweep.

## Watch-outs (carried; do NOT relearn)

- **Deploy + `gh pr merge --admin`** are classifier-gated for the agent; owner authorized `--admin` squash (never
  touch rulesets). Deploy is an owner action.
- **exactOptionalPropertyTypes** both tsconfigs; **cyclomatic complexity ≤12/function** (extract a helper —
  e.g. arc-019 `freshnessResponse`). **Size budget JS ≤150KB / CSS ≤8KB gzip** (`ui/scripts/check-bundle-size.mjs`) —
  a visual overhaul must fit or raise the ceiling deliberately in the same PR.
- **UI unit tests are pure/node-only** (no jsdom) — test pure fns; visual/interaction → the e2e sweep.
- **`design.md` is STALE** (old EyeRest amber) — `ui/src/tokens.css` + ADR 0005 are ground truth; never re-vendor EyeRest.
- Bash filter denies `grep`/`ls`/`head`/`tail`/compound `;`|pipe → `git grep`, redirect to a log + `Read`, single
  commands. Emoji/unicode in a commit → `-F <file>`. `npx` hook-rewritten → `rtk proxy npx`.
- Data honesty (ADR 0002): store only committed reference data; place gazetteer is reviewed static name→coords.

## Conventions (hard)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` ·
`env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · squash-`--admin` on green (never modify rulesets) · prune.
