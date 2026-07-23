---
title: "Glossary — abbreviations used across ldnmxx-hack"
type: reference
updated: 2026-07-22
---

# Glossary

Every abbreviation used in this repo's docs/code, defined once, grouped by area. The **Related**
column cross-references adjacent terms (find them by their abbreviation in the same table or a
sibling section). Where a source doc never spells a term out, the expansion here is best-effort —
flag corrections in a PR.

## Data licences & rights

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| OGL | Open Government Licence (v3.0) | The permissive UK-gov reuse licence — copy/adapt/redistribute, incl. commercially, with attribution + no-endorsement. The default that makes a source storable+servable. | ODbL, ToU, redistribute_ok, ADR |
| ODbL | Open Database Licence (1.0) | OpenStreetMap's **share-alike** licence — a city-wide derived DB triggers an ODbL export + in-card attribution obligation. | OSM, OGL, ToU |
| ToU | Terms of Use | A source's usage terms; can *override* an open content licence (e.g. NHS DoS no-cache). | OGL, AUP, redistribute_ok |
| AUP | Acceptable Use Policy | NHS DoS's AUP forbids caching DoS data (clinical-safety) even though the content is OGL. | NHS, DoS, ODS, ToU |
| RES | Register Extract Service | FCA's paid (£9k–18k/yr) sanctioned redistribution licence — not viable here, so FCA stays link-only. | FCA, ToU |

## Civic data sources & authorities

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| NHS | National Health Service | Care flagship corpus source. | ODS, DoS, TRUD, CQC, GP |
| ODS | Organisation Data Service | The **storable** NHS org directory (OGL bulk via TRUD) — the W4 Care source. | NHS, TRUD, DoS, OGL |
| DoS | Directory of Services | NHS live referral directory; its API forbids caching → not storable (use ODS). | NHS, ODS, AUP |
| TRUD | Technology Reference data Update Distribution | NHS bulk-data distribution platform (account + per-item licence acceptance). | ODS, NHS |
| CQC | Care Quality Commission | Care-provider ratings (OGL, keyless; needs a `partnerCode`). | NHS, OGL |
| FCA | Financial Conduct Authority | Financial-firm register for Sort My Scam — link-only (proprietary terms). | FRN, RES, ToU |
| FRN | Firm Reference Number | A firm's FCA-register id. | FCA |
| FHRS | Food Hygiene Rating Scheme | Food-hygiene ratings (OGL) — show inspection date, use own card not the FSA badge. | FSA, OGL |
| FSA | Food Standards Agency | Publisher of FHRS. | FHRS |
| NHLE | National Heritage List for England | Historic England's listed-places register (OGL) for Sort My Wander. | OS, OGL |
| ONS | Office for National Statistics | Publisher of the postcode directory + stats. | ONSPD, GLA |
| ONSPD | ONS Postcode Directory | Postcode→coords data behind postcodes.io / the gazetteer (OGL; exclude NI/BT). | ONS, NRS, LPS, OS |
| NRS | National Records of Scotland | Scottish postcode component of ONSPD. | ONSPD |
| LPS | Land & Property Services (NI) | NI postcode component (non-commercial — excluded). | ONSPD |
| OS | Ordnance Survey | Mapping/geocoding + OS Open Greenspace (OS OpenData = OGL). | OGL, OSM, NHLE |
| OSM | OpenStreetMap | Crowd-mapped POIs (ODbL, share-alike). | ODbL, OS |
| GLA | Greater London Authority | London Datastore / cultural-infra publisher. | ONS |
| VOA | Valuation Office Agency | Council-tax band / rating data (no open band API → curated). | — |
| PSC | Persons with Significant Control | Companies House beneficial-ownership field. | SIC |
| SIC | Standard Industrial Classification | Companies House business-activity code. | PSC |
| GP | General Practitioner | A care-service type in the ODS corpus. | NHS, ODS |

