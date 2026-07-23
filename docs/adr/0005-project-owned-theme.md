---
title: "ADR 0005 — sortmy.london owns its theme: diverge from the vendored qte77 brand default"
status: accepted
date: 2026-07-23
---

# ADR 0005 — Project-owned theme

## Status

**Accepted** (2026-07-23) and shipped with **plan 017 · P1**. Governs `ui/src/tokens.css` and every
consumer of its tokens.

## Context

`ui/src/tokens.css` is **vendored byte-identical** from `qte77/brand · ui-kit/tailwind/tokens.css`
and its header instructs: *"DO NOT hand-tune values — edit `brand/DESIGN.md` upstream and
re-vendor."* That default is the flagship **EyeRest** palette: warm parchment surfaces
(`#ece8d8` / `#1c1a14`), a single amber primary (`#7a6010` / `#c8a858`), zero blue by design.

The owner has explicitly rejected flat EyeRest for this product and pointed at **fo-scraper-miwi**
(`brand/DESIGN.md` — the origin of the `linear.css` system; sfclarity adopted the same pattern):
near-black/near-white neutrals, one accent, one glow, one motion language, fluid `clamp()` headings.
Notably fo **deleted `eyerest.css`** and its accent is deliberately blue/indigo — something the
EyeRest brand forbids. So the target look is not reachable by re-vendoring or by an upstream variant.

Additionally the product is a **London** civic assistant and wants a trademark-safe London accent
(avoiding TfL roundel red / corporate blue).

## Decision

**`sortmy.london` owns its theme locally.** `tokens.css` is no longer a vendored artifact of
`qte77/brand`; it becomes a project-maintained file carrying:

- the **fo Linear neutrals** — light `bg #fcfcfd`, `surface #f4f5f7`, `surface-lift #ffffff`,
  `border #cfd3da`, `text #0d0e0f`, `text-muted #4b515b`; dark `#08090a` / `#0f1011` / `#141516` /
  `#23252a` / `#f7f8f8` / `#8a8f98`;
- **three trademark-safe London accent variants** selected by `[data-variant]`, each light + dark —
  **A Thames Teal `#0e7581` / `#2ea9b6` (default)**, **B Heritage Indigo `#4b53c4` / `#7b86e3`**,
  **C Westminster Green `#2f6f4f` / `#4fae82`**;
- semantic status colours and a single accent glow (`--color-glow`, derived from the active accent).

### Three deviations the P1 measurement forced

Every pair above was computed against WCAG 2.x, not eyeballed. Three upstream values did not survive
contact with the measurement, and each is annotated `MEASURED` in `tokens.css`:

1. **B Heritage Indigo dark is `#7b86e3`, not fo's `#5e6ad2`.** fo's value is **3.89:1** on the dark
   card surface (`--surface-lift #141516`) and 4.24:1 on the page — below AA for text, and it is the
   colour links and the CTA label are painted in. `#7b86e3` clears every pairing (5.54–6.30:1). This
   was caught before shipping precisely because the sweep now scans all six combinations.
2. **Light mode carries deepened semantic colours.** fo's `#e5484d` / `#0ca30c` / `#e5a50a` are tuned
   for a dark UI and measure **3.59 / 3.08 / 1.98** on the light neutrals. Light uses `#c62828` /
   `#157347` / `#8a5a00` (5.15 / 5.38 / 5.43); dark keeps fo-family values.
3. **A second border token exists.** fo's hairline `--border` is ~1.4:1 against its surfaces, which
   is right for a decorative card edge but fails WCAG 1.4.11 where a border IS the affordance — a
   text input, a toggle. `--color-border-strong` (`#767c88` / `#62666e`, 3.2–4.2:1) is used by
   controls only; the hairline keeps its decorative job.

Typography and the self-host rule are **kept** from the shared practice: Inter + JetBrains Mono,
self-hosted via `@fontsource` (no CDN), CSP stays `'self'`.

The vendoring header in `tokens.css` is replaced with a pointer to this ADR.

## Consequences

**Plus.** The product gets the intended non-flat look and a London identity without touching the
shared brand; accents are contrast-validated for this app's actual surfaces; the variant mechanism
mirrors the existing `theme-init.js` / `ThemeToggle` pattern, so there is one idiom for both axes.
Owning the file also retired a workaround: `index.css` used to hardcode a deepened `#725810` for
links because the vendored amber was 4.42:1 and the token could not be touched (#154). The fix now
lives in the token, and no hex remains outside `tokens.css` (bar `<meta name="theme-color">`, which
takes no `var()`).

**Minus.** The theme **no longer auto-tracks `qte77/brand`**: upstream fixes (a11y tweaks, new
tokens) must be ported by hand if wanted. Three variants × two schemes = six palettes to keep
contrast-valid, and the e2e sweep grows to a 6-combination matrix.

**Guard-rail for future sessions.** Do **not** "fix" the divergence by re-vendoring
`qte77/brand`'s `tokens.css` — that would silently revert the product to flat EyeRest. Treat
`ui/src/tokens.css` as owned source, and change accents only with contrast + CVD re-validation.
