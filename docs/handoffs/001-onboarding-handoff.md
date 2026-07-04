---
title: "Handoff 001 — ldnmxx-hack onboarding (scaffold + docs done; build not started)"
type: handoff
updated: 2026-07-04
---

# Handoff — onboarding the next session

**Status:** repo scaffolded (root + `docs/` + source-dir stubs). **No app code yet.** This is the resume point.

## Read first (5 min, in order)

1. `docs/plans/001-build-plan.md` — **the source/file/code map** (reuse paths, versions, API sigs, pitfalls,
   scaffold, phases). Everything you need so you don't re-gather context.
2. `docs/architecture.md` — one core / 3 seams · data flow · SoC · stack.
3. `docs/usecase-workflows.md` — the two `usecases/*.json` workflows (Track B one-click journey, Track A thin).
4. `docs/submission.md` — the pitch/deck (what we're demoing) and the open track decision.

## What this is

A modular AG-UI/A2UI agent on a Cloudflare Worker (Londonmaxxing 003). One `POST /run?usecase=<id>` +
`runStages`; swap a JSON → swap the app. **Track B** = one-click founder copilot (assess stage → grants →
who to talk to → incorporate). **Track A** = voice → step-free TfL route. Render = **built-in A2UI cards**.

## How to handle it (the workflow)

- **Enter plan mode before implementing** → **strict TDD** (write the module test first) → **lint + sec** gate.
- Test **modules only** (`useAgentSSE`, worker `/run`, `runStages`, ingest parsers) — never glue/scaffold or
  one-shot scripts.
- Branch per topic → Conventional Commits → CI-gated PR → prune. Identity: **noreply**, `--no-gpg-sign`,
  prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`. Secrets are **Worker secrets only**.

## Start here — Phase 1 (get E2E green, keyless)

Scaffold from `/workspaces/qte77/agenthud-agui-a2ui/` (copy the REUSE files verbatim), then write the **~8
Phase-1 files** (plan §"Phase-1 start-here subset"): `useAgentSSE.ts` (+test), worker `/run` **echo**
(+test), `a2ui/cards.ts`. Green = SPA → `/run` SSE → opportunity cards render on the A2UI surface.
Verify with `wrangler dev` + curl, then a browser (cards render; a bad batch shows a HUD error, not blank).

## Reuse (don't rebuild) — exact paths in plan §"Source map"

- `qte77/agenthud-agui-a2ui/` (SPA + worker base) · `qte77/polyfetch-scrape/` (fetcher v0.4.0) ·
  `sfsanity/_audit-docs/ingest/sfclarity_ingest/` (ingest patterns) · sibling `qte77/ldnmxx/docs/` (deep context).

## Watch out (locked decisions + traps)

- **AG Grid deferred** → built-in cards (don't add ag-grid). **A2UI/AG-UI are NOT sponsors.**
- A2UI v0_8: **self-contained batch**, `root` id exists, `Card.child` singular, typed literals, avoid `List`
  (use `Column`), **`Button.onAction` is unwired** (wire the incorporate CTA). context7's A2UI docs are the
  *wrong* version — trust the installed `v0_8/index.d.ts`.
- `incorporate` = Companies House **name-check + pre-filled pack + mocked "file"**, NOT a live filing.
- Worker tests = plain-vitest `worker.fetch()` (not miniflare). No Docker/devcontainer.
- **This repo is the SSOT** — treat sibling `qte77/ldnmxx` as archival reference only.
- `incorporate` = a **verified how-to pack** (real curated gov.uk links), not a mock filing.
- UX bible = `docs/design.md` (EyeRest, dark-first + BluBlock, motion). Demo north star = `docs/demo-script.md`.

## Open decisions (surface to the user)

Project/builder name · **primary track** (rec: Live London) · confirm the Track-A ask is on the "What
Londoners are asking for" list · add a `LICENSE` file (Apache-2.0). Confirm the `qte77/ldnmxx-hack` remote
before any push.
