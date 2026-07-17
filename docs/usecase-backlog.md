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

## Committed next set (fold)

After v1 `benefits-copilot`, the pursued roadmap is:

- **High-need trio:** Sort My Care · Sort My Air · Sort My Bin Day.
- **Runner-ups:** Sort My Move · Sort My Say · Sort My Circle.
- **Cross-source joins (the moat):** Dentist Desert Alert · Hidden Community Finder · Cursed Unit Detector.
- **Work & learning:** Sort My Work (now sourced — see [`data-sources.md`](data-sources.md)).

Sequence: ship the cheap keyless/live-API ones first (Care, Say, Air); gate curated-corpus + advice-shaped
ones (bins, benefits, work) behind a partner + real corpus (plan 010). Each is a `usecases/*.json` stage-def
(+ one `render.mode` if new).

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
| **Sort My Work** | jobs/apprenticeships + local labour-market context near me | Adzuna/Reed · DfE apprenticeships · Nomis · GOV.UK Content | direct + wayfinder (careers) | **Med** — keyed job APIs + curated course corpus; DWP Find-a-job has no API |

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

## Round 2 candidates (under evaluation)

A second ideation pass — promising, not yet committed; some depend on sources still being verified.

**Obvious:** Sort My Flood Risk (EA Flood — keyless, wayfinder) · Sort My Food Hygiene (FHRS — direct) ·
Sort My Rep (Parliament × postcodes — who's my MP / am I registered / next election) · Sort My Commute
(National Rail Darwin × TfL × Met Office — *Darwin needs a token*) · Sort My Crisis Support
(foodbank finder via **Give Food API** — keyless, confirmed; aggregates Trussell + independents) · Sort My Council Tax Band
(VOA — *no open API confirmed → corpus*).

**Unexpected:** **Sort My Scam Check** (FCA Register × Companies House — clone-firm fraud check; top pick) ·
Sort My School Run (Breathe London × OSM school locations — gate-time air exposure) · Sort My Next Step
(Nomis × DfE apprenticeships × Adzuna — local jobs ↔ apprenticeship-capacity *mismatch*, not a job board) ·
Sort My Contract (Contracts Finder × 360Giving × Companies House — *coverage-limited*).

**Cut (not padded):** cycle-safety routing (too close to On It) · sport finder (dupes Sort My Circle) ·
landlord-ownership trace (dupes Rental Red Flags) · heritage trails (delight, not need) · charity
governance (serves trustees, not residents).

## Round 3 candidates (leveraging the newer sources)

Third pass, mining the round-2/3 source additions (TfL BikePoint/CID/StopPoint, OpenActive, Skiddle,
Octopus, Historic England, Wikidata, V&A/Science Museum, CQC, Contracts Finder/FTS, 360Giving, Give Food,
EA Bathing Water, MapIt, Nomis, Land Registry SPARQL). Promising, not committed.

**Obvious:** Sort My Cycle Now (BikePoint × CID × Road Disruptions — go/no-go for a spontaneous ride) ·
Sort My Sweat (OpenActive × Cultural Infra — free drop-in sport in the next hour) · Sort My Ride Home
(Skiddle × TfL last-service — will I get home tonight?) · Sort My Warm Hours (Octopus Agile × Met Office
cold-alert × library warm-space — *wayfinder, money-adjacent*).

**Unexpected:** **Sort My Wander** ★ (Historic England NHLE × Wikidata × museum collections — free/obscure
heritage near you; zero advice risk, ready now) · **Sort My Care Group** ★ (CQC × Companies House — a "Good"
location inside a troubled *chain*; strict wayfinder, fuzzy entity-match is the moat *and* the risk) ·
**Sort My True Cost** ★ (EPC × Octopus Agile × Land Registry — true occupancy cost of a flat, not headline
rent; wayfinder, show a range) · Sort My Ward's Fair Share (360Giving × Nomis × MapIt — wards funders
overlook) · Sort My Surplus (Give Food per-foodbank need × FHRS × Companies House — route a business's
surplus to the foodbank that needs *that item today*) · Sort My Swim (EA Bathing Water × rainfall/CSO risk
— today's safety vs a weeks-old grade; strict caution flag) · Sort My Watchdog Lead (Contracts Finder ×
Companies House × WhatDoTheyKnow — "worth an FOI" leads; *highest defamation risk — read-only facts only*).

★ **Top 3: Sort My Wander, Sort My Care Group, Sort My True Cost.**

**Cut:** Octopus appliance-timer (Octopus's app already does it — no moat) · heritage-flood (audience too
narrow) · CKAN meta-tool (a means, not an answer) · Sort My Empty Shop (VOA vacancy data too stale).

## Honest gaps (not padded)

- **"Work & learning"** theme is now partly sourced — see [`data-sources.md`](data-sources.md).
- **Carbon Intensity** ("greenest hour to run the washing machine") is the single cleanest build (one
  keyless call, no corpus) but is an optimisation nicety, not high-need civic pain — parked, not ranked.
- Dropped: an incorporation-velocity "hiring demand" proxy — company counts are a noisy, likely-spurious
  signal for real jobs, and it strays into shaky career advice.
