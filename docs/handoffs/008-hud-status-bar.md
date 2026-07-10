---
title: "Handoff 008 — PR-3: HUD status bar (Demo⇄Live + mode/model + cost) — approved, build it"
type: handoff
updated: 2026-07-10
---

# Handoff 008 — build PR-3: the HUD status bar (make demo vs live honest)

**Status:** Plan **[`docs/plans/008-hud-status-bar.md`](../plans/008-hud-status-bar.md)** is **approved,
0% built**. This is **plan 007's PR-3**, reshaped from "a cost chip" into a HUD status bar + Demo/Live
toggle. The living phase-2 resume doc is still
[`007-phase2-model-pipeline.md`](007-phase2-model-pipeline.md) (tick its Progress when this merges); **008
is the detailed PR-3 plan** with a full source map — trust it, don't re-explore.

## Why (one paragraph)

The model path now runs live (after the `ai.run` bind fix, **#62**), so the deterministic **stub** and the
**live agent** produce different output — but a viewer can't tell which they're seeing, and can't choose:
the documented `?demo=1` switch is **unreachable from the browser** (`App.tsx:74` never forwards `demo`).
PR-3 adds a **Demo⇄Live toggle** + an **honest 3-state chip** (`LIVE · <model> · ~N tok` / `DEMO ·
deterministic` / `STUB · fell back`). The "agents decide, restricted to the corpus" contract is already
live — this is purely the transparency/control layer.

## How to build it (order)

1. **Worker `USAGE` event first (TDD):** `renderBatch` → return `{batch, meta}`; `runUsecase` accumulates
   token usage (stages + render) and emits ONE terminal `USAGE {mode, model?, provider?, ...tokens}` between
   the render write and `RUN_FINISHED`; `resolveRun` adds `demo` to `runAttrs`. Test in
   `worker/test/run.test.ts` (live → `mode:"live"`+model+tokens; `demo=1` → `mode:"demo"`,0; model-fail →
   `mode:"stub"`).
2. **UI wiring:** `App.tsx` Demo⇄Live toggle (copy the usecase-toggle pattern) + pass `demo` into `run(...)`
   at `:74`; `useAgentSSE` intercepts `USAGE` in `dispatch` (like `RUN_ERROR`) → `status` state via a pure
   `toStatus(event)`; return `status`. Test `parseSSE`+`toStatus` in `ui/tests/useAgentSSE.test.ts`
   (**node env, no jsdom** — no React render tests).
3. **Chip:** render in the aside header (`App.tsx:182-184`) reading `status`.

**Invariant:** `USAGE` emitted once, terminal; honest 3-state — never show "LIVE" when the model fell back.

## First action

Write the failing `worker/test/run.test.ts` `USAGE`-frame assertions (reuse `parseFrames` + the
`stageAwareAi` fake), then implement the `renderBatch`→`{batch,meta}` + `runUsecase` emit. `make test` +
`tsc --noEmit` green → UI. Full file:line source map is in plan 008.

## Recurring checklist (pre-answered in plan 008)
CHANGELOG · README `Switches` (fix `?demo=1` — now a UI toggle) · `architecture.md` (USAGE event) ·
`UserStory.md` (mode-transparency story) · no new env/url/cli · open a "Demo/Live toggle" issue (or note in
#18) + a 1-liner for the invalid `OPENROUTER_KEY` (401). Lands under **#18**.

## Blocking / ordering (do these first for the LIVE re-verify)
- **Merge #62** (bind fix — green, OPEN) then **`make deploy`** so "Live" actually streams reasoning. PR-3's
  *code* doesn't depend on #62, but the live verification does.
- **Rotate `OPENROUTER_KEY`** (currently 401 — a capped `:free` key; the `!`-piped `wrangler secret put`
  one-liner is in the session log). Harmless meanwhile (Workers AI is tier 1).
- Branch PR-3 off `main` after #62 lands (else off `main` + rebase).

## Conventions (unchanged)
Plan mode before implementing · strict TDD (module tests only — not glue; ui tests are node-env pure fns) ·
lint + CodeQL gate. Branch per topic → Conventional Commit → CI-gated PR → **squash-on-green** (the
auto-mode classifier blocks agent self-`--admin`; surface the green PR for the user to merge) → prune.
Identity: GitHub noreply, `--no-gpg-sign`, `env -u GH_TOKEN -u GITHUB_TOKEN`. Repo Actions policy =
`allowed_actions=selected` + `sha_pinning_required`: SHA-pin **every** action (incl. transitive composite
deps) + allowlist non-github actions, or CI startup-fails at 0s. `docs/submission.md` PARKED.
