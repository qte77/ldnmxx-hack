---
title: "Plan 023 — placeholder inspection dates must read as unknown, never as 1901"
type: plan
status: "code shipped (2026-08-06); stored rows self-heal on the next ingest cron"
refs: ["arc 022 (nearest-N depth)", "#182 P5 (data honesty)", "ADR 0002"]
---

# Plan 023 — a placeholder is not a date

## Context (why)

Verifying arc 022 on the live deploy, a real query returned:

```text
Food hygiene ratings near you · inspected 1901-01-01
```

**Root cause.** `ingest/parsers.py` `parse_fhrs` already carried a guard for exactly this — but it
matched **one** magic value:

```python
if ... or rating_date == "1900-01-01":   # FHRS also uses 1901-01-01
```

The FSA stamps un-inspected establishments (`RatingValue: "AwaitingInspection"`) with a placeholder
date, and uses **1901-01-01** as well as 1900-01-01. The exact-match guard never fired for it, so
**6,361 of 67,082 live rows** (9.5%) carry it — both in `lastUpdated` and, worse, in the human text:

```text
Food hygiene rating AwaitingInspection, inspected 1901-01-01 — confirm on the official FSA page.
```

**Not introduced by arc 022.** Those rows could always surface; raising N 3 → 5 lifted the per-query
odds of hitting one from ~26% to ~40% and made it newly visible on the *summary* line (whose `asOf` is
the oldest shown row). Arc 022 exposed a latent defect rather than causing one.

**Why it matters more than its size suggests:** this app's entire promise is "the official source". A
card reading *"rating AwaitingInspection, inspected 1901-01-01"* reads as broken software, and it is
precisely the honesty claim arc 021 put on the landing page.

## The fix (two layers, deliberately)

1. **Ingest — stop it at the source.** The guard is now a **plausibility floor**, not a sentinel list:
   the FHRS scheme began in 2010, so any pre-2000 date is a placeholder *whatever its exact value*
   (`FHRS_MIN_PLAUSIBLE_DATE = "2000-01-01"`). A sentinel list is brittle by nature — that brittleness
   is exactly why this recurred — so the next value the FSA invents is caught by construction.
2. **Hot path — defence in depth.** `formatDateLabel` refuses to print a pre-2000 `inspected` date,
   returning "" (no claim) instead. This covers rows **already stored** and any placeholder a future
   source invents. Scoped to `inspected` on purpose: `listedYear` dates are legitimately old (NHLE
   listings from 1949), so the floor must never touch them.

## Honesty rule

**No claim beats a false one.** An implausible inspection date is a placeholder, not an inspection, so
the summary makes no date claim at all rather than advertising one that is untrue.

## Progress (shipped in one PR)

| # | Item | Kind | Status |
|---|---|---|---|
| P1 | Plausibility floor in `parse_fhrs` (was an exact 1900-01-01 match) | module · RED-first | ☑ parametrised over 4 placeholders + 3 real dates |
| P2 | `formatDateLabel` refuses implausible `inspected` dates | module · RED-first | ☑ `listedYear` explicitly unaffected |
| P3 | `AGENT_LEARNINGS.md` — sentinel-list guards are brittle; use a plausibility floor | docs | ☑ |

## Remaining work

| # | Item | Gate | Done-when |
|---|---|---|---|
| P4 | Purge the 6,361 stored placeholder rows so per-row `why` text stops showing 1901 | **data** | The daily ingest cron (`47 4 * * *` UTC) re-parses with the fixed guard and swaps them out — self-healing, no action required. Owner may dispatch `ingest.yml` to pull it forward. Verify: `SELECT COUNT(*) FROM food_hygiene WHERE lastUpdated < '2000-01-01'` returns 0 |

## Scope note (what this fix does NOT do yet)

The hot-path backstop fixes the **summary** line immediately, because it is computed at render time. The
**per-row** text is a stored string built at ingest, so those cards keep reading "inspected 1901-01-01"
until P4 lands. Chosen deliberately over a render-time rewrite of stored `why` strings, which would mean
parsing prose on the hot path to repair data — the wrong layer for a data defect.

## Source map

- `ingest/parsers.py` — `FHRS_MIN_PLAUSIBLE_DATE`, `parse_fhrs` guard.
- `ingest/tests/test_parsers.py` — `TestParseFhrs::test_drops_any_implausible_rating_date` (parametrised)
  and `test_keeps_real_inspection_dates`.
- `worker/src/dates.ts` — `MIN_PLAUSIBLE_INSPECTION_DATE`, `formatDateLabel`.
- `worker/test/dates.test.ts` — the mode-aware backstop tests.

## Verification (as run)

- RED confirmed for both layers (3 failing ingest cases on the real sentinel; 1 failing worker case).
- Gates: `uvx pytest -q ingest` **34** · `uvx ruff check` clean · worker lint · typecheck · test **293** ·
  ui lint · typecheck · test 38 · build · size. Live D1 counts measured with a read-only query.

## Watch-outs

- **Never re-introduce an exact-value sentinel guard** — floors, not lists.
- The floor is per-semantic, not global: `listedYear` (NHLE, 1949) and `asOf` are legitimately old.
- If a future corpus genuinely needs pre-2000 inspection dates, make the floor per-corpus rather than
  loosening it globally.
