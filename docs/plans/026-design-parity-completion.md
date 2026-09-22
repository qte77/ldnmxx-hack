---
title: "Design parity completion: logo, hero, category-card icons, trust bar, recents"
type: plan
status: "rows 1-2 shipped (logo + hero rewrite); rows 3-8 not started (2026-09-22)"
refs:
  - docs/plans/024-app-shell-redesign.md (the design-match arc this plan closes out — CLOSED, do not reopen its own table, this is the migrated remainder)
  - docs/adr/0006-civic-navy-red-palette.md (palette/token source this plan reuses verbatim, no new tokens needed)
  - "Claude Design project b8ac2137-75ac-4283-b730-3da64859a2f4 (\"sortmy.london\"), file SortMyLondon.dc.html — re-pulled fresh 2026-09-19, this plan's source of truth"
---

# Plan 026 — Design parity completion

## Handoff (read this first)

**Status: row 1 (new logo, PR [#321](https://github.com/qte77/ldnmxx-hack/pull/321)) and row 2 (hero
rewrite, PR [#323](https://github.com/qte77/ldnmxx-hack/pull/323)) shipped; rows 3-4 in flight (parallel
worktree agents, dispatched together); rows 5-8 not started.** Scoped from a direct design↔live diff
run in the prior session (2026-09-19): the design canvas was re-pulled fresh via `DesignSync` and
compared item-by-item against the deployed site. Two categories came out of that diff — **real gaps**
(below, this plan's scope) and **correct, deliberate non-matches** (NOT this plan's scope, do not "fix"
them — see "Explicitly out of scope").

**What's next, in order:**
1. **P0 (serial, one worktree)** — the new logo (row 1): small, fully decided, no open questions,
   touches `favicon.svg` + the Home header wordmark. Ship this first and alone so it doesn't get
   entangled with the larger rows.
2. **P1 (parallel, up to 3 worktrees, after P0 merges)** — the three remaining real gaps (rows 2–4)
   touch disjoint files (`Home.tsx`'s header/hero vs. its category-card grid vs. a new trust-bar
   component + `prefs.ts`) — dispatch as 3 parallel `Agent(isolation: "worktree")` calls in one message.
3. **P2 (serial, after P1)** — row 5 ("Recently looked up") depends on nothing else here structurally,
   but touches the SAME `Home.tsx` region row 3 touches (the "Common questions" section) — sequence it
   after P1 merges to avoid a guaranteed conflict, not because it's harder.
4. **P3** — e2e verification + docs/issues sync (rows 6–7), same standing bar as plan 025.

**The loop:** for each row — read its done-when, do the work on its own branch/worktree, run its verify
commands, open a CI-gated PR, squash-merge on green (`gh api --method PUT .../merge -f
merge_method=squash`, NOT `gh pr merge --admin` — reliably blocked here), strike the row in the SAME PR.

**Owner gates:** none of rows 1–5 need the owner — every decision below already has an explicit answer
(the user confirmed the logo directly; the other three were confirmed as "real gaps, scope them" in the
same turn). Row 8 (deploy) is the only owner-gated item, per this session's standing "confirm before
each production push" discipline — do not treat an earlier deploy in this session as blanket
authorization for a later one.

**Commands:** `cd ui && npm run lint && npm run typecheck && npm test && npm run build && npm run size`.
No worker/ changes expected in this arc (pure UI). `npx --yes markdownlint-cli2 "**/*.md"` on any doc
row.

**Watch-outs (do NOT relearn these):**
- **The mock's search box is NOT part of this plan.** The design's search input is a **client-side
  filter** over 6 hardcoded categories; the live app's input is the real product — a free-text ask
  routed by an LLM to one of the real usecases over ~112k records. Copying the mock's interaction model
  would be a regression (replacing real functionality with a toy filter), confirmed explicitly with the
  user as NOT something to build. Do not let `isSearching`/`filteredCategories` in the source below
  tempt a literal port.
- **The "Service notice" dialog block and Notifications section are explicitly declined**, not gaps —
  see plan 024's handoff and this plan's "Explicitly out of scope" below. Don't resurrect either while
  porting nearby markup.
- **`ui/public/favicon.svg`'s current mark is NOT sortmy.london branding at all** — its own
  `aria-label="qte77 mark"` gives it away; it's the repo owner's personal/org mark, ported in from a
  template. Row 1 is a genuine fix, not a style tweak.
- **Category-card icons need 6 REAL choices, not a mechanical port.** The mock's 6 icons
  (bin/tax/parking/library/GP/housing) map to hardcoded demo categories that don't exist in this app.
  Row 3 requires picking one icon per REAL usecase (Sort My Care, Wander, Scam Check, Food Hygiene,
  Founder's Copilot, Route) — a decide-by-default list is in row 3's done-when; deviate only with a
  reason in the PR.
- **Borough data already exists** (`ui/src/prefs.ts`'s `readBorough`/`writeBorough`, already wired to
  Settings' "Your area" selector) — row 2 is a UI relocation (move the display + a "Change" link that
  jumps to the Settings tab into the Home header), not a new data layer.
- Bash denies `ls`/`find`/`grep`/`cat`/`head`/`tail`/`awk` by command name — use Read/Glob/Grep tools or
  `python3 -c "..."`. `env -u GH_TOKEN -u GITHUB_TOKEN git/gh ...` is the working pattern in the MAIN
  session; a worktree-isolated subagent that hits `rtk-rewrite.sh`'s "cannot verify worktree-safety"
  block on that same pattern must STOP AND REPORT IT, not find a syntactic workaround (this happened
  once this session — see the feedback filed on it; do not repeat the workaround even if it still
  "works").

## Source map

### Design source (re-pulled fresh 2026-09-19 — re-pull again before starting, don't trust this copy)

`DesignSync(get_file, projectId: b8ac2137-75ac-4283-b730-3da64859a2f4, path: SortMyLondon.dc.html)`.
Relevant fragments (exact markup, for direct reference — the full file is larger, this plan quotes only
what rows 1–5 touch):

- **Logo** (top of canvas, a reference swatch, not part of either app screen):
  ```html
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-accent-700)" stroke-width="1.6">
    <path d="M20 5v30M13 12l7-7 7 7M13 28l7 7 7-7"/>
  </svg>
  <div style="font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:20px">
    sortmy<span style="color:var(--color-accent-700)">.</span>london
  </div>
  ```
  A vertical line with an up-chevron at the top and a down-chevron at the bottom — a "sort" glyph
  (literally two arrows, one each direction, matching "sortmy"). Wordmark: `--font-heading` (Cormorant
  Garamond) weight 600, the "." in the navy/red accent colour.
- **Home header + hero** (`isHome` branch):
  ```html
  <button onClick="{{ goSettings }}" style="...display:flex;align-items:center;gap:6px;color:{{ subText }}">
    <span style="text-transform:uppercase">{{ boroughLine }}</span>
    <svg ...><!-- location pin icon --></svg>
    <span style="text-decoration:underline">Change</span>
  </button>
  <h2 style="font-size:1.5em">What do you need sorted?</h2>
  <div class="field"><input class="input" placeholder="Ask about bins, parking, council tax…" .../></div>
  ```
- **Dismissible trust bar** (`showTrustBar`, state: `trustBarDismissed`, no persistence in the mock —
  resets every mount; this app should persist it, see row 4's done-when):
  ```html
  <div style="display:flex;justify-content:space-between;border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:var(--space-2) var(--space-3)">
    <span style="font-size:0.78em">Free · No sign-up · No cookies</span>
    <button onClick="{{ dismissTrustBar }}" aria-label="Dismiss">×</button>
  </div>
  ```
- **Category grid** (`isBrowsing`, i.e. not searching):
  ```html
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
    <!-- per card: icon circle (2.4em, accent-100 bg, accent-400 border) + title only, centered, no blurb -->
  </div>
  ```
  vs. the CURRENT implementation's 1-col title+blurb list (`ui/src/screens/Home.tsx`'s `CategoryCard`).
- **Recently looked up** (`showRecent`, state: `recentIds`, a ring buffer `[id, ...prev.filter(x=>x!==id)].slice(0,3)`):
  ```html
  <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
    <!-- per recent: <button class="tag tag-outline">{{ rec.title }}</button> -->
  </div>
  ```

### ldnmxx-hack files this arc touches

- `ui/public/favicon.svg` — replace the "qte77 mark" path data with the sort-arrows glyph above, keep
  the existing light/dark `@media (prefers-color-scheme)` CSS-variable-driven approach (don't hand-hex
  it, the file already tokenizes bg/fg/accent per scheme — reuse that structure).
- `ui/index.html` — `<meta name="theme-color">`, `og:image`/`twitter:image` references the favicon
  indirectly; check whether `og.png` (referenced but not found in this repo's tree per an earlier grep
  this session — verify, don't assume) needs regenerating too, or is legitimately out of scope (a raster
  social-preview image is a separate asset-generation task, not an SVG icon swap — flag in the PR if
  skipped rather than silently dropping it).
- `ui/src/screens/Home.tsx` — `Hero()` component (header row, `<h1>` copy), `CategoryCard`/
  `CategoryCardList` (grid layout + icons), new `TrustBar` component, new "recently looked up" component
  reading/writing a new pref. All in one file today; keep it that way unless a row's diff makes the file
  unwieldy (use judgement, this repo's existing style tolerates a large `Home.tsx` with many small
  extracted components already).
- `ui/src/prefs.ts` — needs 2 new pref keys: `trustBarDismissed` (boolean, row 4) and `recentUsecaseIds`
  (string array, max 3, row 5) — mirror the existing `readBorough`/`writeBorough` pattern exactly
  (localStorage key prefix `qte77-*`, already established).
- `ui/src/shell/AppShell.tsx` / `TabBar.tsx` — the "Change" borough link (row 2) needs to switch to the
  Settings screen; reuse whatever mechanism `TabBar`'s own tab-click already uses, don't invent a second
  navigation path.
- `shared/usecaseCatalog.ts` — row 3's icon choices are keyed by usecase `id`, not title (ids are
  stable, titles could theoretically change) — `sort-my-care`, `sort-my-wander`,
  `sort-my-scam-check`, `sort-my-food-hygiene`, `founders-copilot`, `sort-my-route`.

## E2E verification requirement (same standing bar as plan 025)

polyfetch + Patchright Chromium, local AND remote once deployed; vary viewport/device emulation; click
every new interactive element (the "Change" link, the trust-bar dismiss ×, each category card, a
recently-looked-up chip) to verify function AND appearance; screenshots in both orientations; capture
console errors + failed requests via devtools. Extend `tests/e2e/ui_sweep.py`, don't create a parallel
suite.

## Docs & issues audit requirement (same standing bar as plan 025)

CHANGELOG `## [Unreleased]` entry; `docs/design.md` gets the logo + hero-copy + card-grid changes noted
(it's the single design-system reference doc, arc 024 rewrote it — keep it current, don't let it drift
stale again); no ADR needed (this is visual polish within already-decided tokens/architecture, not a new
decision); strike this plan's own rows as they ship (this table is authoritative — no separate list).

## Explicitly out of scope (declined, not deferred — do not build these under this plan)

- The mock's client-side category search/filter (see Handoff)
- "Service notice" dialog callout (no backing data field)
- Notifications section (no backend, CSP blocks push)
- A raster `og:image`/social-preview regeneration (separate asset task if the logo change makes the
  current one stale — flag, don't silently build it here)

## Remaining work

| # | Item | Gate | Done-when |
|---|---|---|---|
| 1 | ✅ shipped (PR [#321](https://github.com/qte77/ldnmxx-hack/pull/321)) — **P0 — New logo**: replace `favicon.svg`'s mark with the sort-arrows glyph (keep the existing per-scheme CSS-variable structure); add the same mark + "sortmy.london" wordmark (Cormorant Garamond 600, accent-coloured ".") to `Home.tsx`'s header, replacing the current plain-text wordmark. | agent | Favicon renders correctly in both browser light/dark; Home header shows the mark + wordmark in both themes (Patchright-verified); `npm run build && npm run size` green (an inline SVG mark is a few hundred bytes, should not meaningfully move the budget). |
| 2 | ✅ shipped (PR [#323](https://github.com/qte77/ldnmxx-hack/pull/323)) — **P1 — Hero rewrite**: header gains a borough-switcher button (`{borough}, London` from `readBorough()`, defaulting to a neutral placeholder when unset — the mock always has a borough, this app's borough is optional — decide the unset-state copy, e.g. "Set your area" — and a "Change" link that switches to the Settings tab); `<h1>` copy becomes "What do you need sorted?" (was "Ask in your own words. Get the official source." — a deliberate content change, already confirmed with the user this turn). | agent | Patchright: clicking "Change" lands on Settings' "Your area" selector; new copy renders in both themes; existing `ui/tests/*.test.ts` still green (no test currently asserts the old H1 copy verbatim — if one does, update it, don't work around it). |
| 3 | **P1 — Category-card icon grid**: 2-col grid, icon-only cards (drop the blurb from the card face — it moves to a `title` attribute or stays reachable via the existing result-dialog summary, don't just delete the information). Icon choice per usecase (decide-by-default, override with reasoning in the PR if you pick differently): Care → a cross/stethoscope glyph, Wander → a tree/leaf glyph, Scam Check → a shield glyph, Food Hygiene → a fork-and-knife or star-rating glyph, Founder's Copilot → a briefcase glyph, Route → a map-pin glyph. Reuse the mock's own 24×24 stroke-icon style (`stroke-width:1.8`, `stroke-linecap/linejoin:round`) for visual consistency with the rest of the ported design. | agent | All 6 real usecases render with a distinct icon in both themes at the mock's 2-col grid layout; `disabled` (mid-run) state still works per the existing `CategoryCard` behaviour; a11y: each icon is `aria-hidden` with the card's own accessible name carrying the label (mirror the existing pattern already used for section-heading icons in `Settings.tsx`, PR #314). |
| 4 | **P1 — Dismissible trust bar**: "Free · No sign-up · No cookies" bar above the category grid, with a × dismiss that PERSISTS (new `prefs.ts` key `trustBarDismissed`, unlike the mock which resets every mount — this app should remember the user's choice, matching how every other Settings-driven preference already persists). | agent | Dismissing hides the bar; a reload (fresh `readAppearance`-style read) keeps it hidden; `ui/tests/prefs.test.ts` gets a RED-first case for the new read/write pair, matching its existing style exactly. |
| 5 | **P2 — "Recently looked up"**: a ring buffer of the last 3 distinct usecase ids the user actually opened a result for (not just hovered/typed — mirror the mock's `selectCategory` trigger point, which fires on actual selection), rendered as outline chips above/below the category grid, tapping one re-runs that usecase's example query (reuse the existing `submitPrompt(text, usecaseId)` call already wired for category-card taps). | agent | A RED-first pure function (mirror `categoryCards.ts`'s test style) covers the ring-buffer dedup/max-3/most-recent-first logic; Patchright confirms 3 real taps produce 3 chips in the right order, a 4th evicts the oldest. |
| 6 | **P3 — E2E verification**: per the "E2E verification requirement" section above. | agent | Local sweep PASS; live sweep PASS once row 8 ships (documented in the closing PR). |
| 7 | **P3 — Docs sync**: CHANGELOG + `docs/design.md` per the "Docs & issues audit" section above. | agent | Both updated in the same PR(s) that ship rows 1–5, not a trailing cleanup PR. |
| 8 | **P4 — Deploy**: `bash scripts/provision_cf.sh`, confirmed with the user first regardless of any earlier deploy this session. | **owner** | Live site independently verified (Patchright, both themes) to show the new logo/hero/cards/trust-bar/recents — not just a green exit code from the deploy script. |

## Worktree dispatch

1. Row 1 alone first (small, no conflicts to manage, unblocks nothing but itself).
2. After row 1 merges: dispatch rows 2, 3, 4 as **3 parallel** `Agent(isolation: "worktree")` calls in
   ONE message — `Home.tsx`'s header region (row 2), its category-grid region (row 3), and a new
   trust-bar component + `prefs.ts` (row 4) are disjoint enough in practice (same file, different
   regions) that sequential-merge conflicts are the main risk, not concurrent-edit corruption — brief
   each agent to touch ONLY its own component function inside `Home.tsx`, not the whole file, and expect
   to resolve a small merge conflict on the second/third PR to land (rebase onto the just-merged one,
   don't fight it).
3. Row 5 runs after rows 2–4 all merge (same file, "Common questions" region — sequencing avoids a
   guaranteed conflict rather than because it's technically harder).
4. Rows 6–7 after rows 1–5.
5. Row 8 is the owner checkpoint — everything else pre-staged.

## Verification (repo-wide, run after every merge)

- `cd ui && npm ci && npm run lint && npm run typecheck && npm test && npm run build && npm run size`
- `npx --yes markdownlint-cli2 "**/*.md"` on any doc row
- Full CI gate (`ci.yml`) green before squash-merge.
