---
title: "Handoff 002 — start here: build the Phase-1 first E2E"
type: handoff
updated: 2026-07-04
---

# Handoff — next session starts here

**Status:** repo scaffolded + docs complete (this repo is the **SSOT**). **No app code yet.** Your job:
build the **first end-to-end** (SPA → `/run` SSE → cards + Arize spans). This handoff is the resume point.

## Read first (in order — don't re-gather context)
1. **`docs/plans/002-phase1-first-e2e.md`** — YOUR ticket: happy path · TDD task list · Arize spans · definition of done.
2. `docs/plans/001-build-plan.md` — the full **code/file/source map** (exact reuse paths, pinned versions,
   A2UI pitfalls). Reference, not a re-read.
3. `docs/architecture.md` · `docs/usecase-workflows.md` · `docs/design.md` · `docs/demo-script.md` — as needed.

## How to handle plan 002
- Plan mode is satisfied (002 is approved) → go straight to **strict TDD**, in task order: 🧪`useAgentSSE`
  test → impl → 🧪`arize`/`run` worker tests → impl emitter + `/run` stub `runStages` (emits SSE **and** a
  span per stage) + `a2ui/cards.ts` → wire `App` → **verify**.
- **Reuse agenthud verbatim** (`A2UISurface`, `applyA2UIEvent`, `contract`, `DashboardShell`, `EventStream`).
  **Built-in A2UI cards only** (no AG Grid). **Console Arize emitter from run #1** (keyless, `wrangler tail`).
- **Delivery:** branch `feat/phase1-foundation` → commit by topic → CI-gated PR on `qte77/ldnmxx-hack`.
  Identity: noreply, `--no-gpg-sign`, prefix git/gh `env -u GH_TOKEN -u GITHUB_TOKEN`. Confirm the remote first.
- **Done when:** SPA → `/run` SSE → opportunity cards render **+ a span per stage in `wrangler tail`**; a bad
  batch shows a HUD error (never-silent-blank); `npm test` (ui + worker) + CI green.

## Watch out (traps)
- **A2UI v0_8** is the truth (installed `index.d.ts`) — context7's A2UI docs are the *wrong* version. Batch must
  be **self-contained** (root id exists, `Card.child` singular, typed literals, acyclic). Avoid `List` → use `Column`.
- `AgentEvent = {type:string; text?:string; a2uiMessages?:unknown[]}`; enum incl. `RUN_FINISHED`/`RUN_ERROR`.
- **No new deps** (no ag-grid, no msw). Worker tests = plain-vitest `worker.fetch(req, env)` (not miniflare).
- This repo is the **SSOT**; sibling `qte77/ldnmxx` is archival reference only.

## After Phase 1
Phase 2 (**cut**) = Track B trio (`assess_stage` + `search_opportunities` over `data/demo/` + `incorporate`
verified pack) + the `model:openrouter` span → HUD cost chip. Track A = **pre-recorded** `on-it.json`
(STT→postcode→path→TTS). See `plans/001` phases + `demo-script.md`.
