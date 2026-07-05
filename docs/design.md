# Design — EyeRest, turned up for the demo

**Base = the qte77 brand: `qte77/brand/DESIGN.md` (EyeRest).** Reuse it, don't re-author (port the tokens
via issue #20). This file is the **project layer**: how we make it *shiny + wantable* for judging's UX
criterion **without breaking the brand's guardrails**.

## Inherit verbatim (the brand)
- **Zero-blue, warm.** Palette + light/dark + the 4 variants come from `brand/DESIGN.md`. Reference **tokens,
  never hex** — so scheme/variant flips re-resolve everything.
- **Type:** Inter (UI/prose) + JetBrains Mono (numeric/code), self-hosted. No third font.
- **Shapes:** 4/6/12px radii. **8px** spacing unit.
- **Hard rules (do NOT break):** no blue accent · no gradients · no decorative shadows *(one functional-elevation
  token, `--shadow-card`, is allowed for the A2UI card surface — ported from base PR #168; decoration still banned)* ·
  no third font · no hardcoded hex.

## The "shiny" layer (project choices, all on-brand)
1. **Dark by default.** The brand says *dark = default for dashboards* — ldnmxx is a HUD, so ship dark-first.
   Warm near-black surfaces + one glowing amber = premium, not flat.
2. **Pick the vibrant variant: BluBlock.** Its amber is the punchiest on-brand accent
   (`#c06010` light / **`#e89030`** dark) — still zero-blue. Use it as the app default for extra pop.
   *(Default EyeRest amber `#7a6010`/`#c8a858` is the quieter fallback.)*
3. **Motion carries the shine** (the brand forbids gradients and decorative shadows, not motion):
   - Cards **fade + rise** as each stage renders (the progressive journey unfolding).
   - Text **streams** token-by-token (the "agent is working" feel).
   - The **B⇄A swap** cross-fades. *(The UsecaseInspector JSON diff highlight is planned — no such
     component exists yet; today the swap is a UI toggle over `?usecase=`, not a JSON diff.)*
   - Keep it **subtle + fast** (120–200ms, ease-out). Jank reads worse than still.
4. **One over-polished signature moment** (pick ONE, make it sing): the **incorporate "✓ ready"** beat —
   the amber primary fills, a check draws in, the verified links slide up. That's the memory judges keep.
5. **Amber = the single pointer.** Let whitespace + weight carry hierarchy; the amber marks the *one* primary
   action per view (the mic, the "start", the incorporate CTA).

## "Considered" = accessibility as visible craft (on-theme for Track A)
- WCAG-AA contrast (the brand tokens are already 5:1–10:1) · real **focus rings** (amber) · keyboard nav ·
  `aria` labels · the screen-reader **RouteCard** beside the map · visible step-free markers. For a mobility
  app this is *design*, not compliance — and judges see the intent.

## Where the shine lives (architecture)
The A2UI surface (Card/Text/Column) is constrained — **theme it and keep it clean**. Put the polish in the
**`DashboardShell` chrome** (your own React/Tailwind): the hero, the streaming EventStream, the map panel,
the signature moment, the sponsor footer. Full design freedom there.

## Wantable = feels like a product
- A crisp **hero per track** (name · one-line value · one obvious input: mic / textarea).
- **Real data**, not lorem (real grants, a real route). A **wordmark + favicon**.
- A live **cost/latency chip** (amber) = trust + techy shine. **Skeleton loaders** while a tool runs.

## Polish checklist (cheap → do)
- [x] Port EyeRest tokens (#20) · dark-first · BluBlock variant
- [ ] Fade-rise card reveals + streaming text (120–200ms)
- [ ] The one signature moment (incorporate ✓)
- [ ] Focus rings + aria + contrast pass
- [ ] Hero + single input per track · wordmark/favicon · cost chip · skeletons
