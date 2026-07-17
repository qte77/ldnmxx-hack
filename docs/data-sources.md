---
title: "Data sources — the corpus sortmy.london can build on"
type: reference
updated: 2026-07-17
source: "https://resources.londonmaxxing.com/"
---

# Data sources

Canonical catalog of the open data / APIs available to `sortmy.london` workflows, taken from the
Londonmaxxing resources page (`resources.londonmaxxing.com`). **Single source of truth** — usecases
(`usecases/*.json`) and the idea backlog ([`usecase-backlog.md`](usecase-backlog.md)) reference this
instead of re-listing sources.

**Rules of use**

- Prefer **keyless** sources (no secret; work at request time).
- Keyed sources → the key is a **Worker secret**, never in the SPA bundle.
- ToU-gated / redistribution-limited sources (e.g. Eventbrite, Meetup) follow the repo data rule:
  scraped/cached data lives in `data/real/` (**gitignored**); only synthetic `data/demo/` is committed.
- A source without a clean keyless JSON API needs a **curated corpus** — Workers bundle data at build
  time and can't do dynamic file reads, so "live scraping" is out; curate + ship, same discipline as
  benefits-copilot's seed corpus (plan 011).
- URLs below are as listed on the resources page — spot-check spelling before hardcoding into configs.

## Transport & mobility

| Source | Provides | Access | URL |
|---|---|---|---|
| TfL Unified API | live transit, line status, disruption, step-free accessibility | free key | `api.tfl.gov.uk` |

## Geo & mapping

| Source | Provides | Access | URL |
|---|---|---|---|
| postcodes.io | postcode → borough/coords/constituency | keyless | `api.postcodes.io` |
| Ordnance Survey Data Hub | maps, geocoding, vector tiles | free OpenData tier | `osdatahub.os.uk` |
| OSM Overpass | mapped features — ramps, lifts, benches, fountains, toilets, venues | keyless | `overpass-api.de` |
| Wikidata | structured facts for places | keyless | `query.wikidata.org` |

## Gov / civic / environment

| Source | Provides | Access | URL |
|---|---|---|---|
| GOV.UK Content API | official guidance + scheme rules | keyless | `content-api.publishing.service.gov.uk` |
| GOV.UK Licence Finder | business licensing requirements | open | `gov.uk/licence-finder` |
| NHS Service Directory | GPs, dentists, pharmacies, urgent care by location | free key | `digital.nhs.uk/developer` |
| data.police.uk | street-level crime, stop & search | keyless | `data.police.uk/docs` |
| London Air / LAQN | street-level air quality | keyless | `londonair.org.uk` |
| Breathe London Communities | 400+ hyperlocal air sensors (schools/hospitals) | free key | `api.breathelondon-communities.org` |
| EA Flood Monitoring | flood warnings, river/sea levels | keyless | `environment.data.gov.uk/flood-monitoring` |
| Carbon Intensity API | greenest hours, 48h forecast | keyless | `api.carbonintensity.org.uk` |
| Council bin-collection | per-borough collection schedules | varies (per borough) | `gov.uk/rubbish-collection-day` |
| FixMyStreet / Open311 | civic issue reporting (potholes, lights) | open (Open311) | `fixmystreet.com` |
| UK Parliament Members & Bills | MPs, votes, bills, Hansard | keyless | `members-api.parliament.uk` |
| UK Gov Petitions | petitions + signatures by constituency | keyless | `petition.parliament.uk/petitions.json` |
| FHRS / Food Standards Agency | food hygiene ratings | keyless | `api.ratings.food.gov.uk` |
| DfE Education Statistics | school performance, attainment | keyless | `api.education.gov.uk/statistics` |
| Historic England | listed buildings, scheduled monuments | open | `historicengland.org.uk` |

## Business & companies

