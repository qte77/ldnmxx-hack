# Use-case workflows

> **Stage choreography ships as `usecases/*.json`** (#28) — the schema below is the real, shipped shape,
> read at runtime by the `runUsecase` interpreter (`worker/src/usecases.ts`). Deeper *tool behaviours*
> (assess_stage reasoning, live routing, …) remain **target design** — see the shipped/planned tags per section.

The workflows the Worker's `runUsecase` interpreter plays, + judging alignment.
One endpoint: `POST /run?usecase=<id>`. Render = **built-in A2UI cards** (AG Grid deferred).

## Stage-def schema (shipped — guarded at load)

```jsonc
{
  "id": "founders-copilot",
  "title": "Founder's Copilot",
  "render": { "mode": "founders" },        // "founders" (model + stub fallback) | "route" (canned) | "corpus" (generic deterministic corpus query) | "scam" (deterministic firm-lookup match)
  "stages": [
    { "name": "plan", "kind": "plan", "events": [
      { "type": "STEP_STARTED", "text": "understand the idea" },
      { "type": "TEXT_MESSAGE_CONTENT", "text": "Assessing your stage and matching funding…" } ] },
    { "name": "tool:search_opportunities", "kind": "tool", "events": [
      { "type": "TOOL_CALL_START", "text": "search_opportunities" },
      { "type": "TOOL_CALL_END", "text": "search_opportunities" } ] }
  ]
}
```
Each pre-render `stage` plays its `events` (paced) over SSE and emits one Arize span named `name`. The
final render stage is dispatched by `render.mode` to a code path — prompts, card builders and the model
call stay in `worker/src/worker.ts`, not embedded in JSON — emitting the `render_ui` batch + a `render`
span. Adding a JSON (plus its render mode, if new) adds a workflow.

## How to add a workflow (the general engine)

Dispatch is table-driven via `worker/src/workflows.ts` (`registry.render` by `mode`, `registry.query` by
`exec`). Since #80 the corpus mode + exec are **generic over a corpus id**, so a deterministic corpus
workflow is **register-only** — no new mode, no new exec, and no edit to
`runUsecase`/`renderBatch`/`cardsBatch`:

1. **Corpus** — hand-authored synthetic `data/<workflow>/*.json` (real ingest + CF D1 are follow-ups).
2. **Register it** — one entry in `worker/src/corpus/registry.ts`: `records` + `postcodes` + `labels`
   (noun, summary line, the **curated** official link, and the two empty-state hints). The official link
   lives here in reviewed TS, never in usecase JSON.
3. **Usecase JSON** — `usecases/<id>.json` with `"render": { "mode": "corpus" }` and a `tool` stage
   `"exec": "query_corpus", "corpus": "<id>"`; add the import + entry to the `usecases.ts` registry map.
   An unregistered `corpus` id is a **startup error**, not a silently empty batch.
4. **UI** — a `USECASES` entry in `ui/src/App.tsx` (civic ones surface; demos stay `?usecase=`).
5. **Tests** — the generic `queryCorpus`/`buildCorpusCards` modules are already covered
   (`corpus.test.ts`, `corpus.render.test.ts`); a new corpus is data, so it needs no new module tests.
   The `usecases.contract.test.ts` ajv check runs automatically over the new JSON.

Only a genuinely new *retrieval shape* (e.g. a name/number match rather than nearest-N) needs code: a new
`QueryFn` registered under a new `exec`. It reuses the same `corpus` render, because each row carries its
own pre-formatted display line. Query fns return a `Promise` so a D1-backed corpus can replace the bundled
JSON without touching the seam.

Deterministic workflows report `USAGE mode:demo` (honest — not a degraded `stub`) and each stage emits an
Arize span (`run`/`plan`/`query`/`render`). See **Sort My Care** below and ADR
[`0001-general-workflow-engine.md`](adr/0001-general-workflow-engine.md).

**Shared contract:** `id` + `stages[].name` (this schema's `span` field, renamed) is also the
`workflow-definition/v1` envelope published by `qte77/protocols` and consumed by the sibling Python
doc-workflows engine (`qte77/azure-doc-workflows`) — see `usecases/README.md`. The per-run `USAGE` event
(mode/model/tokens; see `docs/architecture.md`'s HUD status bar section) is a **B-local SSE extension**: it
rides the same stream as the stage/render events but is not part of the shared workflow-definition
contract, which only describes the static stage choreography, not the runtime event stream.

## Founder's Copilot (one-click founder journey)

**Shipped today:** `search_opportunities` (→ grant cards, real model call with a deterministic stub
fallback) and `incorporate` (→ the verified how-to-pack Card of real gov.uk / Companies House links).
`assess_stage` (#18), `find_contacts` (#9), and the live Companies House *filing* (#12) below are
**target design, not built**.

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
- **incorporate** *(SHIPPED — verified how-to-pack card; live filing still #12)* — **Companies House API** (a Build-London pack resource): name-availability check (read) +
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

**Founder's Copilot data — pre-scrape as much as possible (→ KV; keyless at request time):**
*(PLANNED — no KV binding exists today; `search_opportunities` reads
`data/demo/opportunities.sample.json` directly. KV wire-or-drop is tracked in #29.)*
- `opportunities` — grants/accelerators (polyfetch seed). The core corpus.
- `contacts` — accelerators · grant offices · support orgs · public investor lists (grounds `find_contacts`).
- `eligibility` — structured criteria of the top 3–5 programs → machine-readable rules (the qualify gate / Eligibility Oracle).
- `reference` — **SIC codes** + incorporation checklist + a stage rubric (bundle static, or one-shot scrape).

So request-time Founder's Copilot is **mostly KV-read + LLM composition** — the LLM *matches/explains over grounded
data* instead of inventing it (less hallucination = better idea-validation + trust). **Can't pre-scrape:**
the founder's own idea (`assess_stage` input) and Companies House **name availability** for the user's chosen
name (live, or mocked for the demo). Staleness → re-seed = cron (deferred #12); `data/demo/` = offline fallback.

## On It (thin swap)

**Shipped today:** none of this — On It is a **canned stub** (static `buildRouteCards()` text,
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
  AG-Grid-deferred). It's a companion panel in `DashboardShell`, lazy so it never touches Founder's Copilot's bundle.
  *(Even-leaner fallback: a built-in A2UI `Image` with a static-map URL — but keyless static maps are flaky;
  prefer the lazy Leaflet panel.)*
- **Accessibility overlay (on-theme, lean) — the "easy-access" layer:** OSM already carries the data
  (`wheelchair=yes|limited|no`, `highway=elevator`, `ramp`, `tactile_paving`). Query **Overpass** (keyless)
  for these near the route → **color-coded markers** on the `RouteMap` = step-free/accessible points for the
  mobility-constrained user (directly reinforces On It's idea-validation). **Cache/wiremock the Overpass
  result** for a deterministic demo (Overpass is rate-limited). *(A pre-rendered Wheelmap tile layer may
  exist, but its keyless-embed ToU is unconfirmed — prefer Overpass markers we control + OSM attribution.)*
- **On It = side project → pre-record it (from the REAL workflow, not a faked JSON).** Build the keyless
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

## Sort My Care (deterministic corpus signpost)

**Shipped (#72; generalised in #80):** a **model-free + fetch-free** workflow on the general engine —
`render.mode:"corpus"`, a `plan` stage + a `tool` stage (`exec:"query_corpus"`, `corpus:"care"`). The
proof that adding a corpus workflow is register-only, not an engine edit — Care is now just the first
entry in the corpus registry.

**User:** any Londoner who needs a nearby public health/care service (GP, pharmacy, urgent care, dentist,
mental health).

```
RUN  /run?usecase=sort-my-care   (postcode as the run prompt, e.g. "SW9 9SL")
  plan(read your postcode)
    → tool(query_corpus, corpus=care)  → deterministic query: normalise postcode → nearest-N over the corpus
      → render(corpus cards: nearest services · distance · why · official link · freshness + disclaimer)
```

- **Query** — `worker/src/corpus/query.ts` `queryCorpus`: resolves the corpus by id, `shared/sanitize.ts`
  normalises the postcode (the security boundary; **no SSRF** — no external fetch), `worker/src/geo.ts`
  does haversine + nearest-N over the bundled **synthetic** corpus (`data/care/services.sample.json` +
  `postcodes.sample.json`). Each row's secondary line (`"NHS A · 0.4 km"`) is formatted HERE, so the render
  never sees a distance. Invalid/unknown postcode → a graceful "enter a valid postcode" / "none nearby" state.
- **Render** — `worker/src/corpus/render.ts` `buildCorpusCards` reuses `cardsBatch` + `appendDisclaimer`: a
  summary card (count + "data as of &lt;lastUpdated&gt;"), one card per row, and a curated
  "confirm with the official source" disclaimer — the link comes from the corpus's `labels.officialLink`
  (real NHS link for Care, **never** generated).
- **Honesty** — the run reports `USAGE mode:demo` (deterministic, not a degraded stub); freshness is shown in
  the render; it **signposts**, never triages/adjudicates. Real ingest + CF D1 (#13) are follow-ups.

## Judging alignment

Target design, not a status report — see shipped/planned tags above. Honest today-state:

| Criterion | Founder's Copilot | On It |
|---|---|---|
| **Idea validation** (Londoner evidence) | ⚠️ off-resource; lean on JTBD + qualify gate | target design only — canned stub today, no live demand signal |
| **Technical** (stack) | shipped: `runUsecase` over `usecases/*.json`, real OpenRouter render + stub fallback, Arize console spans, built-in A2UI. Planned: KV, AI Gateway wiring (#29), Companies House | planned only: same engine, but no live tools/voice yet — stub renders static cards |
| **Project readiness** | grants + incorporate cards built; stage/contacts planned | thin canned stub; full E2E is planned |
| **UX/design** | ✅ watch-it-work HUD, one-click journey, EyeRest theme | planned: voice accessibility — not shipped |

**Strategy:** On It carries idea-validation; Founder's Copilot carries the UX joy. Pitch the primary
workflow → one-click swap to the other = the single move that covers all four criteria (once the planned
work above lands). See `submission.md`.
