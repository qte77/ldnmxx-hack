---
title: "Plan 022 — raise nearest-N and name the pool, so the depth behind an answer shows"
type: plan
status: "shipped (2026-08-06); deploy + live verify owner-gated"
refs: ["arc 021 (value-prop fold)", "ADR 0002 (fetch-free store)"]
---

# Plan 022 — the depth shows

## Context (why)

Arc 021 made the *coverage* visible on the landing page (112,000+ official records). The **answer** still
hid it: a query returned **3** cards and the summary said only *"3 venues near Camden"*. A 3-row answer
drawn from 67,082 FSA records looked identical to one drawn from a 12-row bundled sample — the depth the
app actually has was invisible at the exact moment it mattered most.

Two levers, both shipped:

1. **Raise the default answer size 3 → 5.** Free: `source.ts` `BBOX_CAP` already returns up to **50**
   nearest-by-proxy rows per bounded read, so N=5 buys **no extra D1 read**, and `readWithinWidening`
   already widens the box when a sparse area holds fewer than N.
2. **Name the pool on the summary card** — *"Nearest 5 · from 67,082 official records"*. Read from
   `corpus_meta`, the same row already powering `GET /api/freshness`.

## Owner decisions (LOCKED 2026-08-06)

- **N = 5** — a real jump in perceived depth while the answer stays one scannable screen on mobile
  (8 or 10 were rejected: a long scroll works against the elderly / less-technical audience arc 020
  optimised for, and it costs the nearest result its prominence).
- **Show the pool count**, phrased as provenance (*from N official records*), not as a search claim.

## Honesty rules (enforced in code, not copy review)

- The count is a **real ingested count** from `corpus_meta`, never a guess or a constant.
- **Unknown size ⇒ no claim.** The bundled 12-row sample reports nothing, so it can never imply a full
  corpus. `null`, `undefined` and `0` all render no line.
- **`wander_places` UNIONs two ingests**, so its pool is the **sum** of `wander-greenspace` +
  `wander-nhle` (35,938) — never one arm presented as the whole.
- **"Nearest N" is load-bearing** — it says these are the *closest* of that pool, not an arbitrary slice.
- The count reflects **rows actually shown**, so a sparse area reads "Nearest 2", never a padded 5.

## Design decisions worth keeping

- **The pool read is cosmetic and must never cost a user their answer.** `poolSize()` (`query.ts`) wraps
  `source.size()` in its own try/catch, deliberately **outside** `queryCorpus`'s D1 try/catch — a
  `corpus_meta` hiccup degrades to "no claim", and must not demote a working D1 answer to the bundled
  sample. It runs **concurrently** with the records read (`Promise.all`), so it adds no latency.
- **`size()` is optional on `CorpusSource`.** A source that cannot count simply omits it; the bundled
  source does exactly that. No null-object ceremony.
- **No new SQL.** `size()` reuses `FRESHNESS_SQL` — the existing reviewed static statement — over a
  handful of `corpus_meta` rows, and sums in JS. This keeps the statement set closed and static
  (ADR 0002: no runtime string-building near the database, no per-view `IN` list).
- **`VIEW_META_KEYS`** mirrors `VIEW_SQL`: a new view declares its meta keys consciously, or reports no
  size at all. Never inferred from the view name.

## Progress (shipped in one PR)

| # | Item | Kind | Status |
|---|---|---|---|
| P1 | `DEFAULT_N` 3 → 5 (`corpus/query.ts`), `BBOX_CAP` comment corrected | module · RED-first | ☑ |
| P2 | `CorpusSource.size()` + `VIEW_META_KEYS` + `corpus_meta` sum (`corpus/source.ts`) | module · RED-first | ☑ |
| P3 | `poolSize()` isolation + concurrent read; `corpusSize` on `CorpusQuery` | module · RED-first | ☑ |
| P4 | Provenance line on the summary card (`corpus/render.ts`) | module · RED-first | ☑ |
| P5 | Refresh the stale `docs/handoffs/README.md` resume point (was arc 018, six arcs behind) | docs | ☑ |

## Remaining work

**None — arc closed 2026-08-06.** P1-P5 shipped in #267; P6 deployed and verified live:
`food hygiene near Camden` returns **"🍽️ 5 venues near Camden"** + **"Nearest 5 · from 67,082 official
records"**. The same probe exposed a pre-existing data-honesty defect (placeholder `1901-01-01`
inspection dates) — that is **arc 023**, not a remainder of this one.

| # | Item | Gate | Status |
|---|---|---|---|
| — | (no open items) | — | Migrate any new work to arc 023 |

## Source map

- **N:** `worker/src/corpus/query.ts` `DEFAULT_N` (used by both `queryCorpusDef` and `queryCorpus`;
  `workflows.ts:42` passes no `n`, so the default is the only knob).
- **Pool count:** `worker/src/corpus/source.ts` — `VIEW_META_KEYS`, `d1Source().size()`, reusing
  `FRESHNESS_SQL` from `worker/src/freshness.ts`.
- **Isolation:** `worker/src/corpus/query.ts` `poolSize()` + `rankFrom`'s `Promise.all`.
- **Contract:** `worker/src/corpus/contract.ts` `CorpusQuery.corpusSize`
  (`number | null | undefined` — `exactOptionalPropertyTypes` requires the explicit `undefined`).
- **Render:** `worker/src/corpus/render.ts` summary `lines`.
- **Tests:** `worker/test/corpus.depth.test.ts` (new: default N, explicit N, sparse, UNION sum, meta
  failure isolation, bundled = no claim) · `worker/test/corpus.render.test.ts` (provenance line present /
  counted from shown rows / omitted when unknown).

## Verification (as run)

- RED confirmed before each fix (5 failing across the two suites), then green.
- Gates: worker lint · typecheck · test (**290**) · ui lint · typecheck · test (38) · build ·
  size (141.2/150KB JS, 5.1/8KB CSS). Semgrep clean on changed files (the one reported hit is the
  pre-existing `console.warn` format-string finding in `query.ts`, unchanged by this arc).

## Watch-outs

- **Do not fold `poolSize` into the D1 try/catch** — that would let a cosmetic count failure demote a
  working D1 answer to the bundled sample.
- **A new D1 view needs a `VIEW_META_KEYS` entry**, or it silently reports no pool size.
- Raising N further stays free only while it is well under `BBOX_CAP` (50); beyond that the cap, not the
  corpus, would decide the answer.
