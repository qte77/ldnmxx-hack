# Design — civic navy/red, serif type, tab-based shell

This is the working reference for anyone editing UI code: what tokens exist, what they mean, and
where they are consumed. For the palette's rationale, its sourced hex ramps, and the measured contrast
numbers, see **[ADR 0006](adr/0006-civic-navy-red-palette.md)** — this file does not repeat those
values, it points at them (`ui/src/tokens.css` is the ground truth for the exact numbers in code).

**History:** arc 017 ([ADR 0005](adr/0005-project-owned-theme.md)) built the app on fo's `linear.css`
system with three selectable London accent variants and an Inter/JetBrains Mono type pair, replacing
the yet-earlier vendored EyeRest brand default. **Arc 024 ([ADR 0006](adr/0006-civic-navy-red-palette.md))
supersedes that**: one civic navy/red palette (sourced for both light and dark from a Claude Design
mockup, no variant axis), Cormorant Garamond + Lora replacing Inter, and a tab-based Home/Settings
shell replacing the single-page layout. There is no separate "brand bible" document — this file is the
single design-system reference; keep it that way rather than splitting content into a second file.

## Palette

One palette, light + dark, no `?variant=` and no variant switch — see ADR 0006 for why the three ADR
0005 accents were dropped instead of a fourth being added. Semantic token **names** carried over from
ADR 0005 unchanged (`--color-bg/surface/surface-lift/border/border-strong/text/text-muted/primary/
primary-on/glow`) changed only their **values**, so no `ui/src/` consumer needed a rename.
`--color-primary-2` was deliberately **not** added: the design's red `accent-2` ramp is recorded in
[plan 024's source map](plans/024-app-shell-redesign.md) but has no consumer in this app today (its one
use in the source, a "service notice" band, has no honest backing data here) — add the token, sourced
from the same verbatim ramp, when a real consumer exists.

Status colours (`--color-data-positive/caution/negative`) are unchanged from ADR 0005 — the design has
no equivalent tokens, so they were not part of what this arc matched.

`--shadow-card` / `--radius-card` (the A2UI result-card elevation/corner values) are also unchanged
from before this arc; they are a separate, older token pair from the new `--shadow-sm/md/lg` /
`--radius-sm/md/lg` scale below.

## Typography

**Cormorant Garamond** (weight 600 — the design's only heading weight) replaces Inter for headings;
**Lora** (400 body prose, 600 labels/section headers) replaces Inter for body copy; **JetBrains Mono**
is unchanged, still used for the dev console's numerals (footer version, event stream). All three ship
self-hosted via `@fontsource` (`ui/src/main.tsx`) — no CDN, matching the CSP's `font-src 'self' data:`
(`ui/public/_headers`). `tokens.css` defines `--font-heading` / `--font-heading-weight` / `--font-body`
/ `--font-mono`; `--font-sans` (the old Inter stack) is gone.

**Not yet wired, as of the rows merged when this file was last updated:** no heading element in
`ui/src/screens/Home.tsx` or `Settings.tsx` applies `--font-heading` yet — `<h1>`/`<h2>` there still
inherit `body`'s `--font-body` (Lora), same as prose. The token and the font import are shipped (row 1,
PR #288); applying it to actual heading markup is expected as rows 4/6 restyle those screens, which had
not yet merged when this section was written — check `ui/src/screens/*.tsx` for the current state
before assuming the serif heading treatment is visible in a running build.

## Logo

Arc 026 row 1 replaced the placeholder "qte77 mark" (a leftover from the template this app was ported
from — its own `aria-label` gave it away) with the real sortmy.london mark: a "sort" glyph, a vertical
line with an up-chevron top / down-chevron bottom (two arrows, one each direction, echoing "sortmy").
Sourced verbatim from the Claude Design canvas (`SortMyLondon.dc.html`, re-pulled 2026-09-19) — stroke
only, no fill, `stroke-width: 1.6`.

- **`ui/public/favicon.svg`** — the mark alone, transparent background (matching the design's own
  swatch), scheme-aware colour via its own `<style>` + `@media (prefers-color-scheme)` block (a
  standalone favicon document has no access to the host page's CSS custom properties, so the two hex
  values — `--color-primary`'s light/dark values — are copied verbatim, the same mechanism the prior
  mark used).
- **`ui/src/screens/Home.tsx`**'s header — the same mark inline (consuming `var(--color-primary)`
  directly, since it lives in the page DOM) beside a "sortmy.london" wordmark: `.font-heading`
  (Cormorant Garamond weight 600), with the "." coloured via `text-primary`. This is the first heading-
  weight text in `Home.tsx` to carry `--font-heading` explicitly via the `.font-heading` utility class
  (index.css) rather than only the global `h1`-`h4` tag rule.

