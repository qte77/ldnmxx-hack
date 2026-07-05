---
title: "Handoff 004 — start here: post-MVP priorities (doc-truth → usecases/*.json → flagship depth)"
type: handoff
updated: 2026-07-04
---

# Handoff — next session starts here

**Status:** Phase 1 is **done and LIVE** — SPA <https://qte77.github.io/ldnmxx-hack/> → deployed Worker
(`POST /run?usecase=<id>` → AG-UI SSE → A2UI cards); **Track B renders real OpenRouter model output**,
Track A + auto-run use a deterministic stub, keys are set, CF observability is on. Supersedes handoff 003.
Your job: pick up **plan `003-post-mvp-priorities.md`** (the ticket).

## Read first (don't re-gather context)
1. **`docs/plans/003-post-mvp-priorities.md`** — the plan **+ a full code/file/source map + env gotchas +
   the doc-truth audit**. Everything you need to act without re-mapping the repo.
2. `docs/handoffs/003-phase1-done.md` — what Phase 1 built (now partly superseded; note its "no model call"
   line is stale). `docs/usecase-workflows.md` — the `usecases/*.json` stage-def schema for Tier 1.

## How to handle the plan
- **Plan mode:** Tier 0 (docs) is low-risk → proceed **direct**. Tiers 1–2 are load-bearing code
  (`usecases/*.json` interpreter, new render/reasoning stages) → **enter plan mode first** (AGENTS.md:
  *plan mode before implementing*), get the approach approved, then **strict TDD** for the modules.
- **Order:** **Tier 0 first** (doc-truth — the deck/READMEs are what judges read; ~1–2h, zero risk). Then
  **Tier 1** = externalize `usecases/*.json` (makes the "swap a JSON, swap the app" pitch literally true —
  the single highest-leverage item). Then Tier 2 (incorporate pack → AI Gateway config → model reasoning).
  Tier 3 is post-hackathon — leave the issues tracked, don't touch.
- **Doc-truth head start:** `env -u GH_TOKEN -u GITHUB_TOKEN gh pr diff 23` (closed) already corrects the
  `usecases/*.json`/UsecaseInspector/KV/AI-Gateway claims — recover + layer with PRs #24/#25.

## Watch out (traps)
- **`docs/submission.md` is PARKED** — the user rewrote it and re-added the aspirational claims; **do not
  edit it** without their explicit go-ahead.
- **Time-bound keys:** `OPENROUTER_KEY`/`ARIZE_API_KEY` (Worker secrets + `worker/.dev.vars`) **expire
  2026-07-04**. If the real model 404s/fails, re-set them; behavior falls back to the stub, never blank.
- **The "swap a JSON" pitch is currently hardcoded TS** (`worker/src/worker.ts` `USECASES` Set +
  `preRenderStages`/`renderBatch`). No `usecases/*.json` files exist — that's Tier 1.
- **Env quirks:** `npx`→`npm run` (use `./node_modules/.bin/`); bash denies `grep/ls/head/tail/cat/curl`;
  prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`, commit `--no-gpg-sign`, noreply identity.
- **Arize is console/CF-only** (no dashboard export — issue #21); the standard Node OTel SDK does **not**
  run on the Worker.

## Deliver
- Branch per topic → CI-gated PR (docs/security/ui/worker + CodeFactor) → **squash**-merge → delete branch.
- Worker: `cd worker && ./node_modules/.bin/wrangler deploy` (ambient `CLOUDFLARE_API_TOKEN`). UI: gh-pages
  CI on push→main. **Verify live** with patchright (`/workspaces/qte77/polyfetch-scrape/.venv/bin/python`).
- **Issue hygiene:** close #3 (fold into #18); open issues for Tier 1 (`usecases/*.json`) + AI Gateway/KV
  (wire or drop from the pitch) + doc-truth.
