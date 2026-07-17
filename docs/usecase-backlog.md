---
title: "Usecase backlog — candidates beyond benefits-copilot"
type: reference
updated: 2026-07-17
refs: ["docs/data-sources.md", "docs/plans/010-civic-tool-v1.md", "docs/plans/011-benefits-copilot-wayfinder.md"]
---

# Usecase backlog

Candidate `sortmy.london` workflows beyond the v1 `benefits-copilot` (plan 011), grounded in
[`data-sources.md`](data-sources.md). Each is a JSON stage-def over `runUsecase` (+ one `render.mode` if
its card shape is new) — the same minimal-code pattern as `incorporate`/`signpost`.

**Discipline (applies to all):** corpus-grounded; for anything advice-shaped (health, money, legal,
benefits) the tool is a **wayfinder, not an adjudicator** — routes to official sources with a disclaimer,
never a determination (plan 011). Surface staleness ("as of…", "confirm by phone"); silence ≠ safety.

## Obvious — high-need

| Usecase | JTBD | Sources | Shape | Feasibility |
|---|---|---|---|---|
| **Sort My Care** ★ | find a GP/dentist/pharmacy/urgent care taking patients near me | NHS Service Directory · postcodes.io | wayfinder (medical) | **High** — near drop-in reuse of the `match_support`→`signpost` pattern |
| **Sort My Air** ★ | is the air near my kid's school / commute bad now? | LAQN · Breathe London · postcodes.io | direct (reading) + wayfinder (guidance) | **High** — single sensor API, shares postcode tool with `on-it` |
| **Sort My Bin Day** ★ | what day / which bin? | council bin data · GOV.UK Content · postcodes.io | direct | **Med** — 33-borough fragmentation → curated per-borough corpus |
| **Sort My Move** | crime/schools/green space/flood/deprivation for a postcode, in one place | police · DfE · London Datastore · EA Flood · ONS · postcodes.io | direct (informational) | **Med** — most differentiated, but 5-6 heterogeneous APIs (new "profile" render) |
| **Sort My Say** | who's my MP, what bills/petitions affect my area? | Parliament Members & Bills · Gov Petitions · postcodes.io | direct | **High** — two keyless APIs; lower daily urgency |
| **Sort My Circle** | show me community spots / green space beyond my usual streets | OSM Overpass · Historic England · FHRS · Wikidata · (Eventbrite/Meetup) | direct (discovery) | **Med-High** — keyless core is easy; events are key+ToU gated |
| **Sort My Street** | what's reported near me + how to report | FixMyStreet/Open311 · postcodes.io · OSM | direct + wayfinder-out | **Med** — Open311 borough coverage patchy; FixMyStreet owns the filing destination |

★ **Top 3: Care, Air, Bin Day** — highest need × lowest build cost (Care is nearly free plumbing-wise).
**Sort My Move** is the stronger *differentiation* pick if you want a more ambitious #3.

## Unexpected — cross-source joins & lateral value

The moat is joining sources **no incumbent joins** (each silo answers a different question; the join is
organisational, not technical — which is exactly why they stay unbuilt).

| Usecase | The non-obvious insight | Sources joined | Feasibility · risk |
|---|---|---|---|
| **Dentist Desert Alert** ★ | movers check schools, never NHS-dentistry capacity — worse and invisible until you're in pain | NHS Directory × Planning Datahub (new units/ward) × ONS (ward pop) | **High** · directory "accepting patients" is stale — caveat, don't guarantee |
| **Hidden Community Finder** ★ | the real social fabric (mutual aid, diaspora, disability/parent groups) isn't on Meetup — it's fully enumerable in the Charity Commission register | Charity Commission × postcodes.io × (Meetup as contrast) | **High** · registered address ≠ activity site — lean on the activities text |
| **Cursed Unit Detector** ★ | Companies House as *site history* — how many businesses registered then dissolved at this shop unit? | Companies House (address history) × FHRS × Planning (change-of-use) | **Med** · correlation ≠ causation — present as "worth asking why", not a verdict |
| **Complaint-to-Campaign** | 40 similar FixMyStreet reports within 500m = a mandate — but nothing links clusters to MPs/petitions | Open311 (geo-cluster) × Parliament × Gov Petitions | **Med** · over-claiming momentum from a small sample — stay descriptive |
| **Planning Radar** | the ~21-day comment window and "a building you love is about to change" hide in planning data no one watches | planning.data.gov.uk × Historic England × postcodes.io | **Med** · deadline-field coverage inconsistent per borough — show freshness honestly |
| **Rental Red Flags** | can't check landlord identity (Price Paid has no names) — but sub-E EPC + fast flip + enforcement notice compose a real due-diligence check | EPC × Land Registry Price Paid × planning enforcement | **Med** · silence ≠ safe (missing data); fuzzy cross-schema address matching |
| **Clean-Air Street Chooser** | join indoor-air proxy (EPC damp) × outdoor air × price trend to pick *where to live*, not just how to walk | Breathe London × EPC × Price Paid | **Med-High** · least original (riffs the brief's seed examples); ~400 sensors = sparse |

★ **Top 3: Dentist Desert Alert, Hidden Community Finder, Cursed Unit Detector** — highest
surprise × real value × feasibility, and each joins silos nobody else joins.

## Selection guidance

After benefits-copilot ships, the cheapest credible follow-ups are **Sort My Care** (reuses the same
wayfinder plumbing) plus one unexpected differentiator — **Dentist Desert Alert** or **Hidden Community
Finder** — to prove the cross-source-join moat that a generic chatbot can't replicate.

## Honest gaps (not padded)

- **"Work & learning"** theme is **unsourced** — see [`data-sources.md`](data-sources.md#honest-source-gaps).
- **Carbon Intensity** ("greenest hour to run the washing machine") is the single cleanest build (one
  keyless call, no corpus) but is an optimisation nicety, not high-need civic pain — parked, not ranked.
- Dropped: an incorporation-velocity "hiring demand" proxy — company counts are a noisy, likely-spurious
  signal for real jobs, and it strays into shaky career advice.
