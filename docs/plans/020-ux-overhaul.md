---
title: "Plan 020 — UX overhaul: right-workflow routing · place-name input · re-shown examples · visual/motion/layout/cards + a11y"
type: plan
status: "CLOSED — routing · place-names · examples · visual/a11y shipped (per docs/plans/README.md index); P4c skeleton dropped (YAGNI), P4e richer-cards deferred (see Progress table)"
refs: ["#2 routing (right workflow)", "#1 place-name input", "#3 re-show examples", "#4 UX overhaul (visual/motion/layout/cards/header/colour/a11y)", "ADR 0002 (fetch-free store)", "ADR 0004 (register-only routing)", "ADR 0005 (project-owned theme)"]
---

# Plan 020 — UX overhaul

## Handoff (read this first)

**Originally handoff 020 — "UX overhaul. Full comprehensive arc (owner chose thorough after a KISS
challenge — do NOT re-litigate). P1 routing → P2 place-names(+D1) → P3 examples → P4a-e
visual/motion/layout/cards. Deploy is owner-gated." (updated 2026-07-25).**

### Onboarding — the 30-second picture

Arc 019 shipped the credential-free freshness watchdog (endpoint `GET /api/freshness` #247 + watchdog #248 + fix #249). Arc 020 is a **UX overhaul** from four owner complaints: (#2) routing feels narrow /
uses the same no-match card; (#1) place-name input ("wander nearby tower") dead-ends on "Enter a valid
UK postcode"; (#3) example chips vanish after the first search; (#4) the UI is dull + hard for elderly
/ less-technical Londoners.

**Owner locked (after a KISS challenge — do NOT re-open):** FULL comprehensive scope (all phases, P4
in 5 sub-phases, sweep each); place-names = fuller curated `data/places.json` **+ a D1 table/migration**
(later assessed unnecessary and deferred — see Owner decisions below); keep the 3 theme variants (ADR
0005), default Thames Teal; richer cards but NO map tiles; keep the P3 pure-gate test.

### Queue (do in order; details + source map below in this plan)

1. **P1 routing** (module, RED-first) — word-boundary + synonyms in `classifyHeuristic`
   (`worker/src/agent/router.ts:32-48`), expanding `usecases/*.json` keywords; RED-first `worker/test/router.test.ts`.
2. **P2 place-names** (module + data + D1) — `data/places.json` + pure `shared/places.ts` `resolvePlace`, hook the
   `!postcode` seam (`worker/src/corpus/query.ts:46-47,105-106`), + a D1 `places` table/migration (mirror `0006`).
3. **P3 examples** (glue + pure gate) — "Try another" row + `shouldShowSuggestions` gate (`ui/src/App.tsx:287,322`).
4. **P4a-e UX** (CSS/tokens/components → axe + screenshot sweep is the test, no unit tests) — type/spacing/≥44px
   targets → colour refresh → motion/skeleton → layout+header → richer cards.

### Owner gates (batch)

- **Deploy** — dispatch `deploy.yml` (production Environment); the agent CANNOT deploy (no CF creds in the
  devcontainer + dispatch is classifier-blocked). Batch UI/data phases into owner deploy sittings, then the
  tier-3 sweep verifies live (axe 0/0 + screenshots). The `/api/freshness` endpoint is already live.

### The loop (per phase / PR)

branch per topic → RED-first (modules only; CSS/wiring → e2e) → gates (`npm --prefix worker|ui run
lint|typecheck|test` [ui: `build`+`size`] · `uvx ruff@0.15.22 check` + `uvx pytest -q ingest` if ingest touched ·
semgrep · markdownlint `rtk proxy npx --yes markdownlint-cli2 "<file.md>"`) → push → PR → CI green → `gh pr merge
<n> --squash --admin --delete-branch` → `git switch main && git pull` → per UI/data phase: deploy (owner) + sweep.

### Watch-outs (carried; do NOT relearn)

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

### Conventions (hard)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` ·
`env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · squash-`--admin` on green (never modify rulesets) · prune.

## Context (why)

Four owner-flagged UX gaps in the live civic tool:

1. **Place-name input dead-ends** — "wander nearby tower", "parks near Camden" → "Enter a valid UK postcode".
2. **Routing feels narrow** — literal-substring heuristic, model rarely runs → many natural-language asks fall
   to the same no-match card; the catalogue feels unused.
3. **Examples vanish** — suggestion chips hide after the first search and never return.
4. **UI reads dull + hard for elderly / less-technical Londoners** — ~28-30px touch targets, 12-14px muted
   copy, whisper visuals.

Goal: **max user joy + success, familiar to Londoners, usable by elderly / less-technical people**,
executable as long-running unattended phases.

**Hard constraints:** no live external fetch (ADR 0002 — hot path reads committed D1/bundled only);
project-owned theme (ADR 0005 — never re-vendor EyeRest; keep the 3 accent variants); strict TDD (RED-first
for *modules* only; CSS/wiring/glue → the e2e sweep is the test); lint + typing + security always; size budget
**JS ≤150KB / CSS ≤8KB gzip**. `docs/design.md` is STALE — `ui/src/tokens.css` + ADR 0005 are ground truth.

## Owner decisions (LOCKED — chosen 2026-07-25 AFTER an explicit KISS/DRY/YAGNI challenge; do NOT re-litigate)

- **Scope = FULL comprehensive arc** — all four phases; P4 in its 5 sub-phases; axe + screenshot sweep per phase.
- **P2 place-names = FULLER + D1** → **D1 DEFERRED (owner-confirmed 2026-07-25).** Shipped the fuller ~80-place
  curated gazetteer bundled; the D1 `places` table was assessed unnecessary during build (small + static, ships
  in the Worker bundle, resolves LIVE with no D1 read — unlike the ingest-managed `postcodes` table) and the
  owner confirmed keeping it deferred. Reopen only if the gazetteer grows large or becomes ingest-managed.
- **P4 colour** — keep the 3 variants (ADR 0005), refresh application + neutrals/type; default stays Thames Teal.
- **P4e cards** — type/badge/glyph/button richness; NO map thumbnails (no fetch).
- **P3 test** — keep the pure `shouldShowSuggestions` gate + RED-first test (mirrors the tested `shouldRotate`).

## Progress — queue (tick per merged PR)

| # | Phase | Kind | Status |
|---|---|---|---|
| P1 | **Route to the right workflow** (#2) | module · RED-first | ☑ whole-word `matchesKeyword` + synonym expansion (RED-first) |
| P2 | **Place-name input** (#1) — bundled resolver + `data/places.json` (~80 places) | module · RED-first + data | ☑ resolver + gazetteer + query-seam hook (RED-first); **D1 table assessed unnecessary** (bundled, works live) |
| P3 | **Re-show examples after a query** (#3) | glue + pure gate | ☑ `suggestionMode` gate (RED-first) + "Try another" row; e2e-verify on deploy |
| P4a | **Visual + readability** (type scale, spacing, ≥44px targets, elevation) | CSS/tokens · e2e | ☑ ~17px base + line-height, caption ramp lift, ≥44px targets; sweep-verify on deploy |
| P4b | **Colour "familiar to Londoners"** (owner chose "warm & reassuring civic") | CSS/tokens · e2e | ☑ warm light neutrals + soft card elevation (measured pairs kept); sweep-verify on deploy |
| P4c | **Motion & states** (card enter, loading skeleton, hover/press) | CSS · e2e | ◐ card fade+rise shipped; **skeleton dropped (YAGNI** — deterministic corpus responses are near-instant) |
| P4d | **Layout + header rearrange** (help affordance, control cluster) | TSX/CSS · e2e | ☑ plain-language "?" HelpPanel; toggle-cluster rearrange = optional follow-up |
| P4e | **Richer result cards** (glyph, distance/rating badges, official-link button) | worker+ui · e2e | ⏸ **DEFERRED** — pill badges need a custom A2UI `usageHint`; the UI schema allows it (`z.unknown()` props) but whether @a2ui/react renders a custom hint's class is unverifiable without a browser (unit tests are node-only). Build→deploy→verify iteration, not blind. |

## Phase source map (files/functions — MIRROR these, do not re-explore)

### P1 · router (#2)
- **Root cause:** `worker/src/agent/router.ts:32-48` `classifyHeuristic` — `text.includes(keyword)` substring,
  1-hit-wins, no word boundary; model tie-break gated on `providers.length>0` (`router.ts:63`), empty on most
  deploys and always under `?demo=1` (`worker.ts:231`) → misses → `streamNoMatch`.
- **Do:** word/token-boundary matching (so "park" ≠ "parking"), curated **synonyms per workflow** (expand
  `keywords` in `usecases/*.json`), a minimal relevance threshold + specificity tie-break. Model escalation
  unchanged; keyword-less `founders-copilot`/`sort-my-route` stay never-auto-routed (`shared/usecaseCatalog.ts:71-73`).
- **RED-first:** `worker/test/router.test.ts:38-67` (heuristic) — ~15-20 realistic asks → correct id; word-boundary
  negatives; ties. + one SSE case in `worker/test/run.test.ts:377-466`.
- **Done-when:** query corpus routes correctly; "parking near…" ≠ wander; existing router tests green.

### P2 · place-names (#1)
- **Root cause:** `shared/sanitize.ts` `normalisePostcode` → null for non-postcodes → `worker/src/corpus/query.ts:46-47,105-106`
  `!postcode` branch → "Enter a valid UK postcode" (`worker/src/corpus/render.ts:14-20`; hints in `corpus/registry.ts`).
- **Do:** new committed `data/places.json` (~60-120 `name/aliases → {lat,lng}`: 33 borough centroids, major
  areas, top landmarks). New pure `shared/places.ts` `resolvePlace(text) -> {label,lat,lng}|null`. Hook the
  `!postcode` seam in `query.ts` (both `queryCorpus` async + `queryCorpusDef` pure): postcode first, else
  `resolvePlace`; on hit set `query`=label + continue to `corpusRows`/`nearestN`. `CorpusQuery.query`
  (`corpus/contract.ts`) semantics widen to "resolved location label". **D1 `places` table + migration** (mirror
  `worker/migrations/0006_outward_postcode_centroids.sql`); `d1Source` (`corpus/source.ts:84-100`) gains a place
  lookup. Bundled resolver works pre-deploy; migration activates on deploy.
- **RED-first:** resolver test (mirror `worker/test/sanitize.test.ts:30-49`); query test (`worker/test/corpus.test.ts:64-75`)
  place→rows. Data parser if built in `ingest/` → `ingest/tests/`.
- **Done-when:** "wander nearby tower" / "GP near Camden" return nearest-N; unknown → reworded empty hint;
  ADR-0002 hot path intact (one indexed/in-memory lookup).

### P3 · re-show examples (#3)
- **Root cause:** `ui/src/App.tsx:287,322-323` — chips gated on `!hasSearched` (`isRunning || eventLog.length>0`).
- **Do:** a compact **"Try another" row** below results (routable examples, `App.tsx:15-23` `ROUTABLE`), shown
  once results are in, hidden while `isRunning`. Pure `shouldShowSuggestions(state)` (mirror
  `ui/src/useRotatingPlaceholder.ts` `shouldRotate`).
- **RED-first:** `ui/tests/` (mirror `useRotatingPlaceholder.test.ts`). Rendering → e2e sweep.
- **Done-when:** "Try another" row visible + clickable after a search, hidden during a run; sweep asserts it.

### P4 · UX overhaul (#4) — CSS/tokens/components → e2e (axe + screenshots) is the test, NO unit tests
- **Tokens/theme:** `ui/src/tokens.css` (3 `[data-variant]` blocks, ADR 0005) + `ui/src/index.css` (`.qte-card`
  `:88`, text ramp `:145-185`) + `ui/src/theme/a2uiTheme.ts` (A2UI→`qte-*` map).
- **Shell/header/hero/chips:** `ui/src/App.tsx` — `HeaderControls:149-176`, `Hero:226-305`, chips `:287-296`,
  `hasSearched:322-323`, footer `:416-430`. Variant/theme init: `ui/public/variant-init.js`, `theme-init.js`.
- **Cards (structure server-side):** `worker/src/a2ui/cards.ts:40-88`, `worker/src/corpus/render.ts`;
  reuse `worker/src/geo.ts` `humanDistance`, the per-corpus `glyph`/`dateLabel` in `corpus/registry.ts`.
- **P4a** larger base type (≥16px civic copy), spacing/line-height, elevation scale, **≥44px** targets (WCAG 2.5.5).
- **P4b** refresh the 3 variants + neutrals; clearer primary action; London-evoking; not impersonating TfL.
- **P4c** card enter/stagger, loading skeleton while `isRunning`, hover/press — behind `prefers-reduced-motion`
  (`index.css:59-69`).
- **P4d** hero→results scan, grouped results, labelled control cluster, a "what is this?" help affordance.
- **P4e** prominent glyph, distance/rating badges, official-link as primary button. No map tiles.
- **Done-when (each):** axe 0 critical/0 serious × 3 variants × light/dark; screenshots H+V mobile+desktop;
  targets ≥44px; base copy ≥16px; size budget green; civic flow sweep passes.

## Gates + tests (repo facts)
- CI (`.github/workflows/ci.yml`): worker + ui each run `npm ci` · `npm audit --omit=dev --audit-level=high` ·
  `lint` · `typecheck` · `test` (ui also `build` + `size`); `lint-py` (ruff + pytest ingest); `security`
  (gitleaks + semgrep); `actionlint`; CodeQL. Size budget `ui/scripts/check-bundle-size.mjs`: JS ≤150KB, CSS ≤8KB gzip.
- UI unit tests are **pure** (`ui/vite.config.ts` `environment: "node"`, no jsdom) — pure fns only; visual/interaction
  caught by the e2e sweep, not unit tests.
- Sweep (axe + screenshots): `.github/workflows/tier3-monitor.yml` → `tests/e2e/ui_sweep.py` (vendored axe, 3 variants
  × light/dark). Deploy `deploy.yml` (production Environment) — **owner-gated** (classifier-blocked for the agent).

## Standing execution contract
Branch per phase → RED-first (P1/P2 modules, P3 gate) → gates (worker+ui lint/typecheck/test[/build/size], ruff/pytest
if ingest touched, semgrep, markdownlint via `rtk proxy npx … <files>`) → push → PR → CI green → squash-`--admin`
→ `git switch main && git pull` → per UI/data phase: deploy (owner) + tier-3 sweep (axe + screenshots H+V, varied
viewport). Conventional Commits · noreply · `--no-gpg-sign` · `env -u GH_TOKEN -u GITHUB_TOKEN`. Compact at phase
boundaries; keep plan + memory in sync. See this plan's Handoff section above for onboarding + watch-outs.
