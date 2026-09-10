---
title: "App shell redesign — civic navy/red palette, serif type, tab IA"
type: plan
status: "P0 in progress (2026-09-10)"
refs:
  - docs/adr/0005-project-owned-theme.md (superseded by this arc's ADR 0006)
  - docs/handoffs/017-single-input-london-theme.md (3-variant decision, also superseded)
  - "Claude Design project b8ac2137-75ac-4283-b730-3da64859a2f4 (\"Mobile app design planning\"), file SortMyLondon.dc.html"
---

# Plan 024 — App shell redesign (civic navy/red, serif type, tab IA)

## Context

The user published a Claude Design mockup ("Mobile app design planning" project) exploring a different
direction for sortmy.london: a native-app-style shell (bottom tab bar, Home/Settings) instead of the
current single-page search layout, a toned-down London Underground navy/red civic palette instead of
the three locked accent variants (Thames Teal/Heritage Indigo/Westminster Green, ADR 0005), and an
editorial serif type system (Cormorant Garamond + Lora) instead of Inter. The user asked to "assert
adherence" to this design; after the scope was clarified (AskUserQuestion, 2026-09-10) they chose a
**full rebuild** — new IA and navigation, not just a palette swap.

**Correction mid-session (2026-09-10):** the design canvas was updated by the user to add a real,
sourced dark mode (an `appearance: system|light|dark` prop with exact light+dark hex ramps) and to drop
the old `theme: classical|london` prop entirely — the navy/red palette is now the design's only palette,
unconditionally, in both schemes. This supersedes the plan's original framing ("keep dark as an
extension, no design source" — from the AskUserQuestion answered before the design was updated): dark
mode is now directly sourced, not invented. The earlier decision to collapse the 3-variant system down
to one palette is unaffected and reinforced (the design never offered a variant axis at all).

## Handoff (read this first)

**Status: P0–P4 shipped (rows 1–7 merged); P5 in progress (row 8, PR #298).** Rows 9–10 (version
bump/release, deploy) remain; row 10 is owner-gated.

**What shipped:** row 1 tokens/fonts (#288), row 2 shell/contracts (#293), row 3 catalog fields (#289),
rows 4+5 Home category cards + Result sheet, combined (#297 — row 2's `ResultSheet` deviation coupled
them), row 6 Settings full build-out (#296), row 7 docs/ADR 0006 (#295). Row 8 (e2e sweep + this
housekeeping pass) is PR #298 — see the "Row 8 findings" note below for a real bug it found and fixed.

**What's next, in order:**
1. **Row 9** — `make bump VERSION=2.0.0`, `CHANGELOG.md` `## [2.0.0]`, tag + push. Agent-executable.
2. **Row 10** — deploy + live verification. **Owner-gated**: no `CLOUDFLARE_API_TOKEN` in this
   devcontainer, and per `cf-ci-secret-gate` memory the token was never provisioned to GitHub Actions
   either — `deploy.yml` is expected to be a no-op/failure until the owner provisions it or deploys
   manually. Say so plainly when attempting this row rather than claiming a deploy that didn't happen.

**Row 8 findings worth knowing before touching `ui_sweep.py` again:** the sweep's `close_sheet()`
helper (NOT the generic `click()` helper) is load-bearing — `ResultSheet.tsx`'s full-viewport backdrop
and its visible ✕ button share the identical accessible name ("Close results"), and `click()`'s
`.first` resolves to the backdrop, whose click-point coincides with the dialog's own area on ≥640px
viewports (the sheet is centered there, not bottom-anchored) — the click lands on the dialog instead
and the sheet never closes, which then blocks the NEXT flow's `#civic-query` fill. Confirmed empirically
by running the sweep twice locally (once broken, once fixed) — see this row's PR description.
4. **Row 11** — housekeeping: this arc's living handoff doc + the `docs/handoffs/README.md` pointer
   (already stale at 022 before this arc even started — fix in the same PR).

**The loop:** for each row — read its done-when, do the work on its own branch/worktree, run its verify
commands, open a CI-gated PR, squash-merge on green (standing authorization, see `workflow-preferences`
memory), strike the row in the SAME PR.

**Owner gates:** only row 10 (deploy) — this devcontainer has no `CLOUDFLARE_API_TOKEN` (see
`devcontainer-unattended-limits` memory). Everything else is agent-executable.

**Commands:** see each row's done-when. Repo-wide gates:
`cd ui && npm run lint && npm run typecheck && npm test && npm run build && npm run size`;
`cd worker && npm run lint && npm run typecheck && npm test`; root `ruff check && uvx pytest -q ingest`.
No e2e Makefile target — invoke `tests/e2e/ui_sweep.py` directly (row 8).

**Watch-outs (do NOT relearn these):**
- Bash deny-list in this devcontainer blocks `ls find grep cat head tail awk` regardless of
  allowlisting — use `tree`, `git ls-files`, Read/Glob/Grep. Applies inside worktree subagents too.
- `ui/public/404.html` disables the Pages SPA fallback (#178). Tabs/screens = in-memory/query state,
  **never** path routes.
- `_headers` CSP is `font-src 'self' data:` — no Google Fonts CDN. Fonts ship via `@fontsource` only.
- `.npmrc` has `min-release-age=7`; `@fontsource/cormorant-garamond`/`lora` 5.3.0 published 2026-07-19
  — clear.
- Cap worktree subagents at 3 concurrent (memory constraints). Each fresh worktree needs its own
  `npm ci`.
- `tests/e2e/ui_sweep.py` is not in CI/Makefile, only the scheduled `tier3-monitor.yml` (live URL only).
  Don't touch it before row 8.
- **The header `ThemeToggle` icon (☀/☾) is being REMOVED, not just retheme d** — the design moves
  appearance control into Settings as a 3-state System/Light/Dark segmented control (row 2/row 6). Row
  8 must update `tests/e2e/ui_sweep.py`'s theme-toggle detection (currently looks for exact glyph text
  in the header) accordingly, not just leave it as an optional/swallowed check.
- Scam Check has no real corpus (synthetic sample only) — its card must say so.
- `docs/handoffs/README.md`'s resume line/index table are stale at 022 — row 11 fixes this.

## Source map

### The design (source of truth — re-fetch via `DesignSync.get_file`, project
`b8ac2137-75ac-4283-b730-3da64859a2f4`, NOT the `Artifact` tool, it's a native `claude.ai/design`
project)

- `SortMyLondon.dc.html` — iOS/Android device frame, bottom tab bar (Home/Settings). Home = search
  input + service-notice band + "Common questions" category cards + "Recently looked up". Settings =
  **Appearance** segmented control (System/Light/Dark, NEW) → **Text size** segmented control
  (Standard/Large/X-large) → high-contrast switch → borough `<select>` → notifications (2 switches) →
  About block. Props: `platform` (ios/android), `appearance` (`system|light|dark`, default `system`),
  `largeTextDefault`, `highContrastDefault`. No `theme` prop anymore — colour always comes from the
  inline navy/red script below, in whichever scheme `appearance` resolves to (`componentDidMount` wires
  `matchMedia('(prefers-color-scheme: dark)')` for the "system" case).
- `_ds/classical-7f413185-.../styles.css` — structural DS tokens, **reuse verbatim, do not round**:
  `--space-1:4.6px, -2:9.2px, -3:13.8px, -4:18.4px, -6:27.6px, -8:36.8px`; `--radius-sm:2px, -md:4px,
  -lg:7px`; `--shadow-sm/md/lg`; `--font-heading:"Cormorant Garamond"` weight 600, `--font-body:"Lora"`.
  Component patterns to mirror (plain-CSS DS, not literally reusable in React): `.btn`/`.btn-primary`
  (outlined, never filled), `.card` (bordered, transparent), `.tag`, `.field`/`.input`, `.seg`/
  `.seg-opt` (the exact pattern for Appearance AND Text-size controls), `.dialog` (sheet parent).
- `_ds/classical-.../_adherence.oxlintrc.json` — 3 `no-restricted-syntax` selectors (raw hex, raw px,
  non-DS `font-family`) to port into `ui/eslint.config.js` at `warn` (not `error` — the DS's own
  markup uses literal one-off px like `46px`/`13px`/`2px`).

**LIGHT palette** (`appearance` resolves to light):
- accent `#2f4cc9`; accent ramp `100 #e4e9fa, 200 #c3cef6, 300 #93a7ee, 400 #5d78e0, 500 #2f4cc9,
  600 #1c34ab, 700 #132687, 800 #0d1a60, 900 #08103b`
- accent-2 `#d13d2e`; ramp `100 #fde9e7, 200 #fbcbc6, 300 #f29d94, 400 #e36a5e, 500 #d13d2e,
  600 #b52a1c, 700 #8e1d12, 800 #66140c, 900 #400c07`
- neutral ramp `100 #f7f8fa, 200 #eceef3, 300 #d6dae4, 400 #b4bac9, 500 #8e94a5, 600 #6f7587,
  700 #535a6b, 800 #383e4d, 900 #222834`
- bg `#f5f6f8`, surface `#e8eaf0`, text `#141a26`, divider `color-mix(in srgb, #132687 20%, transparent)`

**DARK palette** (sourced, not derived):
- accent `#5d78e0`; accent ramp `100 #1b2444, 200 #233060, 300 #2f4192, 400 #5d78e0, 500 #7f96e9,
  600 #93a7ee, 700 #b3c1f4, 800 #d3dbfa, 900 #e8ecfd`
- accent-2 `#e36a5e`; ramp `100 #3a1410, 200 #571d16, 300 #8e1d12, 400 #d13d2e, 500 #e36a5e,
  600 #ef8478, 700 #f7a79d, 800 #fbcbc6, 900 #fde9e7`
- neutral ramp `100 #1a2030, 200 #232b3d, 300 #2f3949, 400 #8b94a7, 500 #9aa3b5, 600 #aeb6c6,
  700 #c3c9d6, 800 #d7dbe4, 900 #eceef3`
- bg `#11151f`, surface `#1a2030`, text `#eceef3`, divider `#3b4356`

**High-contrast overrides** (both schemes, applied on top): light → `text:#0b0d12,
divider:var(--color-neutral-700)`; dark → `text:#ffffff, divider:var(--color-neutral-600)`.

**Contrast verified 2026-09-10 (WCAG relative-luminance formula, not eyeballed — same rigor as ADR
0005)**: light text-on-bg 16.11:1; light accent-700-on-bg (category icon/active-tab colour) 11.74:1;
light accent-500-on-bg (outlined-button label) 6.48:1; dark text-on-bg 15.72:1; dark accent-700-on-bg
10.30:1; dark accent-500-on-bg (button label) 6.46:1. **All clear AA (4.5:1 text) with margin — unlike
ADR 0005's source palette, no forced deviations were needed here.** Still spot-check any NEW pairing a
later row introduces; don't assume the whole ramp is safe by extension.

### Current `ui/` — keep / rewrite / delete

| Keep as-is | Rewrite (P0–P4) | Delete |
|---|---|---|
| `agent/{useAgentSSE,applyA2UIEvent,contract}.ts`, `config.ts`, `devmode.ts`, `coverage.ts`, `useCoverage.ts`, `suggestions.ts`, `useRotatingPlaceholder.ts`, `globals.d.ts`, `vite-env.d.ts`, `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, all 6 `ui/tests/*.test.ts` | `App.tsx` (split into shell/screens), `main.tsx` (font imports), `usecase.ts` (signature grows), `tokens.css`, `index.css` (keep `.sr-only`, reduced-motion, `.a2ui-surface` structural rules — retheme values only), `a2uiTheme.ts` (hooks unchanged, values follow tokens.css), `index.html` head (`theme-color`), `favicon.svg`, `404.html` palette, `check-bundle-size.mjs` ceiling, `ui/README.md`, `public/theme-init.js` (extend for 3-state appearance, see below), `tests/e2e/ui_sweep.py` (row 8 only) | `variant-init.js`, `.brand-mark`/`.gh-icon` CSS + `src/assets/icons/github-*.svg`, `VariantToggle` component, `ThemeToggle` header icon (moves into Settings as the Appearance segmented control), `@fontsource/inter` (superseded by Lora for body copy; keep `@fontsource/jetbrains-mono` for the dev console) |

Key files/functions (re-verify line numbers before editing — they will have moved):
- `ui/src/App.tsx:580-586` root tree; `:433-468` bypass + `submitPrompt`; `:549-575` footer (kept);
  `:52-118` `ThemeToggle`/`VariantToggle` (both removed from the header; appearance logic relocates).
- `ui/src/usecase.ts:6-9` `readUsecase(search, knownIds)` — mount-only today. Row 2 adds a
  per-submission variant (`submitPrompt(text, usecaseId?: string)`).
- `ui/src/agent/useAgentSSE.ts:135-146` — the only `/api/run` call site; leave the transport untouched.
- `ui/src/theme/a2uiTheme.ts:15-49` — class-name map (`qte-card`, `qte-text-h3`, `qte-text-caption`,
  `.a2ui-surface a` are load-bearing). Leave hooks; retheme via `index.css:87-253` values only.
- `ui/public/theme-init.js:6-12` — current logic: `?theme=` › `localStorage["qte77-theme"]` →
  sets/removes `html[data-theme]`. This ALREADY implements the "system" case correctly (absence of
  override = no attribute = CSS `@media prefers-color-scheme` fallback decides) — row 2 only needs a
  UI control that writes `"light"`/`"dark"`/*clears the key* (for "system"), reusing this file as-is.
- `ui/src/tokens.css:23-128` — full current token set + 3 `[data-variant]` blocks + dark block. Reuse
  the semantic NAMES, swap VALUES to the sourced palette above — see "Token strategy".
- `worker/src/worker.ts:220-235` `resolveTarget`, `:485-490` the 3 routes, `:488-551` `/api/run` SSE
  contract (`USECASE_RESOLVED → RUN_STARTED → stage events → TOOL_CALL_END{render_ui} → USAGE →
  RUN_FINISHED`).
- `shared/usecaseCatalog.ts:20-26` `CatalogEntry` (grows: `source`, `officialLink`, `freshnessKey?`,
  `sampleData?: boolean`); `worker/src/usecases.ts:62` `USECASE_KEYS` (grows to match), `:146-168`
  `assertUsecaseDef` (update together, same PR).
- `worker/src/corpus/registry.ts:41,71-74,104` per-corpus `officialLink`; `data/sources.json`
  per-source licence/URL.
- `shared/places.ts:25-38` borough/landmark → centroid resolver — reuse for the Settings borough
  selector as a default-location anchor prepended to the prompt, not a filter.
- `worker/src/a2ui/cards.ts:199-214` `buildNoMatchCards` already lists all 6 usecases with blurb +
  example/bypass link — the Home category list reads the SAME catalog, no duplicated copy.
- Real usecases for the Home category list (the mock's bins/council-tax/parking/libraries/
  housing-benefit have zero backing anywhere in this repo — use the real 6 instead): **Sort My Care**
  (CQC), **Sort My Food Hygiene** (FSA), **Sort My Wander** (Historic England + OS), **Sort My Scam
  Check** (FCA — sample data only, label it), **Sort My Route** (bypass-only), **Founder's Copilot**
  (bypass-only).

### Token strategy (resolves what the design source doesn't specify)
Keep the CURRENT semantic token names in `tokens.css` (`--color-bg/surface/surface-lift/border/
border-strong/text/text-muted/primary/primary-on/glow/data-positive/caution/negative`,
`--shadow-card`, `--radius-card`) — **do not** do a mechanical rename across `ui/src/`. Only:
1. Swap light-block VALUES to the sourced LIGHT palette above (`--color-primary` ← accent `#2f4cc9`;
   add `--color-primary-2` for the accent-2/red role).
2. Swap the (`@media prefers-color-scheme: dark`) and (`[data-theme="dark"]`) blocks' VALUES to the
   sourced DARK palette above — **copy, don't derive**; the contrast numbers are already verified.
3. Drop all 3 `[data-variant]` blocks — single palette, `:root` only.
4. ADD (don't rename) `--font-heading` (Cormorant Garamond, weight 600) and `--font-body` (Lora);
   switch `body { font-family }` in `index.css` from `--font-sans` to `--font-body`; keep `--font-mono`
   (JetBrains Mono) for the dev console; delete `--font-sans` once nothing references it.
5. ADD the DS's fractional spacing/radius/shadow scale as NEW tokens (`--space-1..8`,
   `--radius-sm/md/lg`, `--shadow-sm/md/lg`, exact values above) for the new Home/Settings/Sheet
   markup. Existing `--radius-card`/`--shadow-card` stay for A2UI result cards.
6. Semantic status colours (`--color-data-positive/caution/negative`) have no equivalent in the
   design — leave them as-is (ADR 0005's already-measured values); they're not part of what's being
   matched.

## Remaining work

| # | Item | Gate | Done-when |
|---|---|---|---|
| 1 | ✅ shipped (PR [#288](https://github.com/qte77/ldnmxx-hack/pull/288)) — **P0 — Tokens & fonts**: rewrite `tokens.css` per "Token strategy" (single palette, sourced dark values, new font/space/radius/shadow tokens); add `@fontsource/cormorant-garamond@5.3.0` + `@fontsource/lora@5.3.0` (latin, weights 400/600) to `ui/package.json`, import in `main.tsx`; sync `theme-color` (`index.html:14`), `favicon.svg`, `404.html` inline palette to the new primary. | agent | `npm run build && npm run size` passes with a NEW ceiling in `check-bundle-size.mjs:15` set to the measured gzip total + ~20% headroom; `npm run lint` clean; the contrast numbers in the source map above are the ones shipped (no silent value drift from copy-paste). |
| 2 | ✅ shipped (PR [#293](https://github.com/qte77/ldnmxx-hack/pull/293)) — **P0 — Shared contracts**: split `App.tsx` into `ui/src/shell/AppShell.tsx` + `TabBar.tsx`, `ui/src/screens/Home.tsx` (Dashboard's behavior carried over unchanged, minus the header's dead accent-variant/theme toggles) + `Settings.tsx` (ships now with a MINIMAL but functional Appearance control — System/Light/Dark, a 1:1 replacement for the old header ThemeToggle, not a stub), `ui/src/prefs.ts` (Appearance/fontScale/highContrast/borough, pure + testable, mirrors `devmode.ts`'s pattern; Appearance reuses `theme-init.js`'s existing `qte77-theme`/`data-theme` mechanism — "system" = clear the key/attribute); grow `submitPrompt` to `submitPrompt(text, usecaseId?)`. Tab/screen switching is in-memory state, never a path route. **`ui/src/sheet/ResultSheet.tsx` is deliberately NOT created here** — it has no real driver until row 4 introduces category cards; row 5 creates it where it has one (YAGNI/AHA — see this row's PR description for the reasoning). | agent | `npm run typecheck` passes; all 6 pre-existing `ui/tests/*.test.ts` still green, untouched, +11 new `prefs.test.ts` cases (RED confirmed first); Home/Settings render behind the tab bar (verified with a headless-browser smoke check, not just `npm run dev`); rows 4–6 can import `prefs.ts` and the screen files with no further contract changes. |
| 3 | ✅ shipped (PR [#289](https://github.com/qte77/ldnmxx-hack/pull/289)) — **P0 — Catalog fields**: add `source`, `officialLink`, `freshnessKey?`, `sampleData?: boolean` (true only for `sort-my-scam-check`) to each `usecases/*.json`; grow `USECASE_KEYS` and `CatalogEntry` to match; `assertUsecaseDef` stays exhaustive. | agent | `worker/test/usecases.contract.test.ts` and `usecaseCatalog.test.ts` pass with the new fields required on all 6 entries; `cd worker && npm run typecheck && npm test` green. |
| 4 | ✅ shipped (PR [#297](https://github.com/qte77/ldnmxx-hack/pull/297)) — **P1 — Home screen** (worktree, branch `feat/024-p1-home-sheet`, needs rows 1–3 merged; **shipped in the SAME PR as row 5** — row 2's deviation made row 5 depend on row 4's category-card tap, breaking the original full-parallel split): category card list from the catalog (Route/Founders shown bypass-only, distinct affordance); search input → `submitPrompt`; borough pref (if set) prepended as a location anchor via `shared/places.ts` when no postcode is present. No service-notice band; "Recently looked up" dropped by default. | agent | New `ui/tests/` coverage for card-list render + borough-anchor prepend; `cd ui && npm run lint && npm run typecheck && npm test && npm run build` green in the isolated worktree. |
| 5 | ✅ shipped (PR [#297](https://github.com/qte77/ldnmxx-hack/pull/297)) — **P2 — Result sheet** (same worktree/branch/PR as row 4 — see its note; needs rows 1–3 AND row 4's category-card tap, its natural driver): CREATE `ui/src/sheet/ResultSheet.tsx` (row 2 deliberately skipped it — no consumer existed yet); bottom sheet hosts the EXISTING `A2UISurface`/`EventStream`/`useAgentSSE` path unmodified; retheme via `a2uiTheme.ts` hooks + `index.css:87-253` on the new tokens; Scam Check result carries an explicit "sample data" label. | agent | `useAgentSSE.test.ts`/`applyA2UIEvent` tests untouched and green; sheet open/close driven by shell/prefs state; `npm run dev` shows the "sample data" label on a Scam Check result. |
| 6 | ✅ shipped (PR [#296](https://github.com/qte77/ldnmxx-hack/pull/296)) — **P3 — Settings screen** (worktree, branch `feat/024-p3-settings`, needs rows 1–3): **Appearance** segmented control (System/Light/Dark, `.seg`/`.seg-opt` DS pattern, writes via `prefs.ts`/`theme-init.js` scheme) ABOVE **Text size** (Standard/Large/X-large) ABOVE high-contrast toggle; borough `<select>` (33 boroughs, `data/places.json`), persisted, used only as the Home-screen location anchor; About block reuses existing footer copy. Notifications/service-notice: dropped (no backend, CSP blocks push); feedback stays a link to GitHub issues. | agent | New `ui/tests/prefs.test.ts` covers read/write + appearance/text-size/high-contrast application; no dead/no-op controls render; `cd ui && npm run lint && npm run typecheck && npm test && npm run build` green in the isolated worktree. |
| 7 | ✅ shipped (PR [#295](https://github.com/qte77/ldnmxx-hack/pull/295)) — **P4 — Docs** (worktree, branch `docs/024-p4-docs`, needs row 1 for final token values): write `docs/adr/0006-*.md` explicitly superseding ADR 0005 and handoff 017's 3-variant decision — record that dark mode is DIRECTLY SOURCED from the design (not an extension, correcting the plan's original framing), the measured contrast numbers, and the single-palette rationale ("user chose after the conflict was surfaced, 2026-09-10; design updated mid-arc to add dark mode"); full rewrite of `docs/design.md`; update `README.md` (drop `?variant=` docs, UI stack section), `docs/architecture.md` UI section, `CHANGELOG.md` `## [Unreleased]`. | agent | `npx --yes markdownlint-cli2 "**/*.md"` clean; no remaining reference to the 3-variant system or EyeRest in touched docs; ADR 0006 cross-links this plan (024). |
| 8 | ✅ shipped (PR [#298](https://github.com/qte77/ldnmxx-hack/pull/298)) — **P5 — E2E + CI + bundle ceiling**: updated `tests/e2e/ui_sweep.py` — dropped the `data-variant` axis (single navy/red palette, no variant to scan); `#civic-query`/"Find it" unchanged (verified still valid, no edit needed); theme-toggle detection moved from a header glyph click to Settings' Appearance control (`Settings`/`Dark`/`Home` tab-bar + segmented-control clicks); added `close_sheet()` — a REAL bug fix, not anticipated in the original row wording: the sheet must be closed between flows or it blocks the next flow's `#civic-query` fill (see the Handoff note above for the root cause). `flows.json` markers needed NO changes — `ResultSheet.tsx` renders the "Showing: …" title as visible header text, not just an `aria-label`, so the existing marker/`routedTo` assertions still hold. Bundle ceiling NOT raised — still under budget (145,771/150,000 B JS, 6,130/8,000 B CSS on the fully-merged `main`), flagged as thin headroom (97.2%) for row 9. | agent | Sweep run twice locally against `npm run preview` (no CF creds here, so flows correctly FAIL on `/api/run` 502 — the honest-FAIL ceiling this devcontainer allows, per `verify-live-not-just-mocks` memory): the FIRST run caught the sheet-blocking bug (flows 2–5 failed with "CTA 'Find it' not found" on every viewport ≥640px); the SECOND run (post-fix) shows every flow correctly reaching "did not route/render" (button always found, sheet always closes) on all 5 configs, 0 model-host hits, axe 0 critical/0 serious on both light and dark; `npm run build && npm run size` pass under the existing ceiling; `ci.yml` green on the PR. |
| 9 | **P5 — Version + release**: `make bump VERSION=2.0.0` (major — full UX rebuild, current tag v1.9.0); `CHANGELOG.md` `## [2.0.0]`; tag `v2.0.0`, push. | agent | `release.yml` runs green off the pushed tag; GitHub release created with the changelog body. |
| 10 | **P5 — Deploy + live verification**: run `deploy.yml`; once live, run `tests/e2e/ui_sweep.py` against `https://sortmy.london` (axe critical+serious gate, 0 model-host, all flagship flows, both appearance schemes). | **owner** (no `CLOUDFLARE_API_TOKEN` here) | `deploy.yml` green; live sweep PASS appended to `tests/e2e/runs.jsonl`; post-deploy MIME check (#178 guard) passes. |
| 11 | **Housekeeping**: update `docs/handoffs/README.md` "▶ Resume point" and index table to point at handoff 024 (stale at 022); write `docs/handoffs/024-app-shell-redesign.md` as the ONE living handoff for this arc, Progress table ticked per row above as PRs land. | agent | `docs/handoffs/README.md` reflects 024 as current; handoff 024's Progress table matches the state of rows 1–10 at last edit. |

## Verification (repo-wide, run after every merge)

- `cd ui && npm ci && npm run lint && npm run typecheck && npm test && npm run build && npm run size`
- `cd worker && npm ci && npm run lint && npm run typecheck && npm test`
- root: `ruff check && uvx pytest -q ingest`
- `npx --yes markdownlint-cli2 "**/*.md"` (docs rows)
- Full CI gate = `.github/workflows/ci.yml` (`ui`, `worker`, `lint-py`, `security`, `actionlint`) must
  be green before squash-merge (standing authorization per `workflow-preferences` memory).

## Worktree dispatch (rows 4–7 in parallel)

Revised after row 2's deviation coupled row 5 to row 4 (see their table rows): 3 agents, not 4 —
rows 4+5 (Home + Result sheet) ship together from ONE worktree/branch/PR, row 6 (Settings) and row 7
(Docs) each get their own.

After rows 1–3 merge to `main`:
1. `git fetch && git checkout main && git pull`.
2. Launch 3 `Agent(subagent_type: "general-purpose", isolation: "worktree")` calls in ONE message:
   (a) rows 4+5 combined, branch `feat/024-p1-home-sheet`; (b) row 6, branch `feat/024-p3-settings`;
   (c) row 7, branch `docs/024-p4-docs`. Each gets a fresh worktree off latest `main`, `npm ci` before
   any edit, its own PR.
3. Brief every worktree agent with its row(s), the "Token strategy"/"Source map" sections (don't
   re-derive), and the Bash deny-list + 404.html watch-outs.
4. Expected conflicts: near-zero except `ui/eslint.config.js`/`tokens.css`, which belong to row 1 only
   — rows 4–7 consume, never modify them. (a) and (b) both touch `ui/src/screens/Settings.tsx`? No —
   (a) does not touch Settings at all; only (b) does. (a) and (b) both may touch `ui/src/App.tsx`-era
   files only indirectly (neither touches `AppShell.tsx`/`TabBar.tsx` — no conflict expected there).
6. Once rows 4–7 are merged, proceed to rows 8–11 serially.
