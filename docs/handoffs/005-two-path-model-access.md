---
title: "Handoff 005 — resume: build the approved two-path model-access plan (#37)"
type: handoff
updated: 2026-07-06
---

# Handoff — build #37 (plan 005 is approved, 0% built)

**Status:** everything through the incorporate card is **shipped + live**; the next unit is the
**approved** #37 build. This is the resume point.

## Read first (in order)
1. `docs/plans/005-two-path-model-access.md` — the full approved plan **with a source/file/code map**
   (signatures, plug points, reuse pointers). Everything you need so you don't re-gather context.
2. `AGENTS.md` — operating rules. `docs/plans/004-post-mvp-priorities.md` — prior roadmap.

## What #37 is (one line)
Two-path model access on a shared foundation: **(A) browser-BYOK** (user's key → provider directly,
never touches the Worker; reuse agenthud `liveAgent.ts`) + **(B) keyless Worker free-chain**
(Cloudflare Workers AI → OpenRouter `:free` → GitHub Models[last, EOL 2026-07-30] → stub). Plus a shared
prompt-injection guard, per-IP rate-limiting, and real **Arize** tracing on every path (closes #21).

## How to handle it (workflow)
- **Enter plan mode was already done → plan approved.** Build it as **4 sequential PRs**, one at a time,
  **check in between each** (do NOT do a mega-PR):
  1. `shared/` foundation (prompt/tool/`isSelfContainedBatch`/`detectInjection`) + Worker rate-limit + guard.
  2. Worker keyless free-chain (`providers.ts`, `[ai]` binding) + per-provider spans.
  3. Real Arize OTLP export (`trace/arize.ts`) + `POST /trace` forwarder — **closes #21**.
  4. Browser-BYOK (`ui/src/agent/liveAgent.ts`, add `ai`+`@ai-sdk/openai`) + client throttle + browser spans→`/trace`.
- **Strict TDD** (tests first for the load-bearing modules: `guard`, `providers`, `trace`, `streamPartToEvent`).
  **Only module tests** — no tests for glue/config. **Assume strict lint/typing/sec always.**
- Branch per PR → Conventional Commit → CI-gated PR → **squash-merge on green** → prune remote+local.
- Verify each with the patchright harness (uv-run, Chromium cached) + `wrangler tail`, per plan §Verification.

## Watch out (spikes + traps)
- **Spike 1 (PR-2):** does Cloudflare Workers AI (`@cf/zai-org/glm-4.7-flash`) actually return a valid forced
  `render_ui` batch? If not, lean on `:free` — adjust the default model, don't block. Use a **ChatCompletions-typed**
  CF model (glm/kimi/gemma/gpt-oss); AVOID the `tool_choice`-less llamas.
- **Spike 2 (PR-3):** Arize's OTLP endpoint may need **protobuf**, not JSON (#21's open question).
- **Keep existing tests green:** build `providers[]` only from present bindings/secrets so `run.test.ts`/
  `model.test.ts` (no `AI`/limiter/token in their env) still hit the **stub** with zero network; keep the keyed
  provider name `openrouter` so the `demo=1` span assertion holds.
- **`shared/` must be dependency-free** (the Worker has no zod). Plain TS only.
- ldnmxx's `contract.ts` has **no `dataModelUpdate`** (stricter than agenthud) → strip it from any ported prompt.
- Browser-BYOK is **founders-only** (`on-it` stays canned on the Worker). It renders the model's raw grants —
  no staged events / no incorporate card on that path (documented tradeoff; fast-follow to add).
- **`docs/submission.md` is PARKED** — do not edit.
- Identity: GitHub noreply, `--no-gpg-sign`, prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`. Secrets are
  Worker-only. Bash denies `grep|ls|head|tail|cat|find|curl` — use Read/Glob + `git`.

## Current live state (as of 2026-07-06)
- `main` deployed. Shipped this session: #31 theme · #32 doc-truth · #33 (#28 usecase-JSON interpreter,
  `runUsecase`) · #34 diagram fix · #35 incorporate card · #36 link styling. **Worker deployed**
  (`wrangler deploy`; authed CF acct `d05213d6`) → live SPA `qte77.github.io/ldnmxx-hack` serves it all.
- Issues: **#29 CLOSED** (AI Gateway dropped as moot). **#37 OPEN** (this plan). **#21 open** → closed by PR-3.
  **agenthud #187 open** → update with findings after the build. `ui/.env` (gitignored) has a valid BYOK key
  for verification.

## Open decisions for the next session
None blocking — the plan + scope are approved (all 4 pieces). Just build PR-1 → check in → continue.