| Source | Provides | Access | URL |
|---|---|---|---|
| Companies House | filings, officers, PSC, address history | free key | `developer.company-information.service.gov.uk` |
| FCA Register | authorised financial-services firms | free | `register.fca.org.uk` |
| Charity Commission | charity finances, trustees, activities | free key | `register-of-charities.charitycommission.gov.uk` |
| HM Land Registry Price Paid | sale prices (E&W) since 1995 — no owner names | open | `landregistry.data.gov.uk` |
| Planning London Datahub | planning applications across 33 boroughs | free (guest) | `planningdata.london.gov.uk/api-guest` |
| planning.data.gov.uk | national planning apps, conservation areas | keyless | `planning.data.gov.uk` |
| EPC / Energy Performance | address-level energy ratings | free (registration; One Login for bulk) | `get-energy-performance-data.communities.gov.uk` |

## Data platforms

| Source | Provides | Access | URL |
|---|---|---|---|
| London Datastore / GLA | demographics, deprivation, green space | keyless | `data.london.gov.uk` |
| ONS Statistics API | inflation, unemployment, population to ward level | keyless | `api.beta.ons.gov.uk/v1` |

## Community / discovery

| Source | Provides | Access | URL |
|---|---|---|---|
| Eventbrite | event discovery | free key + ToU | `eventbrite.com/platform/api` |
| Meetup | groups & meetups | free key + ToU | `meetup.com/api/guide` |

## Work & learning

