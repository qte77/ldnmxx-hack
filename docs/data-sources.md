---
title: "Data sources — the corpus sortmy.london can build on"
type: reference
updated: 2026-07-17
source: "https://resources.londonmaxxing.com/"
---

# Data sources

The catalog is machine-readable in **[`data/sources.json`](../data/sources.json)** — the single source
of truth (easy to ingest, query, and update; each record carries `first_checked` / `last_checked` so
staleness is trackable). This doc is the human companion: how to use the catalog, and the honest gaps.

## How to use

- Prefer **`access: keyless`** (usable at request time from a Worker). Keyed sources → the key is a
  **Worker secret**, never in the SPA bundle. `tou-gated` / `website-only` sources → a **curated corpus**
  (Workers bundle data at build time; no dynamic file reads, so "live scraping" is out).
- `london_relevance` and `confidence` rank fit and how firmly each was verified.
- Bump `last_checked` whenever you re-verify a source; a stale `last_checked` flags that a re-check is due.

## Record shape

Each entry in `data/sources.json`: `id` · `name` · `category` · `provides` · `interface`
(rest-json / rss / ndjson / geojson / ocds / ckan / sparql / soap / bulk-csv / website) · `access`
(keyless / free-key / registration / paid / tou-gated / website-only) · `url` · `london_relevance` ·
`confidence` · `notes?` · `first_checked` · `last_checked`.

Categories: transport · geo · gov-civic-env · business · data-platform · community · work-learning ·
weather-energy · tenders-grants · culture-leisure. **65 sources** as of 2026-07-17.

## Used by

- `founders-copilot` → Companies House (verified incorporate how-to-pack).
- `on-it` → TfL, postcodes.io, OSM Overpass (target design; canned stub today).
- `benefits-copilot` (v1, plan 011) → GOV.UK Content API + curated scheme corpus + NHS / Citizens Advice signposts.

See [`usecase-backlog.md`](usecase-backlog.md) for candidate workflows mapped to these sources.

## Honest gaps & dead ends

- **Council-tax band:** no official VOA API (website-only) → curated corpus.
- **Public library catalogues/events:** no open London-wide API found — genuine gap.
- **DWP "Find a job":** no public API (LMI For All shut Oct 2025; DWP replacement not yet live) → jobs via Adzuna/Reed.
- **Trussell Trust:** no own API → use Give Food. **Met Office DataPoint:** retired Dec 2025 → DataHub/NSWWS.
- **British Museum API / GiGL "Spaces to Visit":** discontinued / withdrawn.
- **Borough fragmentation** (bins, planning deadlines, Open311): partial coverage; expect curated per-borough corpora.
- **Staleness:** NHS "accepting patients", EPC/enforcement coverage, FHRS inspection dates — surface "as of / confirm", never assert.
- **Not yet researched:** deeper realtime transport (live bus SIRI, live rail beyond Darwin) and some culture feeds — flagged, not fabricated.
