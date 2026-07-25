# Changelog

All notable changes are documented here (keep-a-changelog; hand-curated).

## [Unreleased]

### Plan 020 — UX overhaul · P3: re-show examples after a search (#3)

- **The example chips no longer vanish for good.** They collapsed after the first search (018 P5) and
  never returned. A pure `suggestionMode` gate (`ui/src/suggestions.ts`, mirroring `shouldRotate`) now
  shows the full hero chips on the empty state, nothing while a run streams, and a compact **"Try another"**
  row once results are in — so a user can always pivot to another workflow. Both surfaces reuse one
  `SuggestionChips` component (DRY). RED-first `ui/tests/suggestions.test.ts`; the render is glue, verified
  by the e2e sweep.

### Plan 020 — UX overhaul · P2: accept London place names (#1)

- **Place-name input.** A query that names a London place instead of a postcode ("wander nearby tower",
  "GP near Camden") dead-ended on "Enter a valid UK postcode". Now a fetch-free resolver
  (`shared/places.ts` `resolvePlace`, longest-alias-wins) maps ~80 committed boroughs / areas / landmarks
  (`data/places.json`) to an anchor point, hooked at a new location seam (`worker/src/corpus/query.ts`
  `resolveLocation`), so nearest-N answers from a place too. The empty-state now reads "Enter a London
  postcode or place" with a place example. RED-first `worker/test/places.test.ts` + a place query in
  `worker/test/corpus.test.ts`. DRY: the whole-word matcher moved to `shared/text-match.ts`, shared by the
  router (P1) and the resolver. Fetch-free per ADR 0002 (static in-memory lookup, no geocoder). **The D1
  `places` table was assessed unnecessary** — the gazetteer is small + static, ships in the Worker bundle,
  and resolves LIVE with no D1 read (unlike the large, ingest-managed `postcodes` table).

### Plan 020 — UX overhaul · P1: route to the right workflow (#2)

- **Routing vocabulary + precision.** The keyword router (`worker/src/agent/router.ts` `classifyHeuristic`)
  matched keywords as raw substrings — so "parking" false-routed to wander via "park" — and thin keyword sets
  left many natural phrasings ("a place to eat", "somewhere to walk outdoors", "book a surgery appointment")
  with no match, falling to the same no-match card. Now `matchesKeyword` does a whole-word match with a simple
  plural/possessive tail (so "parks" still routes, "parking" no longer does; a manual boundary scan, **no
  dynamic RegExp → no ReDoS surface**), and the `usecases/*.json` keyword sets gained curated domain synonyms
  (wander +walk/outdoors/nature…; care +surgery/medical…; food-hygiene +eat/dining/food…; scam
  +fraudster/phishing…). RED-first in `worker/test/router.test.ts` (matcher precision + real-catalogue synonym
  coverage). The two keyword-less workflows stay never-auto-routed (ADR 0004).

### Plan 019 — backlog clear · P2b: public freshness endpoint (#199)

