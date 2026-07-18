---
title: "ADR 0001 — a general workflow engine (registry + per-workflow contracts + pre-generated corpora)"
status: accepted
date: 2026-07-18
---

# ADR 0001 — General workflow engine

## Status

Accepted (2026-07-18). First applied by **Sort My Care** (#72, plan 012).

## Context

The Worker began with two hard-coded workflows (`founders-copilot`, `on-it`) whose render + query paths
were `if (mode === …)` branches inside `runUsecase`/`renderBatch`. The product direction is many small,
mostly-deterministic civic workflows (Care → Wander → Scam → …), each a postcode/query over a corpus. If
each new workflow keeps editing the engine's core loop, the engine stops being general and every addition
risks the shared path.

## Decision

1. **Open/closed via a registry.** `worker/src/workflows.ts` holds two dispatch tables: `render` (mode →
   card builder) and `query` (deterministic `exec` → corpus query). `runUsecase`/`renderBatch` dispatch by
   lookup. **Adding a corpus workflow is: register a render fn + a query fn + a `usecases/*.json` — the
   engine core never changes.** `founders` is the one model-backed mode (its registry entry is the
   deterministic stub; the live model render layers on top in `renderBatch`).

2. **Deterministic query stages run regardless of model providers.** A `query` exec (e.g.
   `fetch_care_services`) computes render data over the bundled corpus even when no model provider is
   configured. Model execs (`assess_stage`, `search_opportunities`) stay on the provider chain and fall
   back to canned events. Deterministic workflows report `USAGE mode:demo` — honest, not a degraded `stub`.

3. **Each workflow owns its contract, kept LOCAL.** Care's payload contract lives in `worker/src/care/
   contract.ts`, not a shared package. The only cross-engine contract is the stage **envelope**
   (`workflow-definition/v1`, `qte77/protocols`: `id` + ordered `stages[].name`); per-workflow payloads are
   YAGNI to generalise (one contract today).

4. **Data is pre-generated JSON now → CF D1 later; NO live external fetch at request time.** Corpora ship
   as synthetic `data/<workflow>/*.json` (Care is model-free **and** fetch-free — no SSRF surface). Real
   ingest + CF D1 (#13, cron #10) are follow-ups. Corpus **freshness** (`lastUpdated`) is surfaced in the
   render so staleness is honest at the point of use.

5. **"Wayfinder" is a UX pattern, not the engine.** The engine is general; a workflow signposts to official
   services (never adjudicates/triages), enforced by a curated disclaimer card.

## Consequences

- **+** New corpus workflows (Wander #73, Scam #74) are additive: register + JSON + corpus + tests. No
  core-loop edits, so regressions to `founders`/`route` are structurally unlikely (and test-guarded).
- **+** The security boundary is one small module per input type (`shared/sanitize.ts` for postcodes).
- **−** Two sources of truth for the mode/exec sets (the `RENDER_MODES`/`STAGE_EXECS` guard constants in
  `usecases.ts` and the registry keys). Drift is caught by the contract + integration tests, not the type
  system — accepted for KISS over coupling `usecases.ts` to the registry.
- **−** Synthetic corpora can mislead if presented as live; mitigated by the freshness line + disclaimer +
  catalog `risk` notes, and gated behind "real ingest is a follow-up".