## Data interfaces & formats

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| API | Application Programming Interface | How sources are fetched (out-of-band, never on the hot path). | REST, JSON |
| REST | Representational State Transfer | Most source APIs' style. | API, JSON |
| JSON | JavaScript Object Notation | Usecase stage defs, corpora, tool payloads. | JSON-LD, SQL |
| JSON-LD | JSON for Linked Data | Structured-data extractor target in polyfetch scraping. | JSON |
| GeoJSON | Geographic JSON | Format for greenspace/heritage geometry sources. | JSON |
| NDJSON | Newline-Delimited JSON | `runs.jsonl` manifest + some feeds. | JSON |
| OCDS | Open Contracting Data Standard | Tenders (Find a Tender / Contracts Finder). | — |
| CKAN | (data-portal software; not an acronym here) | data.gov.uk / London Datastore catalogue API. | API |
| SPARQL | SPARQL Protocol and RDF Query Language | Wikidata / Land Registry queries. | — |
| RPDE | Real-time Paged Data Exchange | OpenActive activity feeds. | NDJSON |
| SQL | Structured Query Language | D1 schema + one view per corpus. | D1 |

## Cloudflare & platform

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| CF | Cloudflare | Host: Pages (SPA) + Worker (API) + D1. | D1, KV, R2, SPA |
| D1 | (Cloudflare's serverless SQLite) | The real-data store; read-through, fetch-free hot path (ADR 0002). | CF, SQL, KV, R2 |
| KV | Key-Value (Cloudflare KV) | Superseded by D1 for the corpus store. | CF, D1 |
| R2 | (Cloudflare object storage) | Candidate host for the W5 ingest artifact. | CF, D1 |
| SPA | Single-Page Application | The `ui/` React app on Pages. | CF, UI, SSE |
| SSE | Server-Sent Events | The only browser↔Worker transport (`POST /api/run`). | SPA, API |
| Worker | (Cloudflare Worker) | The one `/run` engine + `scheduled()` cron. | CF, D1 |

## Protocols, agents & AI

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| A2UI | Agent-to-UI | Half of the protocol stack (renders Column/Card/Text). **Not a sponsor.** | AG-UI, A2A |
| AG-UI | Agent–User Interaction (protocol) | The other half of the protocol stack. **Not a sponsor.** | A2UI, A2A |
| A2A | Agent-to-Agent | Deferred agent-interop endpoint. | A2UI, AG-UI |
| LLM | Large Language Model | Backs only the `founders` render mode; civic flows are model-free. | RAG, BYOK, HUD |
| RAG | Retrieval-Augmented Generation | Not used — civic flows are deterministic corpus retrieval, not RAG. | LLM |
| BYOK | Bring Your Own Key | Removed from the browser; keys are Worker secrets only. | LLM |
| HUD | Heads-Up Display | The honest `USAGE mode:demo` status indicator. | LLM |
| OTLP | OpenTelemetry Protocol | Arize trace export format. | — |
| STT | Speech-to-Text | ElevenLabs stretch integration. | TTS |
| TTS | Text-to-Speech | ElevenLabs stretch integration. | STT |
| SDK | Software Development Kit | e.g. the Cloudflare Agents SDK. | CF |
| MCP | Model Context Protocol | Tool-connection protocol for agents. | LLM |

## Web, security, a11y & performance

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| CSP | Content Security Policy | Edge defence; blocks external fetches (why axe-core is vendored). | CORS, SSRF |
| CORS | Cross-Origin Resource Sharing | Fail-closed allowlist, never `*`. | CSP |
| SSRF | Server-Side Request Forgery | Avoided by a fetch-free hot path + postcode-only sanitized input. | CSP, D1 |
| TLS | Transport Layer Security | HTTPS; polyfetch impersonates a real TLS/JA3 fingerprint. | JA3, HSTS |
| JA3 | (TLS-fingerprint hash) | polyfetch's curl_cffi tier spoofs it to pass bot-protection. | TLS |
| HSTS | HTTP Strict Transport Security | Edge security header. | TLS |
| DMARC | Domain-based Message Auth, Reporting & Conformance | Email-domain hardening. | DNS |
| DNS | Domain Name System | `sortmy.london` zone wiring. | — |
| WCAG | Web Content Accessibility Guidelines | axe-core scans to WCAG 2 A/AA. | AA, a11y |
| AA | (WCAG conformance level AA) | The a11y bar (e.g. 4.5:1 contrast). | WCAG, a11y |
| a11y | accessibility | sr-only h1, aria-live, focus rings, axe gate. | WCAG, AA |
| CTA | Call to Action | The one primary action above the fold. | UX, UI |
| FOUC | Flash of Unstyled Content | Prevented by CSP-safe external theme-init + variant-init scripts. | CSP, UX |
| variant | (accent variant) | One of three London accents — Thames Teal (default) / Heritage Indigo / Westminster Green — selected by `[data-variant]` and `?variant=`. Orthogonal to light/dark. | ADR 0005, AA |
| CVD | Colour Vision Deficiency | Why accents are chosen for contrast + hue separation, not hue alone. | AA, a11y |
| SEO | Search Engine Optimisation | Meta/OG tags on the landing page. | OG |
| OG | Open Graph | Social-share meta tags. | SEO |
| LCP | Largest Contentful Paint | Core Web Vital measured on the deploy. | FCP, INP, CLS |
| FCP | First Contentful Paint | Core Web Vital. | LCP, INP, CLS |
| INP | Interaction to Next Paint | Core Web Vital. | LCP, FCP, CLS |
| CLS | Cumulative Layout Shift | Core Web Vital. | LCP, FCP, INP |
| CDP | Chrome DevTools Protocol | polyfetch's `render_session` capture surface. | UA |
| UA | User-Agent | Set on polite fetches / ingest. | CDP |
| PII | Personally Identifiable Information | None stored; corpus is public directory data. | — |

## Engineering & process

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| ADR | Architecture Decision Record | `docs/adr/*` (0001 engine, 0002 data store). | OGL, D1 |
| TDD | Test-Driven Development | Strict, modules-only (tests first for load-bearing modules). | CI, PR |
| CI | Continuous Integration | The green gate before squash-merge. | CD, PR, GHAS |
| CD | Continuous Delivery/Deployment | Deploy is manual (`make deploy`), not CI-driven. | CI |
| KISS | Keep It Simple, Stupid | Core principle. | DRY, YAGNI, AHA |
| DRY | Don't Repeat Yourself | Core principle — single source of truth. | KISS, SSOT |
| YAGNI | You Aren't Gonna Need It | Core principle. | KISS, AHA |
| AHA | Avoid Hasty Abstractions | Core principle — duplication over the wrong abstraction. | KISS, DRY |
| SSOT | Single Source of Truth | This repo (vs archival `qte77/ldnmxx`); `sources.json` for sources. | DRY |
| SHA | Secure Hash Algorithm | GitHub Actions are SHA-pinned (repo policy). | CI, GHAS |
| GHAS | GitHub Advanced Security | CodeQL/secret-scanning gate. | CI, SHA |
| LOC | Lines of Code | e.g. the ~60-LOC `runUsecase`. | — |
| PR | Pull Request | Branch-per-topic → CI-gated PR → squash → prune. | CI, TDD |
| EOL | End of Life | e.g. GitHub Models tier retired. | — |
| TS | TypeScript | Worker + UI (Worker pinned to TS 6 for eslint compat). | JS |
| JS | JavaScript | Runtime; workflow scripts. | TS |
| JSX | JavaScript XML | React syntax (jsx-a11y plugin deferred). | JS, a11y |
| TTL | Time to Live | Cache lifetime (e.g. immutable asset caching). | — |
| MVP | Minimum Viable Product | Scoping frame. | ROI |
| ACE-FCA | Advanced Context Engineering for Coding Agents | The context-window discipline in `.claude/rules/context-management.md` (keep 40–60%, compact per phase). | — |

## Product & business

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| ROI | Return on Investment | Issue/feature triage lens. | MVP |
| ICP | Ideal Customer Profile | Target-user framing. | JTBD, USP |
| JTBD | Jobs To Be Done | Task-first product framing. | ICP, CTA |
| USP | Unique Selling Proposition | Differentiation framing. | ICP |
| SME | Small & Medium-sized Enterprise | Business-data audience segment. | — |
| ARR | Annual Recurring Revenue | Business-model metric. | ROI |

## Project-specific

| Abbrev | Expands to | In this repo | Related |
|---|---|---|---|
| SSOT | (see Engineering) | This repo is canonical; `qte77/ldnmxx` is archival-only. | DRY |
| TRMNL | (e-ink display device / optional sponsor) | Optional dashboard-display integration. | — |
| NNN | (handoff/plan numbering placeholder) | `docs/handoffs/NNN-*.md`. | ADR |
