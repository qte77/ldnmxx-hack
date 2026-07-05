# Use-case workflows

> **This doc is the TARGET design.** Only a subset ships today — see the shipped/planned tags below.
> Today, stages are hardcoded TypeScript switches in `worker/src/worker.ts`, not `usecases/*.json` files
> (externalizing them is planned, #28); the schema below describes the planned JSON shape.

The two workflows the Worker's `runStages` interprets, + judging alignment.
One endpoint: `POST /run?usecase=<id>`. Render = **built-in A2UI cards** (AG Grid deferred).

## Stage-def schema (KISS — zod-validated at load)

```jsonc
{
  "id": "founders-copilot",
  "title": "Founder's Copilot",
  "systemPrompt": "…catalog-authoring rules + task framing…",  // top-level (adapter), not per-stage
  "tools": ["assess_stage", "search_opportunities", "find_contacts", "incorporate"],
  "stages": [
    { "kind": "plan",   "id": "understand" },
    { "kind": "tool",   "id": "stage",  "tool": "assess_stage" },
    { "kind": "render", "id": "s-card", "component": "StageCard", "from": "stage" }
  ]
}
```
`kind ∈ {plan,tool,render}` · `render.component` = a built-in A2UI structure (Column/Card/Text) ·
`render.from` = the stage id whose output it renders. Each stage → one SSE `{type,text,a2uiMessages}`
event + one Arize span.

## Track B — Founder's Copilot (one-click founder journey)

**Shipped today:** only `search_opportunities` (→ grant cards, real model call with a deterministic stub
fallback). `assess_stage` (#18), `find_contacts` (#9), and `incorporate` (#12) below are **target
design, not built**.

**User:** an early-stage London founder (idea → prototype → pre-incorporation). **Describe the idea once →
the journey renders progressively (feels like one click):**

```
RUN  /run?usecase=founders-copilot   (one-line idea + optional artifacts)
  plan(understand the idea)
    → tool(assess_stage)         → render StageCard       (idea|proto|pre-inc|incorporated + what unlocks next)
    → tool(search_opportunities) → render OpportunityCards (grants matched to project+stage; eligibility gate)
    → tool(find_contacts)        → render ContactCards    (who to talk to for THIS idea + why)
    → tool(incorporate)          → render IncorporateCard  (name check + pre-filled pack + one-click CTA)
```

- **assess_stage** *(PLANNED, #18)* — LLM over the idea (no API): stage + the 1–2 things that unlock the next stage. Fast, keyless.
- **search_opportunities** *(SHIPPED)* — real model call (deterministic stub fallback) over
  `data/demo/opportunities.sample.json` (no KV, no funding API in the pack). Record
  `{id,title,org,deadline,category,score,whyItFits,sourceUrl}` + `eligibility{qualified,met[],missed[]}` (qualify-first gate).
- **find_contacts** *(PLANNED, #9)* — **pre-scraped `contacts` corpus** (accelerators · grant offices · London
  startup-support orgs · public investor lists) → match to the idea + the surfaced grant orgs. Pre-scraping
  **fixes the earlier softness** (real, verifiable contacts, not LLM-hallucinated); the LLM only ranks/explains.
- **incorporate** *(PLANNED, #12)* — **Companies House API** (a Build-London pack resource): name-availability check (read) +
  pre-filled pack + one-click CTA. **Not a live filing** (needs auth + £50 fee + PSC data) — honest one-click *feel*. **New joy moment.** **Verified how-to pack** (curated real links, *never* LLM-generated),
  lightly personalised (suggested name + matched SIC). Verified 2026-07: name check →
  `find-and-update.company-information.service.gov.uk` · SIC → `resources.companieshouse.gov.uk/sic/` ·
  **identity (GOV.UK One Login — now required)** → `identity.company-information.service.gov.uk` · register
  (£50) → `gov.uk/limited-company-formation/register-your-company` · steps → `gov.uk/set-up-limited-company`.
  We hand over the *real* path — no fake filing. *(links as A2UI `Text`; clickable anchors in the chrome,
  since `Button.onAction` is unwired.)*
- **Render:** built-in `Column` of `Card`s; progressive reveal = accumulate a **self-contained batch per step**
  (agenthud `replaySnapshot`). ⚠️ interactive CTAs need `Button.onAction` wired (agenthud's known gap) — wire it or use a link.
- **Demo-critical** (ambitious): assess_stage + search_opportunities + incorporate; `find_contacts` is now
  grounded by the pre-scraped `contacts` corpus (no longer the soft spot). Drop the weakest only if time is tight.

**Track B data — pre-scrape as much as possible (→ KV; keyless at request time):**
*(PLANNED — no KV binding exists today; `search_opportunities` reads
`data/demo/opportunities.sample.json` directly. KV wire-or-drop is tracked in #29.)*
- `opportunities` — grants/accelerators (polyfetch seed). The core corpus.
- `contacts` — accelerators · grant offices · support orgs · public investor lists (grounds `find_contacts`).
- `eligibility` — structured criteria of the top 3–5 programs → machine-readable rules (the qualify gate / Eligibility Oracle).
- `reference` — **SIC codes** + incorporation checklist + a stage rubric (bundle static, or one-shot scrape).

So request-time Track B is **mostly KV-read + LLM composition** — the LLM *matches/explains over grounded
data* instead of inventing it (less hallucination = better idea-validation + trust). **Can't pre-scrape:**
the founder's own idea (`assess_stage` input) and Companies House **name availability** for the user's chosen
name (live, or mocked for the demo). Staleness → re-seed = cron (deferred #12); `data/demo/` = offline fallback.

## Track A — On It (thin swap)

**Shipped today:** none of this — Track A is a **canned stub** (static `buildRouteCards()` text,
always the same demo route, no live tools). Everything below (voice, postcodes.io, TfL, OSM/Overpass,
the replay) is **target design, not yet built**.

**User:** a mobility-constrained Londoner. **Thin = route only** (the modularity proof):

```
RUN  /run?usecase=on-it   (voice: "step-free from E8 3GT to Westminster")
  plan(parse origin postcode + destination)
    → tool(lookup_postcode: postcodes.io → borough + coords + nearest step-free station)
      → tool(get_tfl_journey: TfL Journey → step-free route + disruption)
        → render(RouteCard: legs · step-free ✓ · duration · disruptions)  +  RouteMap panel (OSM)
```

- Tools Tier-0 **keyless** (postcodes.io; TfL read path). Input = **voice** (Web Speech STT + text fallback).
- **OSM map (lean render seam):** an adjacent, **lazy-loaded** `RouteMap` panel — Leaflet + **keyless OSM
  raster tiles** (attribution shown, **read-only**) — draws the route + markers from the same postcodes.io/TfL
  coords. **Not** a custom A2UI component: no registration, no new render schema (stays consistent with
  AG-Grid-deferred). It's a companion panel in `DashboardShell`, lazy so it never touches Track B's bundle.
  *(Even-leaner fallback: a built-in A2UI `Image` with a static-map URL — but keyless static maps are flaky;
  prefer the lazy Leaflet panel.)*
- **Accessibility overlay (on-theme, lean) — the "easy-access" layer:** OSM already carries the data
  (`wheelchair=yes|limited|no`, `highway=elevator`, `ramp`, `tactile_paving`). Query **Overpass** (keyless)
  for these near the route → **color-coded markers** on the `RouteMap` = step-free/accessible points for the
  mobility-constrained user (directly reinforces Track A's idea-validation). **Cache/wiremock the Overpass
  result** for a deterministic demo (Overpass is rate-limited). *(A pre-rendered Wheelmap tile layer may
  exist, but its keyless-embed ToU is unconfirmed — prefer Overpass markers we control + OSM attribution.)*
- **Track A = side project → pre-record it (from the REAL workflow, not a faked JSON).** Build the keyless
  loop **STT → postcode → path (+ map/a11y) → TTS** once, run it, and **capture the SSE stream →
  `ui/src/recordings/on-it.json`**; the demo plays it via `useReplayEngine` (our offline safety-net engine).
  This **bounds A's build effort** (record one clean run) and removes live flakiness (STT recognition,
  TfL/Overpass rate-limits, TTS latency) from the secondary track.
- **TTS is now feasible** (was deferred): pre-generate once → play via the **built-in A2UI `AudioPlayer`**
  (bundled clip) and/or keyless Web Speech **`speechSynthesis`**. No live ElevenLabs dependency; a nicer
  ElevenLabs clip can be baked in optionally. So the recorded loop is full **voice-in → voice-out**.
- **Keep the `RouteCard`** (screen-reader text) alongside the map hero — map-only is an a11y anti-pattern
  for an a11y app, and RouteCard is the A2UI render-seam element.
- **Caveat:** a recording is one scripted route (can't take arbitrary live voice); the live path still
  exists as a fallback if a judge wants to try their own input.
- **Deferred (full A):** Open311 `file_report` write + `ReportCard`; the heavier **custom
  A2UI `Map` component** variant (agent-emitted `{Map:…}`, #19's original — needs registration). No
  reporting/submitting on the day.

## Judging alignment

Target design, not a status report — see shipped/planned tags above. Honest today-state:

| Criterion | Track B | Track A |
|---|---|---|
| **Idea validation** (Londoner evidence) | ⚠️ off-resource; lean on JTBD + qualify gate | target design only — canned stub today, no live demand signal |
| **Technical** (stack) | shipped: `runStages`, real OpenRouter render + stub fallback, Arize console spans, built-in A2UI. Planned: KV, AI Gateway wiring (#29), Companies House | planned only: same engine, but no live tools/voice yet — stub renders static cards |
| **Project readiness** | grants beat fully built; stage/contacts/incorporate planned | thin canned stub; full E2E is planned |
| **UX/design** | ✅ watch-it-work HUD, one-click journey, EyeRest theme | planned: voice accessibility — not shipped |

**Strategy:** A carries idea-validation; B carries the UX joy. Pitch primary track → one-click swap to the
other = the single move that covers all four criteria (once the planned work above lands). See
`submission.md`.
