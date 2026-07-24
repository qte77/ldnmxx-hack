---
title: "ADR 0002 — real-data store: read-through CF D1 + licence-gated self-serve"
status: accepted
date: 2026-07-22
---

# ADR 0002 — Real-data store

## Status

Accepted (2026-07-22). Supersedes **ADR 0001 §4** on the data-store question — where the two differ, this
ADR wins. First applied by **W6/W4** (real Sort My Care corpus, #13; ingest cron #10; plan 015).

## Context

ADR 0001 §4 shipped corpora as pre-generated synthetic JSON and named "real ingest + CF D1" a *follow-up*.
Making the flagship real (plan 015 · W4/W5/W6) forces two decisions ADR 0001 left open:

- **Q1 — where does a request read from?** Live third-party fetch per request, vs a pre-ingested store.
- **Q2 — ToU/licence:** what does it mean to serve that data from our *own* store, so the user never
  touches the origin?

## Decision

### 1. Read-through a store; the hot path stays fetch-free (Q1)

The request path reads an in-house **CF D1 only**. Sources are fetched **out-of-band** — on a cron cadence
plus an explicit trigger — by an ingester, never on the user's request. Schema via `wrangler d1
migrations`; **one SQL view per corpus** projects the ingested tables onto the frozen `CorpusRecord` (the
view is the corpus contract in SQL, so ingest-schema churn updates the view, not the query code). Each
re-seed is shadow-table → validate row-count → atomic view swap, with the committed synthetic sample as
the offline/outage fallback.

Rationale — this aligns with the locked invariants *more* than live-per-request would: the hot path keeps
**no SSRF surface, no third-party latency/outage, no rate-limit exposure to user traffic**; **source
secrets stay off the hot path** (only the ingester holds keys); `asOf` becomes a **real ingest
timestamp**; and ToU-sensitive raw data lives server-side. D1 *realises* ADR 0001 §4's "no live external
fetch at request time" rather than contradicting it — so D1 moves from "later, if forced" to **the
foundation** W4/W5 build on.

**Scope caveat.** Read-through-a-store fits **reference/directory** corpora (NHS services, heritage,
greenspace change slowly; a periodic re-seed is honest). Genuinely **real-time** feeds (live transit, air
quality, flood) fit it poorly — a cron snapshot is stale by design — and would need a different pattern
(short-TTL cache or a scoped live fetch). Out of scope here; revisit per real-time usecase.

### 2. Serving from our store is redistribution → licence-gate it (Q2)

Ingesting a source and serving it from D1 means the user never hits the origin: we are **republishing** it.
Caching does not make this lighter-touch than linking — legally it is heavier. So the ingester may store +
serve a source only when its **licence permits redistribution**:

- **OGL / permissive** (most keyless gov data) → ingest + serve, **with the required attribution** plus an
  honest `asOf` and the official link.
- **`tou-gated`** ("don't warehouse": Adzuna/Eventbrite/Meetup/VOA-rating) → **never ingested**;
  live-display or link-only. The read-through model is structurally incompatible with these — a feature,
  not a limitation: the store self-selects for redistributable sources.
- **`free-key`** → the key gates *access*; the *licence* gates *redistribution*. Independent — verify each.
- **ODbL / share-alike** (OSM-derived) → attribution **plus** a share-alike assessment on the stored
  derived database.
- **No-cache / clinical-safety clauses** override an otherwise-open licence: the NHS live Directory of
  Services forbids caching even though the content is OGL → `redistribute_ok: no`; use the OGL **bulk**
  equivalent (NHS ODS via TRUD) or keep the source live/link-only. `access` (keyless/free-key) does not
  capture this — only a verified `redistribute_ok` does.
- Obligations that ride along even when permitted: **attribution**, **no implied endorsement**, honest
  freshness, and serving a **curated signpost** rather than a wholesale mirror.

**The two-channel distinction** (why the existing rule is necessary but not sufficient): AGENTS.md's
"ToU-gated data stays out of **git**" guards the *repository* channel. The *serving* channel (D1 → user)
is a **separate act** of redistribution, gated by licence, not by `.gitignore`. Both gates apply.

### 3. The registry is the machine-readable gate

`data/sources.json` gains structured **`license`** and **`redistribute_ok`** per source, so the ingester
can *refuse* to store anything not cleared — making the ToU posture auditable per re-seed, not a per-run
judgment. The per-source licence matrix is verified against official terms (verification in progress at
time of writing); until a source is cleared `redistribute_ok: true`, it is link-only.

## Consequences

- **+** The hot path stays fetch-free / secret-free with real freshness — the strongest form of ADR 0001
  §4, not a departure from it.
- **+** The store *self-selects* for redistributable data: tou-gated sources cannot enter it, so a whole
  class of ToU violations becomes structurally impossible rather than merely policed.
- **+** `redistribute_ok` turns "may we serve this?" into a checked field instead of tribal knowledge.
- **−** A real corpus has **two** ingest targets, not one: the corpus itself **and** a postcode→coords
  gazetteer (`postcodes` table) for user-input resolution, since the hot path cannot call a geocoder live.
- **−** Real-time usecases need a different data pattern; this ADR deliberately does not solve them (YAGNI
  until one lands).
- **−** Licence verification is per-source manual diligence: `license` + `last_checked` must be kept
  current, and some sources need a lawyer's confirmation before `redistribute_ok: true`.

## Consequence — bounded reads (017 P2b, #201)

The read seam started as one fully-unbounded statement per view (`SELECT … FROM <view>`), which
`nearestN` ranked in JS after reading **every** row (66,871 for food-hygiene). D1 bills rows
**scanned**, so at 5M/day that is ~75 asks/day — untenable once P2 opens free-text asking. P2b bounds
each corpus read to a **bbox prefilter** around the resolved origin: a bound-parameter
`WHERE lat/lng BETWEEN … ORDER BY <proximity> LIMIT` appended to the view's **static** base select
(two static constants concatenated — no user data in the SQL string, so the closed-statement
whitelist this ADR prizes is intact), with a widen-radius retry (5 → 15 km → unbounded) so results
never silently shrink and the empty-view fallback still fires on the final unbounded read. The win
requires the companion `(lat, lng)` indexes (`0005_geo_indexes.sql`): without them a bare `WHERE`
still scans the table. This is an implementation of the seam, **not** a new decision — recorded here
rather than as its own ADR. Proven live via `meta.rows_read` / `EXPLAIN QUERY PLAN` (a mock cannot
model scanning).
