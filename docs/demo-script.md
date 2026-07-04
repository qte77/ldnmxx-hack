# Demo script — 60 seconds (the north star)

Build only what this script needs (the YAGNI filter). Everything runs **keyless/offline**; the pre-baked
replays are the safety net. Recommended primary track = **Live London** (see `submission.md`).

## Setup (before you present)
- Both use-cases pre-loaded; `on-it` replay (`ui/src/recordings/on-it.json`) ready; Track B seeded from
  `data/demo/`. Dark scheme on (see `design.md`). Sound on (TTS).

## The run

**0:00–0:12 — Hook + Track A (On It).**
> "Getting around London step-free shouldn't mean juggling three apps. Watch."
Speak: *"step-free from E8 3GT to Westminster."* → the route draws on the **OSM map** with **accessibility
markers**, the **RouteCard** lists the step-free legs, and it **reads the route back** (TTS). *(This is the
pre-recorded real run — flawless every time.)*

**0:12–0:26 — The reveal (modularity).**
> "That's one agent. Here's the trick — same endpoint, same engine."
Hit the **toggle** → the **UsecaseInspector** shows the JSON swap (`on-it.json` → `founders-copilot.json`).
> "We didn't write a second app. We swapped a JSON."

**0:26–0:52 — Track B (Founder's Copilot) — the joy moment.**
> "Now it's a founder's copilot." Type one line: *"AI tool that helps London councils cut pothole repair time."*
The journey renders progressively: **stage** ("pre-incorporation — here's what unlocks next") → **matched
grants** (real, with a qualify ✓/⚠️ gate) → **incorporate**: a **verified, one-click how-to pack** with the
*actual* gov.uk / Companies House links (name check · SIC code · register online).
> "It doesn't fake a filing — it hands you the real, verified path to incorporate, personalised to your idea."

**0:52–1:00 — Close + rebuttal.**
> "One core, two Londons. Why can't the incumbents just do this? A council app can't route on TfL's data,
> and ChatGPT doesn't have your deck. We built the join — in a day."

## The "why not just use X" rebuttals (have ready)
- **Civic (A):** TfL / FixMyStreet / boroughs can't unify without multi-year inter-agency agreement — a structural gap.
- **Founder (B):** the qualify-first gate + verified incorporation path from *your* idea — Perplexity doesn't have the deck; a generic chatbot invents the links.

## Cut lines (if behind)
- Behind on Track B → run it live only for `assess_stage` + `search_opportunities` + `incorporate`; drop `find_contacts`.
- Anything flaky → **play the replay**. The recording is the guaranteed demo.
- Worst case → Track A replay + Track B replay only; narrate the swap. Still tells the whole story.
