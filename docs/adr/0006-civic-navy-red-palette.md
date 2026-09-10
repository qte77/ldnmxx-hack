---
title: "ADR 0006 — civic navy/red palette, serif type, tab-based shell (supersedes ADR 0005)"
status: accepted
date: 2026-09-10
---

# ADR 0006 — Civic navy/red palette, serif type, tab-based shell

## Status

**Accepted** (2026-09-10), shipping across **plan 024** ("App shell redesign"). Rows 1–3 are merged
(**#288** tokens/fonts, **#289** catalog fields, **#293**+**#294** app-shell split); rows 4–6 (Home
category cards, the result sheet, the full Settings screen) are in flight in parallel worktrees as
this ADR is written and are not covered by its Status. **Supersedes [ADR 0005](0005-project-owned-theme.md)**
(the fo Linear neutrals + three trademark-safe accent variants) and the variant decision recorded in
[handoff 017](../handoffs/017-single-input-london-theme.md).

## Context

The owner published a Claude Design mockup ("Mobile app design planning" project, id
`b8ac2137-75ac-4283-b730-3da64859a2f4`, file `SortMyLondon.dc.html`) exploring a different direction
for sortmy.london: a native-app-style shell (bottom tab bar, Home/Settings) instead of the single-page
search layout ADR 0004/handoff 017 shipped; a toned-down London Underground navy + roundel red civic
palette instead of ADR 0005's three accent variants (Thames Teal / Heritage Indigo / Westminster
Green); and an editorial serif type system (Cormorant Garamond + Lora) instead of Inter. The owner
asked to "assert adherence" to this design. The scope was clarified with an `AskUserQuestion`
(2026-09-10): the owner chose a **full rebuild** — new information architecture and navigation, not
just a palette swap.

**The design canvas itself changed after work began.** Mid-session (2026-09-10, after plan 024 and
row 1 were already underway) the owner updated the design to add a real, sourced dark mode — an
`appearance: system|light|dark` prop carrying its own exact light **and** dark hex ramps — and to drop
the old `theme: classical|london` prop entirely. Before that edit, the plan's working assumption
(recorded when the `AskUserQuestion` was answered) was "keep dark as an extension of the light values,
no design source for it." That assumption is now void: dark mode is **directly sourced** from the
design's own script, not invented or extended by this project, correcting the plan's original framing.
The collapse of ADR 0005's three-variant system to one palette is unaffected by this change and is in
fact reinforced — the design never offered a variant axis at all, in either its pre- or post-edit form.

## Decision