## Home screen — hero, category grid, trust bar, recents

Arc 026 rows 2-5 closed out the remaining design↔live gaps from the same Claude Design canvas
(`SortMyLondon.dc.html`) the app shell (arc 024) and the logo (row 1, above) were built from.

- **Hero rewrite (row 2)** — `Hero()` in `ui/src/screens/Home.tsx`: a new `BoroughSwitcher` button
  replaces the old static "London public services · free, no sign-up" line, showing `{borough},
  London` from `readBorough()` or the neutral placeholder "Set your area" when unset (the design
  mock always has a borough; this app's is optional). Its "Change" affordance navigates to Settings'
  borough `<select>` via a new `onGoSettings` prop threaded `AppShell.tsx` → `Home()` → `Hero()`,
  reusing the same `setScreen`/`ScreenId` state `TabBar` already drives — no second navigation
  mechanism. The `<h1>` copy is now "What do you need sorted?" (was "Ask in your own words. Get the
  official source.").
- **Category-card icon grid (row 3)** — `CategoryCard`/`CategoryCardList`: a 2-column grid at every
  width (was 1-column below the `sm:` breakpoint), icon-only card faces. Each of the 6 catalog
  entries gets a distinct inline-SVG stroke icon (24×24, `stroke-width: 1.8`, round caps/joins,
  keyed by usecase `id` in a `CATEGORY_ICON_PATHS` map — Care: medical cross, Wander: a two-tier
  conifer, Scam Check: a shield, Food Hygiene: a 5-point star (the FSA's own 0-5 rating unit — chosen
  over a fork/knife for being literal, not just decorative), Founder's Copilot: a briefcase, Route: a
  map pin). The blurb text moves off the card face onto the button's `title` attribute; it remains
  reachable after a tap via the existing `ResultSheet` summary line (`sheetMeta()` already read
  `entry.blurb` for that; unchanged).
- **Dismissible trust bar (row 4)** — a new `TrustBar` component ("Free · No sign-up · No cookies" +
  a `×` dismiss) renders above the category grid. Unlike the design mock (which resets
  `trustBarDismissed` every mount), this app **persists** the dismissal via a new `prefs.ts`
  `readTrustBarDismissed`/`writeTrustBarDismissed` pair, matching how every other Settings-driven
  preference already persists.
- **Recently looked up (row 5)** — a new `RecentChips` component renders outline chips (reusing the
  same `CHIP_CLASS` style `SuggestionChips` already uses) above the category grid, showing the last 3
  DISTINCT usecases the user actually **selected** (a category-card or recent-chip tap —
  `submitPrompt`'s `usecaseId`-defined branch; free-text hero search is deliberately excluded,
  mirroring the design mock's own `selectCategory` trigger point). The ring buffer
  (`ui/src/screens/recentUsecases.ts`'s `pushRecent`) is most-recent-first, max 3, persisted via a new
  `prefs.ts` `readRecentUsecaseIds`/`writeRecentUsecaseIds` pair (JSON array, corrupt-safe). Tapping a
  chip re-runs that usecase's example query via the same `submitPrompt(text, usecaseId)` funnel a
  category-card tap already uses.

**Bundle-size note:** these 5 rows (logo + hero + icons + trust bar + recents) together moved the JS
bundle from ~141 kB to ~149.4 kB gzip against a 150,000 B ceiling (`ui/scripts/check-bundle-size.mjs`)
— passing, but headroom is now very thin (under 1 kB). Check `npm run size` before adding more UI.

## Spacing, radius, and shadow scale

A new fractional scale for the app-shell/Home/Settings/sheet screens, added alongside (not replacing)
the older `--radius-card`/`--shadow-card` pair above. Copied verbatim from the Claude Design mockup's
own DS — **do not round these to a 4/8px grid**:

- `--space-1: 4.6px` · `--space-2: 9.2px` · `--space-3: 13.8px` · `--space-4: 18.4px` ·
  `--space-6: 27.6px` · `--space-8: 36.8px` (note: no `--space-5`/`-7` — the design's own scale skips
  those steps)
- `--radius-sm: 2px` · `--radius-md: 4px` · `--radius-lg: 7px`
- `--shadow-sm` / `--shadow-md` / `--shadow-lg` — ink-tinted to this app's own `--color-text`-family
  values rather than the design system's own ink hex, same alpha/offset structure as the source

## Information architecture — tab-based shell

The prior single-page Dashboard is now a two-screen shell:

- **`ui/src/shell/AppShell.tsx`** holds which screen is active as in-memory React state — **never** a
  path route. `ui/public/404.html` disables the Cloudflare Pages SPA fallback (#178), so a route like
  `/settings` would hard-404 on reload or a deep link; tab/screen switching must stay client-side state.
- **`ui/src/shell/TabBar.tsx`** — a simple flow-layout (not `position: fixed`) bottom nav switching
  between the two screens.
- **`ui/src/screens/Home.tsx`** carries the prior single-page Dashboard's behaviour over unchanged: the
  `sortmy.london` header (mark + wordmark, see "Logo" above — a "what is this?" help toggle + dev-only ⚙
  Key/exit controls), the
  single free-text search input and its submit, the coverage line, suggestion chips, a sample result
  card, the A2UI result surface, and — dev-mode only (`?dev=1` / `Ctrl+K`) — the AG-UI event console and
  BYOK key panel. The header's old accent-variant swatch and light/dark theme-toggle icon are gone
  (ADR 0006); Appearance moved into Settings.
- **`ui/src/screens/Settings.tsx`** ships, as of the rows merged when this file was last updated, a
  single functional control: an **Appearance** segmented control (System/Light/Dark) — a direct 1:1
  replacement for the removed header theme toggle, reusing the same `qte77-theme` localStorage key /
  `data-theme` attribute mechanism (`ui/public/theme-init.js`, unchanged) via `ui/src/prefs.ts`. **Text
  size, high contrast, and a borough selector are designed and speced in
  [plan 024](plans/024-app-shell-redesign.md) and are landing in a parallel row (P3) that had not yet
  merged when this section was written** — check `ui/src/screens/Settings.tsx` directly for the current
  contents rather than trusting this list as exhaustive.

`ui/src/prefs.ts` is the shared preference contract behind Settings: pure, testable read/write
functions for Appearance, a font-scale, a high-contrast flag, and a default-location borough anchor
(storage/root injectable, mirroring `devmode.ts`'s existing pattern). **Appearance** is wired end to end
today (writes `data-theme`, read by `tokens.css`'s `@media (prefers-color-scheme: dark)` /
`[data-theme="dark"]` blocks). **High contrast** has a working read/write pair in `prefs.ts`, but
`tokens.css` carries no high-contrast CSS block yet — the design's own light/dark high-contrast
overrides exist only in the plan's source map, not in shipped CSS. Do not assume setting the
high-contrast preference currently changes anything visible; that wiring is Settings' row (P3).

## Accessibility commitments (unchanged by this arc)

These carried over from ADR 0005 and earlier arcs, unaffected by the palette/typography/IA rebuild:

- **WCAG AA contrast**, independently measured (relative-luminance formula, not eyeballed) for every
  palette pairing this arc introduced — numbers in ADR 0006.
- **44px minimum touch targets** (WCAG 2.5.5) on every interactive control — buttons, tabs, chips,
  inputs (`min-h-[44px]`, and `min-w-[44px]` where the control isn't already wide, e.g. header icon
  buttons).
- **`focus-visible` rings** on every interactive element: `outline outline-2 outline-offset-2
  outline-primary`, so keyboard focus is always visible without a permanent focus ring on mouse click.
- **`aria-live` announcements** for state that changes without a page navigation — the router's chosen
  workflow (`Showing: …`) and the A2UI result region both announce politely.
- **Self-hosted, CSP-clean.** `script/style/font-src 'self'` (font-src also allows `data:`); no
  third-party JS, fonts, or tiles; even `axe-core` is vendored for the e2e sweep.
