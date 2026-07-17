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
| EPC / Energy Performance | address-level energy ratings | free (registration) | `find-energy-certificate.service.gov.uk` |

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

## AI / models / infra (sponsor partners)

`OpenRouter` (multi-LLM key) · `Arize` (agent observability) · `ElevenLabs` (voice) · `Cloudflare`
(Pages + Worker + **Workers AI** free tier — the default model provider) · `TRMNL` (ePaper dashboard) ·
`AG Grid` (data grid — **deferred**, we render built-in A2UI cards) · `Zed` (editor).

## Used by today

- `founders-copilot` → Companies House (the verified incorporate how-to-pack).
- `on-it` → TfL, postcodes.io, OSM Overpass (target design; canned stub today).
- `benefits-copilot` (v1, plan 011) → GOV.UK Content API + curated scheme corpus + NHS/Citizens Advice signposts.

## Honest source gaps

- **"Work & learning" theme has no source** here — no job board / apprenticeship / adult-education API.
  Don't stretch DfE school-performance data to cover it.
- **Borough fragmentation** — bin collection, planning deadlines, and Open311 coverage vary across the
  33 boroughs; expect partial coverage + curated per-borough corpora, not one clean API.
- **Staleness** — NHS Service Directory "accepting patients" is often out of date; EPC/enforcement-notice
  coverage is patchy. Surface "as of / confirm by phone", never assert as guaranteed.
- **Sensor sparsity** — Breathe London is ~400 sensors citywide; most streets have no nearby sensor.
  Show distance-to-nearest-sensor honestly rather than silently interpolate.