| Source | Provides | Access | URL |
|---|---|---|---|
| Adzuna API | live UK job-ad search + salary/market stats | free key + ToU (display live, don't warehouse) | `developer.adzuna.com` |
| Reed.co.uk API | live UK job vacancy search | free key (registration) | `reed.co.uk/developers/jobseeker` |
| DfE Find an apprenticeship (Display Vacancy API) | live apprenticeship vacancy adverts | free key (150 req/5min) | `developer.apprenticeships.education.gov.uk` |
| Nomis (ONS) | employment/unemployment/claimant count to LA/ward level | keyless (guest, 25k-cell cap) | `nomisweb.co.uk/api/v01` |
| National Careers "Find a course" | FE / adult courses, Skills Bootcamps | keyless **bulk CSV** (monthly) — corpus, not live query | `gov.uk/government/publications/national-careers-service-course-directory` |

(`GOV.UK Content API` above = authoritative careers-guidance text; `ONS API` above = labour-market trend
context. **DWP "Find a job" has no public API** — LMI For All shut Oct 2025, DWP's replacement not yet
live — so it's website-only.)

## More verified endpoints (research round 2)

Verified in a second pass; high-value, mostly keyless — adds coverage the resources page didn't list.

**Weather & energy**

| Source | Provides | Access | URL |
|---|---|---|---|
| Met Office Weather DataHub | forecasts, warnings, model data (DataPoint retired Dec 2025) | free tier + key | `datahub.metoffice.gov.uk` |
| Met Office NSWWS | machine-readable severe-weather warnings | free key (request) | `metoffice.github.io/nswws-public-api` |
| Octopus Energy API | Agile half-hourly tariff rates, region-coded | keyless (pricing) | `docs.octopus.energy/rest` |
| Elexon BMRS Insights | GB generation/demand/frequency | keyless | `developer.data.elexon.co.uk` |
| NESO Data Portal | demand + embedded wind/solar forecasts | keyless (CKAN) | `neso.energy/data-portal` |

**Tenders, grants & transparency**

| Source | Provides | Access | URL |
|---|---|---|---|
| Find a Tender Service (FTS) | above-threshold UK tenders (OCDS) | keyless read | `find-tender.service.gov.uk/Developer/Documentation` |
| Contracts Finder | below-threshold UK tenders (OCDS) | keyless search | `contractsfinder.service.gov.uk/apidocumentation` |
| 360Giving | UK charitable grants incl. GLA as funder | keyless | `api.threesixtygiving.org` |
| mySociety MapIt | postcode/point → borough/ward/constituency | key (free low-volume/non-profit) | `mapit.mysociety.org` |
| WhatDoTheyKnow (Alaveteli) | FOI requests/responses/authorities | keyless read | `alaveteli.org/docs/developers/api` |
| data.gov.uk CKAN | meta-catalogue over all UK gov datasets | keyless, no rate limit | `guidance.data.gov.uk/get_data/api_documentation` |

**Safety · health · food**

| Source | Provides | Access | URL |
|---|---|---|---|
| Give Food API | foodbank + donation-point finder (aggregates Trussell + independents) | keyless (credit) | `givefood.org.uk/api` |
| EA Bathing Water Quality | water quality/sampling (Thames @ Ham & Kingston) | keyless | `environment.data.gov.uk/bwq` |
| EA Flood Warning RSS | per-borough flood-warning feeds (15-min refresh) | keyless (RSS) | `environment.data.gov.uk/flood-widgets/rss-feeds.html` |
| CQC Syndication API | ratings/inspections for care providers (hospitals, care homes, GPs, dentists) | keyless | `api.cqc.org.uk/public/v1` |
| UK-AIR / Defra SOS | live UK air-quality (incl. Marylebone Rd), OGC SOS | keyless (beta) | `uk-air.defra.gov.uk/data/sos` |

**Geo / transport**

| Source | Provides | Access | URL |
|---|---|---|---|
| HM Land Registry SPARQL | Price Paid as linked data (query by postcode/date/tenure) | keyless | `landregistry.data.gov.uk/qonsole` |
| CycleStreets API | cycle routing, geocoding, collision data, LTNs | free key | `cyclestreets.net/api` |
| Sustrans NCN open data | National Cycle Network routes | likely keyless (ArcGIS) | `data-sustrans-uk.opendata.arcgis.com` |

**Corrections to the catalog above**

- **No official council-tax-band API** (VOA is website-only) → a "Sort My Council Tax Band" usecase needs a curated corpus.
- **Trussell Trust has no API** → use Give Food (above). **Met Office DataPoint retired** Dec 2025 → DataHub/NSWWS.
- `data.london.gov.uk/developers/` is **410 Gone**; use the London Datastore CKAN API instead.

**Not yet researched (honest gap):** transport extras (Santander Cycles live availability, National Rail
Darwin, live-bus SIRI, AccessibleTfL) and culture/leisure (OpenActive, museums) — a 5th research pass is
still owed; nothing fabricated for them.

## AI / models / infra (sponsor partners)

`OpenRouter` (multi-LLM key) · `Arize` (agent observability) · `ElevenLabs` (voice) · `Cloudflare`
(Pages + Worker + **Workers AI** free tier — the default model provider) · `TRMNL` (ePaper dashboard) ·
`AG Grid` (data grid — **deferred**, we render built-in A2UI cards) · `Zed` (editor).

## Used by today

- `founders-copilot` → Companies House (the verified incorporate how-to-pack).
- `on-it` → TfL, postcodes.io, OSM Overpass (target design; canned stub today).
- `benefits-copilot` (v1, plan 011) → GOV.UK Content API + curated scheme corpus + NHS/Citizens Advice signposts.

## Honest source gaps

- **"Work & learning" is now partly sourced** (see the section above): jobs via Adzuna/Reed (keyed),
  apprenticeships via DfE (keyed), local labour stats via Nomis (keyless). But **DWP "Find a job" has no
  API** and adult-education courses are a monthly bulk file — so a "Sort My Work" usecase leans on keyed
  job APIs + a curated course corpus, not one clean keyless feed.
- **Borough fragmentation** — bin collection, planning deadlines, and Open311 coverage vary across the
  33 boroughs; expect partial coverage + curated per-borough corpora, not one clean API.
- **Staleness** — NHS Service Directory "accepting patients" is often out of date; EPC/enforcement-notice
  coverage is patchy. Surface "as of / confirm by phone", never assert as guaranteed.
- **Sensor sparsity** — Breathe London is ~400 sensors citywide; most streets have no nearby sensor.
  Show distance-to-nearest-sensor honestly rather than silently interpolate.
