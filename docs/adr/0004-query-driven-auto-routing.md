---
title: "ADR 0004 — query-driven auto-routing: one input, hybrid heuristic-first classifier"
status: proposed
date: 2026-07-23
---

# ADR 0004 — Query-driven auto-routing

## Status

Proposed (2026-07-23), to be accepted with **plan 017 · P2/P3**. Supersedes the manual
usecase-switcher UX shipped through plan 015/016.

## Context

Until now the user **picked** a workflow (a switcher in `ui/src/App.tsx`, or `?usecase=<id>`), and
the Worker resolved it at exactly one place — `worker/src/worker.ts:438-445`
(`getUsecase(url.searchParams.get("usecase"))`). Everything downstream keys off the resolved `def`,
never the raw string.

The owner's product direction: the user should type **one free-text ask** ("food hygiene near SE1",
"is Acme Ltd real", "step-free to Westminster") and the app decides and builds the workflow. That
forces three questions: where routing happens, how it decides, and what happens when it cannot.

## Decision

### 1. Route at the existing resolution point; the interpreter stays closed

The router runs in `fetch()` **immediately before** `getUsecase` and produces an id that flows into
the *same* unchanged lookup. `runUsecase`/`playStage`/`renderBatch` and the `workflows.ts` registry
are untouched — consistent with the repo's register-only precedent.

**Required refactor:** the classifier needs `prompt`, but the POST body is read inside `resolveRun`
*after* resolution (`worker.ts:168-178`, called at `:448`), and a body can only be read once. The
body-read moves earlier in `fetch()`; the parsed `{prompt, model}` is threaded into both the router
and `resolveRun`.

### 2. Hybrid, heuristic-first

`classifyHeuristic` (pure) runs first: `normalisePostcode` (`shared/sanitize.ts`) plus keyword sets
→ care / wander / food-hygiene / route / scam. It is free, zero-latency and works with **no model
at all** (keyless-first). Only when it is ambiguous (zero or multiple hits) do we escalate to a
one-shot model classifier (ADR 0003's pattern). User text is gated through `detectInjection`
(`shared/guard.ts`) before any model call.

### 3. No silent default — an honest no-match

If neither tier is confident the router returns **`id: null`**, and the Worker renders a
deterministic *"I didn't understand that — here's what I can help with"* card listing suggestions
and the available use cases. We deliberately do **not** fall back to the flagship: silently running
the wrong workflow is worse than admitting the miss. `founders-copilot` appears in that offered list
but is never auto-routed (it is an engine demo, `civic: false`).

### 4. `?usecase=` stays as an explicit bypass

An explicit param skips the router entirely, so deep links and the founders demo keep working.

### 5. The client learns the choice

The Worker emits `USECASE_RESOLVED{usecase,title}` before `RUN_STARTED` — additive to the existing
event contract (`applyA2UIEvent` already tolerates unknown types). The UI updates its active
workflow from it and **announces it in an aria-live region** so the routing decision is not
sighted-only.

## Consequences

**Plus.** One input replaces a switcher; the engine and its registry are untouched; the heuristic
keeps the app fully functional with zero model providers; the no-match card doubles as workflow
discovery; deep links keep working.

**Minus / known limits.**

- `sort-my-route`'s render is canned (`workflows.ts:37`, no `exec` in its usecase JSON), so routing
  to it is safe but it still does **not** parse the user's origin/destination. Pre-existing; the
  router does not make it worse and does not fix it.
- Routing can be wrong in the ambiguous middle; the no-match card and the `?usecase=` bypass are the
  escape hatches. An Arize span per route records `{routed_to, source}` so misroutes are observable.
- One real refactor of `worker.ts`'s `fetch()` (the body-read ordering) — mechanical but load-bearing,
  covered by integration tests.