- **`GET /api/freshness`** (`worker/src/freshness.ts` + a route in `worker/src/worker.ts`) — a public,
  read-only surface that runs one static `SELECT corpus, as_of, ingested_at, row_count FROM corpus_meta`
  (ADR-0002 closed-whitelist SQL) and returns `{ generatedAt, corpora: [{corpus, ingestedAt, asOf,
  rowCount}] }` as `application/json` with `Cache-Control: no-store` (so an edge cache can never mask
  staleness — the #178 lesson). Exposes only non-sensitive aggregate metadata (no PII, no record rows).
  This lets the freshness watchdog poll for a dead ingest cron **credential-free** — no Cloudflare token
  in CI. The pure `buildFreshnessPayload` mapper is unit-tested (RED-first); the route + D1 read are
  glue, verified by `curl` against the deploy. `Access-Control-Allow-Methods` now includes `GET`.

### Plan 019 — backlog clear · P2: freshness watchdog (#199)

- **Freshness watchdog** (`.github/workflows/freshness-watchdog.yml`) — a scheduled (daily 06:37 UTC,
  ~2h after the 04:47 UTC ingest cron) + dispatch Action that **`curl`s the public `GET /api/freshness`**
  above and opens (or comments on) one alert issue if any corpus is more than 48h stale.
  **Credential-free** — no Cloudflare token in CI, mirroring `tier3-monitor.yml` ("only hits the public
  URL"); the job holds no secrets and uses no `uses:` actions. A `max_age_hours` dispatch input
  exercises the stale/alert path (dispatch with `0`). Also corrected a stale claim in `d1-verify.yml`
  and `docs/deploy-cloudflare.md` — Cloudflare **does** have a read-only **`D1 Read`** scope
  (`d1-verify`'s SELECTs need only that; migrations still need `D1 Edit`).

## [1.9.0] - 2026-07-25

Arc 018 — post-launch polish: input forgiveness (outward postcodes + scam natural-language matching),
honesty (row-read numbers, record dates), config-separation (one shared usecase catalog), and a
visual/UX pass. All phases strict-TDD (RED-first for load-bearing modules), CI-gated, and per-phase
deploy + live tier3-sweep verified (axe 0/0 across 3 theme variants × light/dark).

### Plan 018 — post-launch polish · P5: visual/UX pass (#223)

- **Human distances** — `worker/src/geo.ts` `humanDistance` (RED-first): "· 0 km" → "<50 m", "N m ·
  ~X-min walk", or "N.N km · ~X-min walk".
- **De-duped cards** — the authority every shown row shares lifts to the summary as a tag; a genuinely
  multi-source result keeps it per-row (never a false single-source claim). `corpus/query.ts`
  `sharedAuthorityOf` + `CorpusQuery.sharedAuthority`.
- **Per-workflow glyph** — a required `CorpusLabels.glyph` on each summary title (🩺/🚶/🍽️; scam 🔍,
  never a shield/✅) + a local `GLYPH_BY_USECASE` for the no-match card; and the result **card title is
  now the official-source link** (drops the redundant "[Official page]" row).
- **Sources & licence** — the N licence-attribution lines collapse into ONE "Sources & licence:" caption,
  every string kept verbatim (no A2UI disclosure primitive exists, so honest compaction, not a fake
  accordion).
- **Progressive hero** (`ui/src/App.tsx` new `Hero`) — the dek + chips collapse after a search so results
  lead; **suggestion chips** of the routable examples on the empty state; **rotating placeholder**
  (`ui/src/useRotatingPlaceholder.ts`, `shouldRotate` RED-first, `prefers-reduced-motion`-aware).
- Verified: worker + ui full local gates green; the live axe 0/0 + flow sweep is the post-deploy gate.

### Plan 018 — post-launch polish · P5b: no-match card — "type this" vs "open this" (#223)

- **The no-match discovery card now offers an honest affordance per workflow.** It listed every
  workflow, but routable ones showed `e.g. <keywords>` while the never-auto-routed `founders-copilot`/
  `sort-my-route` showed a bare title — and giving those two a typed example would advertise an input
  that itself no-matches (they carry no keywords ON PURPOSE — the same SE1 trap as P2). Now
  `buildNoMatchCards` renders two kinds (RED-first in `worker/test/cards.test.ts`): a **routable**
  workflow leads with its `blurb` (018 P4) and "Try typing: &lt;its example&gt;"; a **never-auto-routed**
  one leads with its blurb and an **`[Open … →](?usecase=<id>)` link** — discoverable, never a fake
  keyword. Server-rendered A2UI, no client change; `tests/e2e/flows.json` asserts the open link, not a
  keyword line.

### Plan 018 — post-launch polish · P4: one shared usecase catalog (#223)

- **The workflow catalog is now a single source of truth.** `id`/`title` were authored in both
  `ui/src/App.tsx` and `usecases/*.json`, `example` lived only in the UI, and there was no home at all
  for the no-match card's `blurb`. Now each `usecases/*.json` carries `example` + `blurb`, and a new
  **`shared/usecaseCatalog.ts`** (RED-first: `worker/test/usecaseCatalog.test.ts`) loads + validates them
  and derives `usecaseCatalog()` / `routableUsecases()`, consumed by BOTH the Worker
  (`worker/src/usecases.ts` now re-exports them) and the SPA (`App.tsx` drops its hardcoded array).
  `routable` is DERIVED (`keywords.length > 0`), never re-declared; `sort-my-route`/`founders-copilot`
  stay never-auto-routed by the ABSENCE of keywords (ADR 0004 register-only preserved end to end).
- **Honest accounting:** adding a workflow is ONE *data* file — but still two *wiring* lines (its worker
  `registry` entry and its `shared/usecaseCatalog.ts` `CATALOG` entry), unchanged from before and one
  fewer than the old UI-array touch. The `shared/` list can't derive from the worker registry without
  breaking the one-way import direction (the SPA must never pull in worker-only modules). `example`/
  `blurb` are optional on the engine `UsecaseDef` (so the inline test fixtures need no edits) but
  required on `CatalogEntry` — two schemas, one per concern.

### Plan 018 — post-launch polish · P3: record-date honesty (#225)

- **The date line now matches each corpus's date SEMANTICS** instead of always saying "data as of". The
  summary rendered the oldest `lastUpdated` across shown rows under "data as of"; for **wander** (NHLE
  listing dates ~1949, UNIONed with fresh greenspace) that surfaced a heritage listing year as if it
  were data freshness — the reported "data as of 1974" bug. A new **required** `CorpusLabels.dateLabel`
  with a pure `formatDateLabel` (`worker/src/dates.ts`, RED-first) words it honestly per corpus: **care
  → "data as of"** (the CQC directory's production/snapshot date, verified against `parse_cqc_directory`),
  **wander → omitted** (a single "as of" over mixed record-ages is inherently misleading), **food-hygiene
  → "inspected {date}"** (FHRS `RatingDate` is a per-record inspection date, not our freshness). Also
  drops the dangling "data as of " when there is no valid date. `tests/e2e/flows.json` sweep markers
  updated to match (wander drops the marker, food-hygiene → "inspected"). Scam's separate render is
  untouched.

### Plan 018 — post-launch polish · scam-check input forgiveness (found by the P1 live sweep)

- **"is &lt;firm&gt; a scam" now resolves.** The first live sweep caught that `Sort My Scam Check`
  returned no match for the question form (e.g. "is Thames Capital Partners a scam") — `matchFirms`
  only matched when the query was a *substring of* the firm name, so a natural-language ask (where the
  firm name is a substring of the *query*) found nothing and the summary card never rendered.
  `matchFirms` now also matches when the firm's **name-stem** (legal suffix stripped) appears inside the
  query — deterministic phrase containment, not a fuzzy guess. A hit stays a **flag** routing to the FCA
  register, never a verdict. RED-first tests in `worker/test/scam.query.test.ts`.

### Plan 018 — post-launch polish · P2: outward-postcode input forgiveness (#224)

- **A bare outward code now resolves.** The app's own placeholder example, `food hygiene near SE1`,
  used to fail because `SE1` is an outward-only code and the backend only accepted a full postcode.
  `shared/sanitize.ts` `normalisePostcode` now falls back to a bounded outward-code parse (`\b`-anchored
  `SE1`/`E8`/`N1`/`SW1A`) **only when no full postcode is present** — a full postcode always wins. The
  token keys the SAME gazetteer a full postcode does, so no resolve-path code changed (RED-first tests in
  `worker/test/sanitize.test.ts`). ADR-0002 fetch-free hot path intact — outcode centroids are
  pre-computed data, never a live geocode.
- **Outcode centroids in the shared gazetteer.** Migration `0006_outward_postcode_centroids.sql` seeds
  one `AVG(lat,lng)` centroid per outward code over the real seeded postcodes (good on the LIVE store's
  thousands of London rows); the bundled `data/*/postcodes.sample.json` gazetteers gain the four
  placeholder outcodes by hand. `ingest/parsers.py` `with_outcodes` (pure, pytest-covered; called by
  `seed.py`) bakes the same centroids into the published `postcodes.json` artifact so the daily 04:47
  UTC cron swap keeps them (the migration alone would be wiped within 24h — the `postcodes` table is
  DELETE+replaced each swap).

### Plan 018 — post-launch polish · P1: row-read correction (#223)

- **Widen now starts at 0.5 km** (`WIDEN_KM` `[5, 15]` → `[0.5, 2, 8]` in `worker/src/corpus/query.ts`).
  The 017 ship widened from 5 km, which barely helped dense central corpora — a composite `(lat, lng)`
  index can only range its **leading** column, so a wide first box still scans most of the table.
- **The real, LIVE-measured numbers** (`meta.rows_read` on prod food-hygiene, 66,871 rows): **5 km read
  55,201 (1.2×)**, 1 km read 8,144 (8.2×), **0.5 km reads 3,810 (17.5×)**. The earlier P2b "≥10×" line
  was a *projection*; these are measured. Docs corrected accordingly (this entry + ADR 0002 "bounded
  reads"). No cell/geohash column needed (KISS) — a small first box clears the ≥10× target on its own.
- No new unit test: `corpus.bbox.test.ts` already asserts the widen **behaviour** (results never
  silently shrink), which is km-agnostic; only its stale "5 → 15 km" comment was refreshed.

### Plan 017 — one input, London-themed · P3: single-input UI + wording (#201)

- **One input, no switcher.** The SPA now POSTs the typed ask **prompt-only** and the Worker's router
  picks the workflow (P2); the manual usecase switcher and its "Or: …" affordance are gone. The UI
  reads `USECASE_RESOLVED` to show a **"Showing: &lt;workflow&gt;"** heading and announce it via
  `aria-live`, so the routing decision is not sighted-only. `?usecase=` still bypasses the router
  (deep links / founders demo) and prefills that workflow's example.
- **Reworded to a distilled claim ladder** (verbatim from the P3 copy spec): eyebrow *"London public
  services · free, no sign-up"*, H1 *"Ask in your own words. Get the official source."*, a dek that
  says we hold a **weekly snapshot** of official registers (CQC, FSA, Historic England, OS) and links
  to the live page, CTA **"Find it"**, and a de-risking microcopy line. `<title>`/OG inherit the H1 +
  eyebrow. **Struck for good:** "the honest, free way", "know it's current" (FHRS/NHLE dates run
  old), and any "live search" / "answers come from public registers" framing that would contradict
  the fetch-free snapshot (ADR 0002). The footer states the handoff honestly: *"We find it. You sort
  it."* — never a bare "Sort it" button.
- **`readUsecase` shrinks to the `?usecase=` bypass** — no mount-time flagship fallback (an absent or
  unknown param returns `null` so the router decides). `useAgentSSE.runWorkerPath` omits `?usecase=`
  for a prompt-only run and exposes the resolved workflow.
- **e2e sweep converted to typed asks** (`tests/e2e/flows.json` + `ui_sweep.py`): each flow types an
  ask into the one input and asserts BOTH the route (`Showing: …`) and the rendered markers, plus a
  gibberish→no-match flow. `sort-my-route` is dropped from the typed flows (never auto-routed).
  **Until P3 is deployed, the tier-3 monitor sweeps the live v1.7.0 site and will FAIL (single input
  not yet live)** — an expected, self-resolving honest FAIL that clears on deploy.

### Plan 017 — one input, London-themed · P2b: bounded corpus reads (#201)

- **Corpus D1 reads are now bounded by a bbox prefilter** instead of scanning the whole view. A pure
  `bboxAround(origin, km)` (`worker/src/geo.ts`) feeds a bound-parameter `WHERE lat/lng BETWEEN …
  ORDER BY <proximity> LIMIT` (static SQL — the ADR 0002 whitelist is preserved), with a
  **widen-radius retry** (0.5 km → 2 km → 8 km → unbounded; corrected in 018 P1) so results never
  silently shrink and the #182 empty-view fallback still fires on the final unbounded read. `nearestN` re-ranks the bounded set by
  exact haversine, so results are identical to the old full-scan path for the demo postcodes.
- **New migration `0005_geo_indexes.sql`** — a `(lat, lng)` index per raw corpus table
  (`cqc_locations`, `nhle_places`, `greenspace_places`, `fhrs_establishments`). **This is the half
  that makes the prefilter real:** D1 bills rows *scanned*, so without the index a bare `WHERE` still
  scans the whole table (PR #206). Applied `--remote` and measured live in 018 P1 (see above).
- **Why:** one food-hygiene ask read all 66,871 rows against D1's 5M row-reads/day (~75 asks/day).
  P2's free-text input invites exploratory asking, so the reads had to be bounded before the P3 UI
  ships. The row-read *win* is proven live (`meta.rows_read`, `EXPLAIN QUERY PLAN`) — a mocked D1
  can't model scanning — via the `d1-verify` CI workflow (`bbox_plan` / `bbox_rows_read`); **measured
  live in 018 P1** (5 km 1.2× → 0.5 km 17.5×). No new ADR: an implementation consequence of ADR 0002.

### Plan 017 — one input, London-themed · P2: query-driven auto-routing (#201)

- **One input, no manual switcher.** A prompt-only `POST /api/run` (no `?usecase=`) now auto-routes
  the free-text ask to a workflow (**ADR 0004**). A keyless keyword heuristic decides the common
  cases with no model call; a genuinely unsure ask escalates to the existing free chain; an
  unconfident result renders a deterministic **no-match card** listing what the app can do — **never
  a silent flagship fallback**. **No new env or secret** — the router reuses the keyless free chain.
- **`?usecase=` remains an explicit bypass** (deep links + the founders demo) — it skips the router
  entirely and emits no `USECASE_RESOLVED`.
- **New SSE event `USECASE_RESOLVED{usecase,title}`** — emitted once before `RUN_STARTED` on an
  auto-routed run so the client can announce the chosen workflow (the UI consumes it in P3; the
  event is additive and older clients ignore it).
- **`sort-my-route` and `founders-copilot` are never auto-routed** — they carry no router `keywords`,
  so the router literally cannot reach them; both stay offered as suggestions on the no-match card
  and reachable via `?usecase=`. `route`'s canned, origin-agnostic render would otherwise answer a
  real journey with a fabricated one (ADR 0004 records this).
- **Security:** the router gates user text through `detectInjection` before any model call, mirroring
  `resolveRun`. **No agent framework** was added (**ADR 0003**): a single forced-tool call over the
  existing `callModelTool`/`runChain`/zod plumbing.
- **Telemetry:** one `route` span per auto-routed request (`routed_to`, `source`), so we can see
  empirically whether the model tier ever beats the heuristic (ADR 0003's revisit trigger).
- Internals: `worker.ts` reads the POST body ONCE and threads it into both the router and
  `resolveRun` (the classifier needs `prompt` before the usecase resolves); router `keywords` are
  register-only DATA on `UsecaseDef`.

### Plan 017 — CI deploy + credential-free D1 verification (#201)

- **New workflow `Deploy (Cloudflare)`** (`workflow_dispatch`, `production` Environment) — runs
  `scripts/provision_cf.sh`, then asserts with browser headers that the hashed entry script is served
  as JavaScript, guarding the #178 SPA-fallback regression that once blanked the site.
- **New workflow `D1 Verify (read-only)`** (`workflow_dispatch`, `production` Environment) — one of
  four **static** SELECTs: `corpus_meta` freshness (the carried-over 016 cron check), `row_counts`,
  and `bbox_plan` / `bbox_rows_read` for plan 017 P2b. The dispatch takes a `choice`, never free-text
  SQL, mirroring ADR 0002's closed `VIEW_SQL` whitelist.
- **Why:** a dev environment without Cloudflare credentials can neither deploy nor verify — the D1
  binding is `remote = true`, so even `wrangler dev` refuses to start. These move both into CI, so
  P2b's row-read done-when is measurable with no local credential. **New secrets:**
  `CLOUDFLARE_API_TOKEN` (now also needs D1:Edit) + `CLOUDFLARE_ACCOUNT_ID`; both workflows fail fast
  with a readable message until they exist. Documented in `docs/deploy-cloudflare.md`.

### Plan 017 — one input, London-themed · P1: the theme (#201)

- **New look: the fo Linear system with three London accent variants.** `ui/src/tokens.css` moves
  off the vendored EyeRest palette (amber on parchment) to near-black/near-white neutrals plus a
  selectable accent — **A Thames Teal** (default), **B Heritage Indigo**, **C Westminster Green** —
  each in light and dark. Token *names* are unchanged, so every existing Tailwind utility still
  resolves. The file is now project-owned: **ADR 0005**, and a future session must not re-vendor
  EyeRest over it.
- **New URL switch `?variant=thames|indigo|green`**, persisted in `localStorage["qte77-variant"]`
  and applied before first paint by `ui/public/variant-init.js` — the same anti-FOUC, CSP-safe
  (external, not inline) pattern as `theme-init.js`. A cycle control sits beside the theme toggle.
- **Contrast measured, not assumed — three upstream values did not survive it.** fo's dark indigo
  is 3.89:1 on the dark card surface (fails AA as text) → `#7b86e3`; fo's semantic trio measures
  3.59/3.08/1.98 on the light neutrals → deepened light equivalents; fo's hairline border is
  ~1.4:1, fine for a card edge but not where a border IS the control affordance (WCAG 1.4.11) →
  new `--color-border-strong` for inputs and toggles. Details in ADR 0005.
- **The e2e sweep now scans the whole matrix** — axe runs per accent variant × scheme (6
  combinations on desktop, screenshot each), which is what caught the indigo failure before it
  shipped. Previously only the default palette was ever scanned.
- **JetBrains Mono is self-hosted again** (`@fontsource/jetbrains-mono`, latin-400) and now has a
  user-facing job: the footer version and the dev event stream set numerals in it.
- **Retired the #154 workaround** — links no longer hardcode a deepened `#725810`; every variant's
  accent clears AA on the card surface in both schemes, so the colour comes from the token. No hex
  remains outside `tokens.css` except `<meta name="theme-color">`, which takes no `var()`.
- **Removed dead CSS** — the `#theme-toggle` width-sizer and focus rules referenced an id and a
  `theme.ts` that do not exist in this repo (ported from a sibling). Both toggles now carry a real
  focus ring. Dropped the unused `--color-data-alt` token.

### Plan 016 — keyless real data · post-close hardening

- **Ingest cron batches its D1 shadow inserts** (`db.batch()`, 50 statements/subrequest) — a
  66k-row corpus now costs ~120 subrequests instead of ~6,000, safely under the Worker
  per-invocation cap the local-dev fires never exercised (#197). Swap logic unchanged; verified
  live (batched path re-stamped the gazetteer in prod D1).

## [1.7.0] — 2026-07-23

### Plan 016 — keyless real data · P4: Sort My Food Hygiene, a NEW register-only usecase (#193)

- **New civic workflow: Sort My Food Hygiene** — postcode → nearest food-hygiene ratings with
  per-record inspection dates and official FSA links. Built REGISTER-ONLY (the arc's proof at
  scale): a corpus registry entry, `usecases/sort-my-food-hygiene.json`, one UI `USECASES` entry,
  and an e2e flow — zero engine edits. Served from D1 (FHRS, 62.9k London establishments via the P1
  pipeline; migration `0004`), with a REAL-rows bundled sample (OGL) as the fallback.
- **Licence-honest by design** — FHRS OGL attribution on the disclaimer card (swap-gated); our own
  card style, never the FSA badge graphic (trademark); ratings staleness stated (inspection date
  per record).
- **D1-only recency assert** — the e2e flow queries a postcode deliberately absent from the
  bundled sample, so it can only pass when the live store serves (marker: Marriott County Hall,
  78 m).

## [1.6.0] — 2026-07-23

### Plan 016 — keyless real data · P3: Care (the flagship) goes REAL (#191)

- **Sort My Care now serves REAL data from D1** — the keyless CQC directory (9,345 London
  locations at first fill): migration `0003` adds the record-shaped `cqc_locations` table and
  REPOINTS the existing `care_signposts` view to it (zero churn in `VIEW_SQL`/registry `d1View`);
  the never-filled TRUD-era `nhs_services` table is dropped (NHS ODS #161 stays additive). The
  bundled sample remains the outage fallback.
- **Signpost-honest by construction** — the directory carries no ratings, so the copy says
  "regulated by CQC — see the official page for current ratings" (no stale-rating liability), and
  the coverage-honest empty state notes that community pharmacies are not listed. CQC OGL
  attribution ("using CQC information") renders on the disclaimer card and is the cron's
  swap-gate precondition.
- **Parser hardening from real data** — pipe-duplicated service types deduped
  ("Doctors/GPs|Doctors/GPs" seen live); `seed.py` pads OS "YYYY-MM" versions to full ISO so the
  greenspace `asOf` passes date validation.
- **Care recency e2e assert** — markers computed with the app's own origin + haversine (the P2
  lesson): "Blue Dental Care" (40 m from the test postcode, D1-only) + the CQC attribution line.

## [1.5.0] — 2026-07-23

### Plan 016 — keyless real data · P2: Wander goes REAL (#187)

- **Sort My Wander now serves REAL data from D1** — migration `0002` (record-shaped `nhle_places` +
  `greenspace_places` raw tables + the `wander_places` UNION view), registry `d1View` flip, one
  static `VIEW_SQL` entry, and `INGEST_TARGETS` for both artifacts (23.7k NHLE listed buildings +
  12.2k OS Open Greenspace sites, London). The bundled sample stays the offline/outage fallback.
- **Licence attribution goes live** — the wander disclaimer card now renders the Historic England
  (NHLE) and OS Crown-copyright lines from reviewed registry TS; non-empty attribution is the
  cron's swap-gate precondition, so real data cannot serve without its obligations.
- **Freshness-RECENCY e2e assert** — the sweep's wander flow now asserts a D1-only record renders
  ("Platforms Piece", 89 m from the test postcode, absent from the bundled sample by construction)
  plus the attribution line — proof the LIVE site serves real data, not the sample.

### Plan 016 — keyless real data · P1 pipeline (#183, live-proven)

- **Keyless ingest pipeline, built once for three corpora** — pure stdlib parsers
  (`ingest/parsers.py`, 24 pytest cases on captured-real fixtures: postcodes.io bulk, NHLE ArcGIS,
  OS Open Greenspace GeoPackage incl. GPKG-WKB decode + OSGB36→WGS84 Helmert, CQC directory CSV,
  FHRS) + `ingest/seed.py` orchestrator; weekly `ingest.yml` publishes normalised artifacts to the
  rolling `corpus-data` release (`GITHUB_TOKEN` only — no CF credential in CI).
- **Daily corpus-ingest cron** (`worker/src/corpus/ingest.ts`, `scheduled()`, `47 4 * * *` UTC):
  release asset → shadow table → validate → atomic swap → `corpus_meta` stamp. Proven live: prod D1
  `postcodes` = 6,656 rows on first fire.
- **Licence obligations as a hard gate** — `CorpusLabels.attribution` (reviewed TS only) renders on
  the disclaimer card, and the cron REFUSES to swap real data into a corpus whose attribution is
  empty; artifacts under their row floor are refused (and fail the Action loudly).
- **Empty-view ⇒ bundled fallback** — a seeded gazetteer with a not-yet-swapped corpus view serves
  the bundled sample, never an empty answer (extends the #171 seed-probe pattern).
- **Source-reality sync** (`data/sources.json`): CQC API 403s unauthenticated clients → keyless
  path is the weekly `*_CQC_directory.csv` (no ratings carried — copy links out for ratings);
  OS Open Greenspace ships GeoPackage/Shapefile/GML only (no GeoJSON).

## [1.4.0] — 2026-07-23

### Plan 015 — naming + transparency

- **Renamed `on-it` → `sort-my-route`** ("Sort My Route") — the step-free flow now matches the
  Sort-My-X family across the engine registry, UI, e2e manifest, and active docs. Old
  `?usecase=on-it` deep links fall back to the flagship (graceful, no alias kept); the historical
  screenshot filenames are unchanged.
- **Footer shows the shipped version** — `v<version>` injected at build time (vite `define` ←
  `npm_package_version`, which `make bump` stamps), so the live footer is honest per release with no
  runtime fetch.
- **Fix: Pages SPA fallback can no longer cache-poison `/assets/*`** — during a deploy-propagation
  window a briefly-missing hashed asset was answered by the SPA fallback (index.html, HTTP 200) and
  stamped `immutable` by our own `_headers`, poisoning the edge for a year (blank page for
  encoding-variant requests; caught by two failing sweeps). A `ui/public/404.html` now disables the
  fallback so missing assets 404 for real (safe: the app is single-route). See AGENT_LEARNINGS.

## [1.3.0] — 2026-07-22

### Plan 015 — real-data operations (post-1.2.0)

- **D1 provisioned + live (A2; #13 closed)** — DB `sortmy_london_corpus` created, schema applied, the
  `DB` binding on the deployed Worker; the Pages config stays D1-free (the Worker is the sole data
  access, ADR 0002). **Empty-store fail-safe (#171):** an unseeded gazetteer now degrades to the
  bundled sample (miss → seed-probe → throw into the existing fallback), verified LIVE against the
  empty store (sweep PASS, flagship 5/5 viewports).
- **Tier-3 uptime monitor (W5·B1, #173)** — a scheduled (6-hourly + dispatch) credential-free Action
  sweeps live `sortmy.london`; FAIL ⇒ red run + artifact bundle + a deduped alert issue. First
  dispatched run green. W5·B2/B3 (ingester + cron re-seed) and W4 stay blocked on #161 (TRUD).

## [1.2.0] — 2026-07-22

### Plan 015 — civic usecase expansion + real data

- **Security/deps: vulnerability batch cleared** — `fast-uri` 3.1.4 (high, worker) + `dompurify`
  3.4.12 (low, ui) via dependabot; transitive **`sharp` → 0.35.3 by npm override** (high,
  GHSA-f88m-g3jw-g9cj — miniflare still pins 0.34.5 upstream; drop the override when it ships ≥0.35;
  verified by a `wrangler dev --local` boot smoke). Dependabot now carries **ignore rules for the
  deliberate TS-6 and zod-3 pins** (the grouped bump failed on exactly that ERESOLVE:
  typescript-eslint vs TS 7); sonarjs 4.2 + typescript-eslint 8.64 landed cleanly after (#163–#166).
- **Docs: README/architecture synced to the shipped state** — the free chain no longer lists the
  dropped GitHub Models tier; architecture reflects the shipped CorpusSource/D1 seam (ADR 0002), the
  NHS-ODS→D1 ingest plan (#161), and the deliberate zod-3 pin.
- **Engine: W6 — D1 read-through corpus store behind a `CorpusSource` seam (#13)** — `queryCorpus` now
  selects its data source: a corpus flagged with a `d1View` reads the CF **D1** store (one SQL VIEW per
  corpus = the frozen `CorpusRecord` contract in SQL; `worker/migrations/0001`) when `env.DB` is bound,
  and **any D1 failure degrades to the committed bundled sample** — an outage can never break Care.
  Threaded via the existing ctx, so `runUsecase`/`playStage` signatures are unchanged (the interpreter
  stays closed). Test-first: 5 new D1-source tests against a mocked `D1Database`. The
  `[[d1_databases]]` block ships commented-out until provisioning, so deploys stay green. Real NHS ODS
  ingest is deferred to #161.
- **Data: licence audit → `redistribute_ok` gate in `data/sources.json` + ADR 0002** — serving
  ingested data from our own store is REDISTRIBUTION, gated per source licence, not just the
  git-ignore (`docs/adr/0002-real-data-store.md`). Verified 8 sources: the OGL ones are storable
  (postcodes.io, Historic England NHLE, CQC, OS Greenspace/DataHub, FHRS, Companies House); OSM is
  conditional (ODbL share-alike); **the NHS live DoS/Service Search API forbids caching → the Care
  corpus pivots to NHS ODS bulk via TRUD** (new `nhs-ods` entry); FCA is proprietary → live/link-only,
  confirming the shipped W2 Scam design.
- **Docs: abbreviations glossary** — `docs/glossary.md`: every abbreviation used across the repo,
  defined once, grouped, with Related-column cross-refs; linked from AGENTS.md.
- **e2e: axe-core WCAG 2 A/AA gate, self-hosted + vendored** — the sweep now injects a **vendored**
  `axe-core` (`tests/e2e/vendor/axe.min.js`, MPL-2.0) via `page.evaluate` — past the strict CSP's
  `script-src`, since `add_script_tag` would be blocked — and runs a WCAG 2 A/AA scan on the desktop
  config. GATES on `critical` (keeps the sweep a usable green/red signal) and REPORTS `serious`+ (loud
  console output + `summary.json` + an `axe-desktop.json` artifact). Caught 1 real serious issue on its
  first run — card official-link contrast 4.42 < 4.5 on the light card surface (a11y issue #154; the fix
  is upstream in the vendored brand token, then the gate flips to `serious`). Vendored libs are
  self-hosted (never fetched from an external server, mirroring the app's own no-external-resources CSP)
  and excluded from CI scanners via a new `.semgrepignore`, marked vendored in `.gitattributes`.
- **e2e: `runs.jsonl` cross-session resume manifest** — each sweep run now appends a compact JSON record
  (target, label, verdict, model-host hits, axe counts, broken flows) to a COMMITTED
  `tests/e2e/runs.jsonl`, alongside the existing gitignored per-run `summary.json` — a durable run-history
  log a later session can read instead of re-parsing stdout.
- **Lint: curated `eslint-plugin-unicorn` on worker+ui (S5, #152)** — the last of the five S5
  deepest-strictness knobs; a curated rule subset rather than the full recommended set, to avoid churn
  unrelated to real bugs.
- **Deferred: `eslint-plugin-jsx-a11y` (S5, #150)** — its latest release peers ESLint `^3`–`^9`,
  incompatible with the repo's ESLint 10; forcing it on would need `legacy-peer-deps`, undermining the
  same dependency strictness S5 is adding. Deferred until the plugin supports ESLint 10.
- **Lint: `eslint-plugin-security` on worker+shared (S5, #148)** — `detect-object-injection` off (too
  noisy for this codebase's patterns) plus 2 reviewed `detect-unsafe-regex` exceptions in
  `shared/guard.ts`.
- **Types: `noPropertyAccessFromIndexSignature` (S5, #147)** — both tsconfigs; a 60-site
  bracket-notation fix across worker+ui.
- **Types: `verbatimModuleSyntax` (S5, #146)** — both tsconfigs; the first of the five S5
  deepest-strictness knobs, each shipped as its own PR.
- **Engine: e2e now asserts On It + records both orientations (H7, #144)** — `tests/e2e/flows.json` gives
  On It a `query`/`cta`/`markers` triple like Care/Wander/Scam, so the sweep **types the example prompt and
  asserts the route cards render** instead of clicking the CTA and asserting nothing (the same gap #126
  fixed for Care); video capture now records **both orientations** — desktop (landscape) + mobile-portrait
  — instead of desktop-only.
- **Engine: `RENDER_MODES`/`STAGE_EXECS` single-sourced, unions derived (H6, #143)** — `usecases.ts`'s
  `RENDER_MODES`/`STAGE_EXECS` are now `as const` arrays that are the SINGLE source; the `RenderMode`/
  `StageExec` union types are DERIVED from them (`(typeof ARR)[number]`), and `workflows.ts`'s
  `registry.render` is a total `Record<RenderMode, RenderFn>` — so `tsc`, not just tests, now catches
  drift. Closes ADR-0001's "two sources of truth" Consequences minus.
- **Engine: validate the `asOf` freshness date format (H5, #142)** — new `worker/src/dates.ts`
  (`isIsoDate` + `oldestIsoDate`): the corpus + scam queries now compute "data as of …" as the oldest
  **valid** ISO date across the shown rows, excluding any non-ISO value, so a malformed date can never
  advertise a wrong freshness. A trust-claim fix landed ahead of W4's real ingest.
- **Chain: transient-vs-fatal model-error taxonomy + one bounded retry (H3/H4, #141)** —
  `agent/model.ts`'s `callModelTool` now retries ONCE on a transient HTTP status (`429/500/502/503/504`),
  honoring `Retry-After` (capped 60 s), and fails fast on everything else (401/407 auth, 404/410 gone, 451
  legal) via `describeModelStatus`; a thrown fetch (network error / abort) is never retried. The `… | null`
  fallback contract callers rely on is unchanged.
- **Sort My Scam Check (W2, #140)** — new civic usecase: a clone-firm / FCA-register **flag** (firm name
  or FRN → register status + a deterministic clone look-alike note), signposting to verify on the FCA
  register — never a verdict. A **match** shape, not the geo nearest-N corpus: needed a new `query_scam`
  exec + a new `scam` render mode, living in its own `worker/src/scam/{registry,query,render}.ts` module
  (reuses the geo-agnostic `CorpusRow` + `a2ui/cards.ts`'s `cardsBatch`/`appendDisclaimer`). Synthetic +
  **fictional** firms; curated link = the FCA Financial Services Register; `mode:demo`. 19 scam tests.
- **Fixed: the Care flagship's prefilled postcode had no sample data (#139)** — `E8 3GT` is the Care
  example query, but the sample gazetteer lacked it (an empty state on first load). Added `E8 3GT` + local
  Hackney rows to `data/care/*` and `data/wander/*` samples.
- **Sort My Wander (W3, #138)** — new civic usecase: free heritage sites + green spaces near a London
  postcode. **Register-only** — the nearest-N proof of W1's generic corpus seam:
  `data/wander/*.sample.json` + one `corpus/registry.ts` entry + `usecases/sort-my-wander.json` + a UI
  entry, no engine TS. Curated Historic England "The List" official link. Also introduced the data-driven
  e2e manifest `tests/e2e/flows.json`. Worker+ui tsc/lint/tests green (135+22).
- **Engine: strict usecase schema at load (#133)** — `assertUsecaseDef` now rejects **unknown keys**
  (envelope `{id, title, render, stages}`, stage `{name, kind, events, exec, corpus}`), so a misspelled
  optional field — e.g. `exex` — fails loudly at load instead of being silently dropped (which would
  quietly play canned events instead of running the query). Adopts `azure-doc-workflows`' pydantic
  `extra="forbid"` (their ADR-0012) as a *pattern*, reimplemented in idiomatic TS with no dependency; the
  shared `workflow-definition/v1` schema stays `additionalProperties:true` so cross-engine extras pass.
  134 tests green.
- **Chain: dropped the GitHub Models tier (#127)** — the third keyless free provider
  (`models.github.ai`, `openai/gpt-4o-mini`) **retires 2026-07-30**, after which it would 404 and cost a
  guaranteed-fail round-trip on every keyless run before falling through. Removed `githubModelsProvider`,
  `GITHUB_MODELS_BASE`, `DEFAULT_GITHUB_MODEL`, the `githubToken`/`githubModel` build options, and the
  `GITHUB_MODELS_TOKEN`/`GITHUB_MODEL` env + `.dev.vars.example` entries. The keyless chain is now two
  tiers (Workers AI → OpenRouter :free); BYOK and the deterministic stub are unchanged. 131 tests green.
- **Engine: a corpus usecase is now register-only (W1, #80)** — the per-workflow render mode `care` and
  query exec `fetch_care_services` are replaced by a **generic `corpus` mode + `query_corpus` exec
  parameterised by a corpus id** carried on the stage def. Adding a deterministic corpus workflow
  (Wander #73, Scam #74 next) now needs **no engine TS**: one `worker/src/corpus/registry.ts` entry
  (records + postcodes + curated labels), a `usecases/<id>.json`, and a UI entry —
  `runUsecase`/`renderBatch`/`cardsBatch` stay closed. The query pre-formats each row's display line, so
  the render is shape-agnostic and a future match-shaped workflow reuses it verbatim; the curated
  official link moved out of a hardcoded constant into per-corpus labels. A `query_corpus` stage naming
  an unregistered corpus is now a **startup error** instead of a silently empty batch, and query fns
  return a `Promise` so the W4 D1-backed source is a drop-in with no seam change. Sort My Care is
  migrated to the generic path (same output); the bespoke `worker/src/care/*` is deleted. 132 tests
  green, including an end-to-end proof that a corpus usecase runs from its def alone.

- **`shared/*.ts` now linted (C, plan 015)** — the `shared/` security boundary (`guard.ts`,
  `sanitize.ts`, the tool validators) was the last unlinted TS in the repo: ESLint 10 refuses files
  above a config's own directory, so `worker/eslint.config.js` could never reach `../shared`. Added a
  root `eslint.config.js` that re-uses the worker's strict ruleset (DRY) scoped via `basePath: "shared"`,
  with the parser pinned to the worker tsconfig (which now includes `../shared`); wired into
  `worker`'s `lint` script so CI gates it. Fixed the 6 findings — notably `isValidAssessResult` /
  `isValidSearchResult` cast straight to `Partial<T>`, which told the type-checker the untrusted parsed
  model JSON could never be `null` and made their null-guards look redundant; they now narrow before
  casting (same runtime behaviour, guard preserved). Also `RegExp#exec` in `normalisePostcode` and a
  complexity split of `isSelfContainedBatch`. No behaviour change (119 tests green).
- **Fixed: malformed model output could crash the search validator (C, plan 015)** — `isValidSearchResult`
  threw `TypeError: Cannot read properties of null` on a `matches: [null]` payload instead of returning
  `false`, so an untrusted model response could fault the run rather than fall back to the canned cards.
  Root cause was a *circular* cast: `value as Partial<T>` asserts the very field types the validator
  exists to verify, so the type-checker believed the elements could never be null and no guard was
  written. Both validators now narrow to `Record<string, unknown>` before reading — every property is
  `unknown`, so each `typeof` check does real work — and each `matches` element is object-guarded.
  `shared/` also no longer inherits the worker's ESLint relaxations (`no-non-null-assertion`,
  `no-confusing-void-expression`): the security boundary is now a strict superset (121 tests green).

## [1.1.0] - 2026-07-19

Post-hackathon work on `main` (plans 013 + 014), after the v1.0.0 tag: the browser-BYOK security pivot, the
civic landing + `sortmy.london` rebrand, load performance, and max strictness / security hardening — live.

### Plan 014 — civic landing · performance · max strictness · deploy fixes

- **Civic landing + rebrand (U, #109/#110)** — task-first, progressive-disclosure page; **Sort My Care**
  is the flagship (a London postcode → NHS & care services), **On It** (step-free routes) revealed on
  demand; Founder's Copilot dropped from the civic default (kept at `?usecase=founders-copilot`). Added a
  real 1200×630 `og:image` + `robots.txt` + `sitemap.xml` + a WCAG footer statement, and a tested
  `readUsecase()` flow-router. Mobile-first; verified live via the e2e sweep.
- **Load performance (P, #98/#101)** — immutable `Cache-Control` on `/assets/*`; deduped zod to v3
  (-17.9 KB gz JS); latin-only Inter, dropped JetBrains Mono (-14.5 KB gz CSS); a gzip bundle-size CI guard.
- **Max strictness (S1–S4, #105/#106/#111/#112)** — `engines` / `.nvmrc` / `.npmrc`; pinned + broadened
  Semgrep, `npm audit`, CodeQL `security-extended`, SHA-pinned dependency-review; `Permissions-Policy` +
  HSTS; dependabot `cooldown` + `.npmrc` `min-release-age` supply-chain hardening. Worker ESLint
  (strictTypeChecked — 70 findings fixed, `resolveRun`/`runUsecase`/`assertUsecaseDef` refactored) + the 7
  strict tsconfig flags to `ui` parity — no behaviour change (119 tests green).
- **Deploy/dev CLI fixes (#99/#102/#104)** — `make deploy` now builds + ships the SPA (was worker-only);
  worker `dev`/`deploy` pass `--config wrangler.toml` (wrangler v4 else misreads the root Pages config);
  `provision_cf.sh` tolerates the benign code-10000 worker-route step; deleted the dead `seed` target.
- **Docs (#103)** — `docs/engineering-practices.md` playbook + `AGENT_LEARNINGS.md` ledger.

### Security
- **Removed the entire browser BYOK/model path** (#83, plan 013 · A). The deployed SPA had inlined a real
  OpenRouter key (`VITE_BYOK_API_KEY`, via Vite) and called OpenRouter **directly from the browser** (live
  `401 "User not found"`). Deleted `ui/src/agent/liveAgent.ts` + the `runByokPath`/`useByok` branch; every
  run now streams through the Worker `POST /api/run` (SSE), and a BYOK key rides as an `Authorization`
  header resolved **server-side** (`resolveRun`) — the browser never contacts a model host. The
  `VITE_BYOK_*` env surface and the `@ai-sdk/openai` + `ai` deps are gone; no `VITE_*` var can inline a key
  again. A red-first `runWorkerPath` test + an e2e sweep enforce the invariant across devices.

### Changed
- **Console-gate → civic-clean default** (#85, plan 013 · B). The default UI is now just prompt + Run +
  the A2UI surface; the AG-UI event console and the ⚙ Key panel are hidden behind a **dev mode** (Ctrl+K /
  Ctrl+I or `?dev=1`, persisted in `localStorage["qte77-dev"]`). New pure, tested `ui/src/devmode.ts`. The
  ◫ Catalog and the Live/Demo toggle were **deleted** (civic runs are always Live; the Worker's `?demo=1`
  stays available).
- **Brand theme — vendored, registry-independent** (#86, plan 013 · C, #82). Design tokens moved to a
  single provenance-headed `ui/src/tokens.css` (from `qte77/brand`, `@qte77/ui-theme@0.2.0`) instead of a
  hand-copied `@theme` block — keeping the build free of the `@qte77` private registry (no `.npmrc` / no
  `NODE_AUTH_TOKEN`). Real fonts (`@fontsource/inter` + `jetbrains-mono`) now load (were named but never
  `@font-face`d), and the favicon is recolored to the **zero-blue** EyeRest palette (was GitHub blue).
- **Hosting → full Cloudflare.** The SPA now deploys to **Cloudflare Pages** at `sortmy.london`, and the
  Worker serves **same-origin `/api/*`** via a Worker route (was: GitHub Pages + a cross-origin
  `*.workers.dev` Worker over CORS). Endpoints are now `POST /api/run` / `POST /api/trace`; GitHub Pages
  (`gh-pages.yml`) retired; deploy via `scripts/provision_cf.sh` + `scripts/finish_cf.sh`
  ([`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md)).
- **Adopted the shared `workflow-definition/v1` contract.** Renamed `StageDef.span` → `name` across
  `usecases/*.json` and the Worker (`usecases.ts`, `worker.ts`) so a shipped usecase def is a valid
  `workflow-definition/v1` envelope — the cross-engine core is a non-empty `id` + ordered, non-empty
  `stages[].name`; our `title` / `render` / `kind` / `events` / `exec` stay permitted extras
  (`additionalProperties:true`). Added an ajv contract test validating every `usecases/*.json` against the
  schema vendored from `qte77/protocols@workflow-definition/v1.0.0` (`worker/test/fixtures/contract/`), and
  asserting the TS guard `assertUsecaseDef` rejects each vendored `invalid/*` fixture.

### Fixed
- **`npm ci` unbroken.** Two Dependabot combined-bumps left conflicting peers on `main` (each PR was green
  alone): `typescript` bumped to `~7.0.2` while `typescript-eslint@8.63.0` requires `<6.1.0`, and
  `wrangler@4.110` needed `@cloudflare/workers-types@^5` (pinned `^4`). Pinned `typescript` back to `~6.0.3`
  and aligned `workers-types` to `^5`; lockfiles regenerated.
- **Workers AI free provider now actually runs in the deployed Worker.** `workersAiProvider` invoked the
  `ai.run` binding **detached** from `ai`, so the binding's private-field access (`this.#options`) threw
  (`Cannot set properties of undefined`) and *every* keyless run silently fell back to the stub — since
  #37 the deployed demo had never been model-driven. Bind `ai.run` to `ai`. The live site now streams real
  `assess_stage` / `search_opportunities` reasoning + a model-grounded render (the model even drops
  opportunities that don't fit). Regression test added (a `this`-dependent fake binding).

### Added
- **e2e UI sweep harness** (#84, plan 013 · D). `tests/e2e/ui_sweep.py` (Patchright, headless Chromium)
  drives the SPA across viewport × device × orientation, capturing the DevTools console + network,
  screenshots, an a11y snapshot, and desktop video — and **fails if the browser ever contacts a model
  host**, so it doubles as the item-A regression gate. Plus `tests/e2e/devmode_check.py` for the dev-mode
  gate. Runs via polyfetch's venv; artifacts in `tests/e2e/results/` (gitignored).
- **Civic essentials** (#87, plan 013 · G). WCAG-AA accessibility (an sr-only `<h1>`, a results `<h2>`, a
  labelled query input, `role="alert"` errors, `aria-live` results, focus-visible rings), civic SEO +
  OpenGraph/Twitter metadata, a cookie-free privacy footer (Cloudflare Web Analytics is enabled per-project
  in the CF dashboard — cookieless, no token in code), and friendly failure copy (raw detail only in dev
  mode).
- **Sort My Care + a general workflow engine** (#72). New `worker/src/workflows.ts` registry dispatches
  render by `mode` and deterministic query by `exec`, so adding a **corpus workflow** is register + a JSON —
  `runUsecase`/`renderBatch` never change (open/closed; `founders`/`route`/`care` all register). **Sort My
  Care** is the pilot: a **model-free + fetch-free** postcode → nearest public-health/care-services query
  (`shared/sanitize.ts` UK-postcode boundary — no SSRF; `worker/src/geo.ts` haversine + nearest-N;
  `worker/src/care/*` over a **synthetic** corpus `data/care/*.json`), rendered as A2UI cards with corpus
  **freshness** ("data as of …") + a curated "confirm with the official source" disclaimer (`cards.ts`
  `appendDisclaimer`). Deterministic runs now report `USAGE mode:demo` (not a degraded `stub`). Reachable at
  `?usecase=sort-my-care` (postcode passed as the run prompt); no new env/secret or CLI switch. Real ingest +
  CF D1 (#13) are follow-ups.
- Phase 2 (#18) PR-3 — a **HUD status bar**. The Worker now emits ONE terminal `USAGE` event per run
  (`{ mode, model?, provider?, promptTokens, completionTokens, totalTokens }`, between the render write and
  `RUN_FINISHED`), summed across the live stages + render. The SPA renders an **honest 3-state chip** in the
  events header — `LIVE · <model> · ~N tok` / `DEMO · deterministic` / `STUB · fell back` (never "LIVE" when
  the model path fell back). A **Demo⇄Live toggle** (default Live) finally wires the documented `?demo=1`
  switch from the browser — it was unreachable before (`App.tsx` never forwarded `demo`). Tokens, not `$`
  (the free chain never spends). Pure `toStatus` mapper; `USAGE` intercepted in `useAgentSSE.dispatch` (like
  `RUN_ERROR`).
- Phase 2 (#18) — the founder workflow's early stages are now **model-driven**: `assess_stage` (classify
  the founder's stage + unlock steps) and `search_opportunities` (rank/filter the corpus) run as forced
  tools on the keyless free chain, each streaming its `reasoning` as a live event and emitting its own
  Arize **LLM** span (`model:<exec>`, token usage attached); the ranked matches ground the render. Any
  model miss falls back to the canned stage text (never worse than before). Generalized the provider chain
  (`runChain` + per-provider `tryCall`) so it runs any tool, and stages opt in via `exec` in `usecases/*.json`.
- CI + repo-hygiene parity with `agenthud-agui-a2ui`: **CodeQL** security scanning (`codeql.yaml`), a
  self-contained **Lint MD and Links** workflow (markdownlint, moved out of `ci.yml`'s `docs` job), and
  **Dependabot** (npm for `ui/` + `worker/`, plus github-actions), and the README badge row restyled to
  match (license · version · CI · CodeQL · CodeFactor · Lint · Dependabot). All workflow actions are
  SHA-pinned to satisfy the repo Actions policy (`allowed_actions=selected` + `sha_pinning_required`).
- Phase 2 groundwork (#18): generalized the forced-tool model call into `callModelTool` / `extractToolArgs`
  (runs any tool), with `callRenderModel` now a thin `render_ui` wrapper — no behavior change; added
  dependency-free `shared/assessTool.ts` + `shared/searchTool.ts` (tool schemas + structural validators; the
  search validator rejects invented opportunity ids) as the contracts for the upcoming live `assess_stage` /
  `search_opportunities` stages.
- UI: **Track B (Founder's Copilot) is the default workflow**, with its example prefilled; the workflow
  **no longer auto-runs on page load** — it runs only when the visitor clicks Run.
- Workers AI default model → `@cf/openai/gpt-oss-120b` (live-verified 2026-07-08; `@cf/zai-org/glm-4.7-flash`
  hits capacity `429`). Documented the required Cloudflare API-token permissions (incl. **Workers AI Read**
  for `/ai/run`) + Arize ingestion setup in `worker/README.md`.
- Browser-BYOK founders render now appends the **same** verified incorporate card as the Worker: the
  how-to pack moved to dependency-free `shared/incorporate.ts`, imported by both paths (#37 fast-follow).
- Free chain: the OpenRouter `:free` tier now walks a fallback **list** of 6 verified free + tool-capable
  models (they rate-limit / rotate), first-valid-wins, each miss logged for `wrangler tail`; the winning
  model id rides into the render span. Override via `OPENROUTER_FREE_MODELS` (csv). (#37 fast-follow)
- Two-path model access (#37) — shared dependency-free `shared/` foundation (prompt/tool/validator), a
  prompt-injection guard (flagged prompt → deterministic stub), and a per-IP rate-limit (429) on `/run` (#42).
- Keyless free-fallback render chain: Workers AI → OpenRouter `:free` → GitHub Models → stub, first-valid
  wins with each tier structurally validated; a BYOK header stays the paid path, our key feeds `:free`
  (never a paid call), so the Worker rarely/never spends (#43).
- Real Arize **OTLP** export (OpenInference spans → `otlp.arize.com` when `ARIZE_API_KEY`+`ARIZE_SPACE_ID`
  are set; console otherwise) + a CORS-allowlisted `POST /trace` forwarder for browser spans (closes #21).
- A2UI render-surface theming, EyeRest-branded (port of base PR #168) (#31).
- Externalized both workflows' plan→tool→render choreography to `usecases/*.json`, read at runtime by a
  small `runUsecase` interpreter (`worker/src/usecases.ts`, guarded at load); render modes stay in code.
  "Swap a JSON, swap the app" is now literal for stage choreography (#28).
- Track-B **incorporate how-to-pack card**: a verified, static set of real gov.uk / Companies House
  links (clickable markdown anchors, never LLM-generated), appended to the founders render on both the
  stub and model paths, plus a `tool:incorporate` HUD stage. Not a live filing (#12; the live filing
  stays deferred).
- Style A2UI-surface markdown links (`<a>`) as links (primary colour + underline) so the incorporate
  card's verified links read as clickable (they were already anchors; this is the visible affordance).

## [1.0.0] - 2026-07-04

Final **Londonmaxxing 003** hackathon build — the state at the end of the hack day (commit `01d2c95`).

### Added
- Repo scaffold + docs (architecture, user stories, use-case workflows, build plan, submission).
- Phase 1 first E2E: SPA → `POST /run?usecase=<id>` (SSE) → built-in A2UI cards; `useAgentSSE`
  transport; `runStages` per usecase (`founders-copilot` + thin `on-it`); console Arize span
  per stage; optional in-dashboard BYOK; `ui`/`worker` CI jobs + GitHub Pages deploy workflow.
- Real OpenRouter call for Track B's `search_opportunities` render, with a deterministic stub
  fallback on any failure (#19).
- Theme toggle + `?demo=1` keyless auto-run (#20).
- Raised model `max_tokens` so the `render_ui` batch isn't truncated (#22).
- Live A2UI component catalog + Track-A default on load + 100% worker observability (#24).
- Usecase toggle now swaps the example input query to match the selected track (#25).
