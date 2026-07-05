# Demo script — 60 seconds (the north star)

Build only what this script needs (the YAGNI filter). This doc splits what's **performable today**
(shipped, keyless) from what's still **planned** (post-hackathon) — don't conflate the two on stage.

## Shipped demo (performable today)

### Setup (before you present)

- Both usecases pre-loaded (`?usecase=founders-copilot|on-it`); Track B seeded from
  `data/demo/opportunities.sample.json`. Dark scheme on (see `design.md`). `?demo=1` forces the
  keyless deterministic stub if you'd rather not risk a live model call.

### The run

**Track B (Founder's Copilot) — the joy moment.**
Type one line: *"AI tool that helps London councils cut pothole repair time."* → the model streams back
**matched grant cards** (real, with a qualify ✓/⚠️ eligibility gate), backed by
`data/demo/opportunities.sample.json`.
> "It surfaces real, qualify-gated grants for your idea — not a hallucinated list."

**The usecase toggle.**
Hit the **toggle** → it swaps the example input query and switches to `on-it` (Track A), a canned
step-free-route stub.
> "Same endpoint, same engine — a different workflow, one toggle away."

**Live A2UI component catalog.**
Open the catalog view — every registered A2UI component rendered live, proof the render surface is real.

**Optional BYOK.**
The dashboard has an optional API-key field — paste a key to run your own OpenRouter model instead of
the Worker's server-side key.

### Cut lines (if behind)

- Anything flaky → fall back to `?demo=1` (guaranteed deterministic render, no network dependency).
- Worst case → the Track B grants-cards beat only, narrate the toggle. Still tells the engine story.

## Planned beats (post-hackathon)

Everything below is **target design, not yet built** — kept as the north star for what the demo becomes
once the linked issues land. Do not perform these live; they are not shipped.

**Hook — Track A (On It), voice-driven.**
> "Getting around London step-free shouldn't mean juggling three apps. Watch."
Speak: *"step-free from E8 3GT to Westminster."* → the route draws on the **OSM map** with
**accessibility markers**, the **RouteCard** lists the step-free legs, and it **reads the route back**
(TTS). *(Planned: Web-Speech STT input, OSM map draw, TTS readback — Track A is a canned stub today.
Planned safety net: capture one clean run to `ui/src/recordings/on-it.json` and replay it — that
recording does not exist yet.)*

**The reveal (modularity) — UsecaseInspector.**
> "That's one agent. Here's the trick — same endpoint, same engine."
Hit the toggle → the **UsecaseInspector** visually shows the JSON swap (`on-it.json` →
`founders-copilot.json`). *(Planned: the inspector component isn't built yet — but the stage JSON is real
now (`usecases/*.json`, #28); today the swap is a plain UI toggle over `?usecase=`.)*

**Track B depth — incorporate.**
**stage** ("pre-incorporation — here's what unlocks next") → matched grants → **incorporate**: a
**verified, one-click how-to pack** with the actual gov.uk / Companies House links (name check · SIC
code · register online).
> "It doesn't fake a filing — it hands you the real, verified path to incorporate, personalised to your idea."
*(Planned: only the grants step ships today; stage assessment is #18, incorporate is #12.)*

**Close + rebuttal (works either way).**
> "One core, two Londons. Why can't the incumbents just do this? A council app can't route on TfL's data,
> and ChatGPT doesn't have your deck. We built the join — in a day."

### The "why not just use X" rebuttals (have ready)

- **Civic (A):** TfL / FixMyStreet / boroughs can't unify without multi-year inter-agency agreement — a
  structural gap.
- **Founder (B):** the qualify-first gate + a (planned) verified incorporation path from *your* idea —
  Perplexity doesn't have the deck; a generic chatbot invents the links.
