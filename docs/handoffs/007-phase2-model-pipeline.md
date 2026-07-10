---
title: "Handoff 007 — Phase 2 model-driven pipeline (#18) + usecase expansion — approved, build it"
type: handoff
updated: 2026-07-09
---

# Handoff 007 — build Phase 2 (#18): make the early stages actually reason

**Status:** Plan **[`docs/plans/007-phase2-model-pipeline.md`](../plans/007-phase2-model-pipeline.md)** is
**approved; PR-1 of 5 shipped**. This is the resume point (supersedes handoff 006 — #37 shipped there).
Build the rest as phased, strict-TDD PRs. The plan carries a full **Source map** (exact files, signatures,
line numbers) — trust it; do **not** re-explore the codebase.

## Progress — update this after each PR merges (this is a LIVING handoff)

This one handoff tracks the whole plan; **after each PR squash-merges, tick it and set the next PR** so a
resuming session reads current state (don't re-derive from git). Write the *shipped* handoff **008** only
when all five are done.

| PR | What | State |
|----|------|-------|
| PR-1 | generic `callModelTool`/`extractToolArgs` + `shared/{assess,search}Tool.ts` (schemas + validators) | [x] merged |
| PR-2 | free-chain generalization (`runChain`/`tryCall`) + per-stage dispatch (`StageDef.exec`, reasoning + LLM span, thread matches → render) | [x] merged |
| PR-3 | **HUD status bar** — Demo⇄Live toggle + mode/model + cost chip (`USAGE` event). *Reshaped from "cost chip"; detailed plan+handoff: **008*** | [x] merged |
| PR-4 | Arize live + notes (#50 / `AGENT_LEARNINGS.md`) — **closes #18** | [ ] **next** |
| PR-5 | capstone: corpus-agnostic `match` render + 3 new usecases | [ ] |

**Current position:** PR-1 + PR-2 + PR-3 merged — the free chain is generic (`runChain`/`tryCall`), the
founder workflow's plan + search stages run live model tools (`assess_stage` / `search_opportunities`)
streaming reasoning + a `model:<exec>` LLM span each (matches threaded into the render; any miss → canned),
and the HUD now emits a terminal `USAGE` event → an honest Demo⇄Live chip (plan/handoff **008**). → start
**PR-4** = Arize live resolution + notes (#50 / `AGENT_LEARNINGS.md`), which **closes #18**.

> **PR-2 verified live (2026-07-10) + a bug fixed.** Driving the *deployed* worker (`wrangler tail` +
> polyfetch) proved the streamed reasoning works — but only after fixing a `this`-binding bug: `ai.run` was
> called detached, so Workers AI had **silently stubbed since #37**. Fix is **PR #62** (bind `ai.run` to
> `ai`, + a `this`-dependent regression test) — [x] **merged** (`0d97810`, in `main`). Still open: the
> deployed `OPENROUTER_KEY` returns 401 (dead fallback tier; rotate to a capped `:free` key — harmless with
> Workers AI as tier 1). Run `make deploy` to make Live real on the site.

## The one-paragraph why

Track B today is **theatre + one model call**: `runUsecase` streams three *canned* stages, then makes the
single real model call — the `render_ui` render — over **pre-scored** demo data. #18 makes the two early
stages genuinely model-driven: **`assess_stage`** (classify founder stage + unlock steps) and
**`search_opportunities`** (rank/filter/explain over the corpus), each streaming real reasoning + its own
Arize **LLM** span, plus a **cost chip** in the HUD. Then (capstone) prove "swap a JSON, swap the app" by
adding three more usecases over the now corpus-agnostic pipeline.

## How to handle it — the 5 PRs (branch per PR, squash-on-green, prune between each)

1. **PR-1 — generic tool plumbing** (no behavior change) — ✅ **done**. Extracted `callModelTool` from
   `callRenderModel` + `extractToolArgs` from `extractBatch` (render is now a thin wrapper); added
   `shared/assessTool.ts` + `shared/searchTool.ts` (schema + dependency-free validator each; the search
   validator **rejects invented opportunity ids**). Existing render tests stayed green via the wrappers.
   *(The provider-chain generalization `runChain`/`tryCall` was deferred to PR-2 — see the scope note above.)*
2. **PR-2 — free-chain generalization + per-stage dispatch (the core).** First generalize the chain:
   `runChain(providers, call)` from `renderFree`, and a per-provider generic `tryCall(spec, args)` (keep
   `tryRender`/`renderFree` as render wrappers). Then: `StageDef += exec?`; tag the founders JSON's
   plan/search stages; in the `runUsecase` loop run the tool via the chain when there's a live model and
   not `forceStub`, streaming `reasoning` as one `TEXT_MESSAGE_CONTENT` + emitting a `model:<exec>` span
   (auto-maps to LLM kind). **Any miss → the existing canned events. Never worse than today.** Thread the
   search matches into the render.
3. **PR-3 — cost chip.** New `USAGE` `AgentEvent` with summed tokens; a small chip in the HUD.
4. **PR-4 — Arize live + notes + docs.** No code change — resolve the account-side ingestion credential
   (#50), record the root cause in #50 + `AGENT_LEARNINGS.md`, drop "PLANNED #18" from usecase-workflows.
   **Closes #18.**
5. **PR-5 — capstone: 3 new usecases.** Make the render corpus-agnostic (`RenderDef` gains
   `corpus`/`framing`/`incorporate?`; `founders` render → a generic `match` path), then add
   `benefits-copilot` + `tender-finder` + `support-finder` as JSON + synthetic `data/demo/*.json` drops +
   UI ids. **Watch-out:** Workers bundle JSON at build time → map `corpus` to a static import table, not a
   dynamic path read.

## The invariant (repeat it back to yourself before every PR)

**forced tool → structural validate → `null` → deterministic fallback.** It lives in three places
(`callRenderModel`, provider `toResult`, `renderFree`) and is now generic in `callModelTool` (PR-1). PR-2
applies it per stage where the fallback is the **canned events**, not the stub. A model miss on any stage
silently degrades to today's behavior.

## First action

Start **PR-3** (cost chip). PR-1 + PR-2 shipped the generic plumbing + live per-stage dispatch. Next:
worker emits a `USAGE` `AgentEvent` with summed prompt/completion tokens (reuse `ModelResult.usage` from
each `runChain` win + the render), emitted once; the UI shows a small cost chip in the HUD
(`ui/src/EventStream.tsx` / `App.tsx` — the event vocab already tolerates arbitrary types). TDD-first: a
UI mapping test (USAGE → chip value) + a worker test (usage summed across stages + render, emitted once).
`make test` + `tsc --noEmit` green → PR. See `docs/plans/007` PR-3 for the source map.

## Recurring checklist (pre-answered in the plan — don't re-derive)

CHANGELOG per PR · root README `What`/diagram/`Switches`/pipeline blurb (PR-2 + PR-5) · `architecture.md`
(PR-2) · `UserStory.md` + `usecase-workflows.md` (PR-5) · new `?usecase=` ids documented in README +
`ui/src/App.tsx` · **closes #18**, update **#50** + `AGENT_LEARNINGS.md`. Fast-follows (not this phase):
browser-BYOK multi-stage parity (new note), KV corpus (#13), Track-A live tools (#4/#8).

## Still open / not blocking

- **PR #52** (demo GIF) — left open for the user to **merge non-squash** (their call, not ours).
- **Arize #50** — live ingestion is account-side (verified NOT our code); PR-4 resolves the credential,
  code is already correct.
- Optionally `make deploy` the Worker so the live free-chain / `[ai]` binding path is exercised end-to-end.

## Conventions (unchanged)

Plan mode before implementing · strict TDD (module tests only — not glue/one-shot scripts) · lint +
semgrep gate. Branch per topic → Conventional Commit → CI-gated PR → **squash-on-green** → prune. PR bodies
via `--body-file` (backticks in `--body` shell-substitute). Identity: GitHub noreply, `--no-gpg-sign`,
prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`. Secrets are `.env`/`.dev.vars` only (gitignored);
scraped data ToU-gated (`data/real/` gitignored, only synthetic `data/demo/` committed).
`docs/submission.md` is PARKED.
