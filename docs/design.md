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
  `sortmy.london` header (wordmark + a "what is this?" help toggle + dev-only ⚙ Key/exit controls), the
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
