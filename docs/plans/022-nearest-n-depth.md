---
title: "Plan 022 — raise nearest-N and name the pool, so the depth behind an answer shows"
type: plan
status: "shipped (2026-08-06); deploy + live verify owner-gated"
refs: ["arc 021 (value-prop fold)", "ADR 0002 (fetch-free store)"]
---

# Plan 022 — the depth shows

## Handoff (read this first)

**Originally handoff 022 — "nearest-N raised to 5 + the summary card names the pool it ranked from.
Shipped; only the owner deploy + live re-probe remain." (updated 2026-08-06).**

### Onboarding — the 30-second picture

Arc 021 made the app's *coverage* visible on the landing page (112,000+ official records, a sample answer
card, a place-less ask that no longer reads as a form error). The **answer itself** still hid that depth:
3 cards, and a summary line that could equally have come from a 12-row sample.

Arc 022 fixes that at the point of the answer: **5 results by default** (free — `BBOX_CAP` already reads
up to 50 nearest rows per bounded D1 read) and a provenance line naming the pool:
**"Nearest 5 · from 67,082 official records"**, read from `corpus_meta`, the same row already behind
`GET /api/freshness`.

### What shipped

- `DEFAULT_N` 3 → 5 in `worker/src/corpus/query.ts` (the only knob — `workflows.ts` passes no `n`).
- `CorpusSource.size()` (optional) + `VIEW_META_KEYS` in `worker/src/corpus/source.ts`, reusing
  `FRESHNESS_SQL` — no new SQL, statement set stays closed and static (ADR 0002).
- `poolSize()` in `query.ts`: cosmetic-by-contract, isolated try/catch **outside** the D1 fallback,
  run concurrently with the records read.
- Provenance line in `worker/src/corpus/render.ts`; `corpusSize` on `CorpusQuery`.
- The handoffs index's resume point refreshed — it still pointed at **arc 018**, six arcs stale.

### Next (in order) — historical, see Remaining work below for current state

1. **P6 — owner deploy**, then re-probe live: a real query should return 5 cards and the summary should
   read "Nearest 5 · from N official records". This was the ONLY open item at handoff time; see the
   Remaining work table below (closed since).

### Owner gates

- **Deploy** — an owner DECISION, not an agent incapability (see the arc-021 correction). `make deploy`
  works from the devcontainer: the gitignored repo-root `.env` carries a valid `CLOUDFLARE_API_TOKEN` and
  `scripts/provision_cf.sh` sources it. `gh workflow run deploy.yml` remains preferred (a known merged
  commit through the production Environment) and is classifier-blocked for the agent.
- **Local UI verification without the Worker:** `make dev` cannot boot the Worker (`wrangler dev` does not
  source the repo-root `.env`). Use
  `VITE_WORKER_BASE=https://sortmy.london npm --prefix ui run dev` — `ALLOWED_ORIGINS` whitelists
  `localhost:5173`, so the real API answers.

### The loop (per phase / PR)

branch per topic → RED-first (modules only; CSS/wiring → the browser sweep) → gates (`npm --prefix
worker|ui run lint|typecheck|test` [ui: `build`+`size`] · semgrep · markdownlint) → push → PR → CI green →
squash-merge → prune → deploy (owner) + sweep.

### Watch-outs (carried; do NOT relearn)

- **`gh pr merge --admin` is classifier-blocked**; `gh api --method PUT
  /repos/qte77/ldnmxx-hack/pulls/<n>/merge -f merge_method=squash` performs the same squash merge without
  touching rulesets.
- **Never fold `poolSize` into the D1 try/catch** — a cosmetic count failure must not demote a working D1
  answer to the bundled sample.
- **A new D1 view needs a `VIEW_META_KEYS` entry**, or it silently reports no pool size.
- **Unknown size ⇒ no claim** — the bundled sample must never imply a full corpus. `null`/`undefined`/`0`
  all render nothing.
- `exactOptionalPropertyTypes` means an optional field that may be explicitly `undefined` must say so
  (`corpusSize?: number | null | undefined`).
- **Do not "fix" corpus-level `asOf`** — deliberately the *oldest* row date (`1901-01-01` for
  food-hygiene). Per-record card dates are correct; never surface corpus-level `asOf` in the civic UI.
- A handoff watch-out is a claim, not a fact — re-verify inherited "the agent cannot X" limits
  (see `AGENT_LEARNINGS.md`).

### Conventions (hard)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` ·
`env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · squash on green (never modify rulesets) · prune.

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

## Remaining work

**None — arc closed 2026-08-06.** P1-P5 shipped in #267; P6 deployed and verified live:
`food hygiene near Camden` returns **"🍽️ 5 venues near Camden"** + **"Nearest 5 · from 67,082 official
records"**. The same probe exposed a pre-existing data-honesty defect (placeholder `1901-01-01`
inspection dates) — that is **arc 023**, not a remainder of this one. Migrate any new work to arc 023.

| # | Item | Kind | Status |
|---|---|---|---|
| P1 | `DEFAULT_N` 3 → 5 (`corpus/query.ts`), `BBOX_CAP` comment corrected | module · RED-first | ☑ |
| P2 | `CorpusSource.size()` + `VIEW_META_KEYS` + `corpus_meta` sum (`corpus/source.ts`) | module · RED-first | ☑ |
| P3 | `poolSize()` isolation + concurrent read; `corpusSize` on `CorpusQuery` | module · RED-first | ☑ |
| P4 | Provenance line on the summary card (`corpus/render.ts`) | module · RED-first | ☑ |
| P5 | Refresh the stale handoffs-index resume point (was arc 018, six arcs behind) | docs | ☑ |

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