**A single civic navy/red palette replaces the three ADR 0005 accent variants.** The design offers no
variant axis — one palette, unconditionally, in both light and dark — and when the conflict with ADR
0005's three-variant system was surfaced to the owner, they explicitly chose "single palette only," not
a fourth variant added alongside the existing three. `ui/src/tokens.css` (row 1, #288) drops all three
`[data-variant]` blocks; there is no `?variant=` parameter or swatch control any more.

**Dark mode is directly sourced, not derived.** Every colour value in both the light and dark blocks of
`ui/src/tokens.css` is copied verbatim from the design's own script — copy, not compute — unlike ADR
0005, where the dark values for two of three variants were extensions the project had to invent and
contrast-check itself. One nuance worth recording precisely, since the design names its own "accent"
token per scheme: light's named `accent` (`#2f4cc9`) is that ramp's 500 step, and this project's
`--color-primary` maps to it directly. Dark's named `accent` is `#5d78e0` — that ramp's **400** step —
but `--color-primary` (dark) is mapped to the ramp's **500** step (`#7f96e9`) instead, matching the
plan's own measured "accent-500" pairing (6.46:1) rather than the design's "accent" label (untested by
us at ~4.5:1). The design defines no "primary button/text" token by that name in either scheme — only a
named `accent` plus a numbered ramp — so which ramp step fills this project's `--color-primary` role is
a project decision made *within* the sourced ramp, not an invented value outside it.

**The shipped palette is navy, not navy-and-red.** The design's `accent-2` (red) ramp is recorded
verbatim in [plan 024's source map](../plans/024-app-shell-redesign.md), but no `--color-primary-2`
token exists in `tokens.css` today. Its only use in the source (a "service notice" band) has no honest
backing data in this app and was dropped from the rebuild rather than ship an unconsumed or
misapplied token (`tokens.css`'s own header records this). "Civic navy/red" in this ADR's title
describes the **design's** two-accent palette that was assessed and partially adopted — add
`--color-primary-2` when a later row finds a real consumer for it, sourced from the same verbatim ramp.

**Cormorant Garamond (headings) + Lora (body) replace Inter.** `ui/src/main.tsx` imports
`@fontsource/cormorant-garamond/latin-600.css` (600 is the only weight the design uses for headings) and
`@fontsource/lora/latin-{400,600}.css`; `tokens.css` adds `--font-heading`/`--font-heading-weight`/
`--font-body`. `--font-mono` (JetBrains Mono) is unchanged — the dev console keeps it. Both new
families are self-hosted (no CDN — the CSP stays `font-src 'self' data:`), matching the self-host rule
ADR 0005 already established.

**Tab-based Home/Settings replaces the single-page layout.** `ui/src/shell/AppShell.tsx` +
`TabBar.tsx` (row 2, #293) hold in-memory screen state — never a path route, since
`ui/public/404.html` disables the Pages SPA fallback (#178) and a route like `/settings` would hard-404
on reload. `ui/src/screens/Home.tsx` carries the prior single-page Dashboard's behaviour over
unchanged; `ui/src/screens/Settings.tsx` ships now with a minimal but functional Appearance control
(System/Light/Dark) as a 1:1 replacement for the removed header theme toggle.

**Contrast measured 2026-09-10, WCAG relative-luminance formula — the same rigor as ADR 0005:** light
text-on-bg 16.11:1; light accent-700-on-bg (category icon/active-tab colour) 11.74:1; light
accent-500-on-bg (outlined-button label) 6.48:1; dark text-on-bg 15.72:1; dark accent-700-on-bg
10.30:1; dark accent-500-on-bg (button label) 6.46:1. **All clear AA (4.5:1 text) with real margin, and
unlike ADR 0005's source palette, no pairing needed a forced deviation from the design's own values.**
This covers the pairings named above only — a later row introducing a new pairing (e.g. the
unconsumed accent-2/red ramp, or the design's high-contrast overrides) must be spot-checked on its own,
not assumed safe by extension. This row worked from the values already captured verbatim in plan 024's
source map rather than re-fetching the design canvas live (no `DesignSync` access in this session) —
if the canvas has changed again since 2026-09-10, the plan's captured ramps are the ones that shipped,
not necessarily the canvas's current state.

## Consequences

**Plus.** One palette instead of three collapses `tokens.css` to a single light block + one dark
override (was three variants × two schemes = six to keep contrast-valid); a sourced dark mode is a
strictly better starting position than the plan's original "no design source, invent and verify it
ourselves" assumption — nothing here needed the kind of forced deviation ADR 0005 required. Editorial
serif type and a tab-based shell match the owner's explicit rebuild direction rather than a cosmetic
palette swap grafted onto the old layout.

**Minus.** Real feature loss: users can no longer choose between three London-referencing accents —
one palette only, matching what the owner chose after the conflict was surfaced, but a reduction
nonetheless. `--font-heading` is defined in `tokens.css` and imported in `main.tsx`, but as of the rows
merged when this ADR was written, no heading element in `ui/src/screens/Home.tsx` or `Settings.tsx`
applies it yet (both still inherit `--font-body`) — the serif heading treatment is not yet visible in
the shipped UI; wiring it is expected in rows 4/6, not yet merged. Similarly, `prefs.ts` (row 2) can
read/write a high-contrast preference, but `tokens.css` carries no high-contrast CSS block — the
design's own light/dark high-contrast overrides exist only in the plan's source map today, not in
shipped CSS; that wiring is row 6's job.

**Minus — the trademark-avoidance rationale is reversed, without a trademark check.** ADR 0005
deliberately chose its three accents to **avoid** "TfL roundel red / corporate blue," calling that
avoidance a design constraint. `tokens.css`'s own header now describes this arc's palette as "a
toned-down London Underground navy + roundel red." This ADR does not assert the new palette is
trademark-safe — no trademark review was performed for this arc, and the two ADRs' framings directly
disagree. This is recorded here plainly rather than silently dropped, so a future session (or the
owner) can decide whether that earlier constraint still applies.

**Guard-rail for future sessions.** Do not "fix" the palette by re-introducing ADR 0005's variants or
by re-vendoring any upstream token file — `ui/src/tokens.css` stays project-owned, sourced from the
Claude Design mockup's verbatim values. Treat any hex value change as requiring the same
relative-luminance re-measurement this ADR and ADR 0005 both performed.
