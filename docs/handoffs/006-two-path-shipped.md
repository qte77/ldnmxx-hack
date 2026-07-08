---
title: "Handoff 006 — #37 two-path model access shipped + partially live-verified"
type: handoff
updated: 2026-07-08
---

# Handoff 006 — #37 shipped; finish the two live spikes, then pick the next roadmap item

**Status:** Plan 005 / issue **#37** is **fully shipped**; **#21** and **#37** are closed. This is the
resume point (supersedes handoff 005).

## What shipped (all merged to `main`)

- **#42** — dependency-free repo-root `shared/` (prompt/tool/validator) + prompt-injection guard
  (flagged → deterministic stub) + per-IP rate-limit (`429`) on `/run`.
- **#43** — keyless free-fallback chain (Workers AI → OpenRouter `:free` → GitHub Models → stub) +
  `model:<provider>` spans; keyed path = a BYOK header only (`OPENROUTER_KEY` feeds `:free`, no spend).
- **#44** — real Arize **OTLP** export (`worker/src/trace/arize.ts`) + `POST /trace` forwarder (**closed #21**).
- **#45** — browser-BYOK founders path (`ui/src/agent/liveAgent.ts`) reusing `shared/` (**closed #37**).
- **#46** (follow-up) — OpenRouter `:free` walks a fallback **list** of 6 verified free+tools models;
  each miss logged for `wrangler tail`, the winning model id rides into the render span. Override via
  `OPENROUTER_FREE_MODELS` (csv).
- **#47** (follow-up) — incorporate how-to-pack moved to `shared/incorporate.ts`; the browser-BYOK
  render now appends the SAME verified card as the Worker.

## Live verification (2026-07-08, against real keys in the gitignored `.env` / `.dev.vars`)

- ✅ **Render mechanism VERIFIED** — `anthropic/claude-haiku-4.5` via OpenRouter, driven by the real
  shared `FOUNDERS_SYSTEM` + `RENDER_UI_TOOL`, returns a self-contained `render_ui` batch. Proves the
  model→A2UI→contract pipeline, Path A (browser-BYOK), and the keyed OpenRouter path.
- ✅ **OpenRouter `:free` default valid** — `llama-3.3-70b:free` is live + free + tool-capable; the
  earlier failure was a transient `429`, now mitigated by the #46 fallback list.
- ✅ **Arize OTLP JSON accepted** — Arize added OTLP/HTTP **JSON** support (Mar 2026); the JSON exporter
  is correct, no protobuf migration needed.
- ❌ **Workers AI glm (Spike 1) — still unverified.** `worker/.env` `CLOUDFLARE_API_TOKEN` returns `401`
  on `/ai/run`: the token is **missing the Workers AI Read permission** (distinct from "Workers Scripts"
  / deploy). Add **Account · Workers AI · Read** to the token, re-copy into `worker/.env`, then re-verify.
- ⛔ **Arize `space_id` — still missing.** The OTLP export needs `ARIZE_SPACE_ID` **and** the key. Read it
  from **app.arize.com → Space Settings** (next to the API key); it is NOT practically creatable via
  REST/CLI for us (that needs an org-scoped *User Key*; our `ARIZE_API_KEY` is space-scoped). Put it in
  `worker/.dev.vars`, then re-verify.

## To finish verification

1. Add **Account · Workers AI · Read** to the CF token (`worker/.env`); add **`ARIZE_SPACE_ID`**
   (`worker/.dev.vars`, from Arize Space Settings).
2. Re-verify each spike by calling the provider directly with the real shared `FOUNDERS_SYSTEM` +
   `RENDER_UI_TOOL` and checking `isSelfContainedBatch` on the returned batch. Pattern: a small node
   harness that loads the keys from `.env`/`.dev.vars` and **never prints them** (rebuild in scratchpad):
   - **OpenRouter `:free`** — `POST openrouter.ai/api/v1/chat/completions`.
   - **Workers AI** — `POST api.cloudflare.com/client/v4/accounts/<id>/ai/run/<model>` (batch under `.result`).
   - **Arize OTLP** — `POST otlp.arize.com/v1/traces`, JSON body, headers `space_id` + `api_key`.
3. Or `wrangler dev` + `wrangler tail`: a keyless founders Run shows a `model:workers-ai` span; a BYOK
   Run shows a `POST /trace` and **no** `/run`. Confirms the `[ai]` + `[[ratelimits]]` bindings resolve.

## Still open / follow-ups

- **agenthud #187** — update with the two-tier free-chain findings (per plan 005 follow-ups).
- Once the CF token has Workers AI Read, confirm which CF ChatCompletions model honours forced
  `tool_choice` (glm may not); `WORKERS_AI_MODEL` overrides — kimi / gemma / gpt-oss are alternates.

## Next roadmap (unstarted)

Phase 2 model pipeline (**#18**) · Phase 3 voice loop (**#4**) · Phase 4 polish / spend-cap (**#5**) ·
deferred set (**#6–#13**).

## Conventions (unchanged)

Plan mode before implementing · strict TDD (module tests only) · lint + security gate. Branch per topic →
Conventional Commit → CI-gated PR → **squash-on-green** → prune. Identity: GitHub noreply,
`--no-gpg-sign`, prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`. Secrets are `.env`/`.dev.vars`
only (gitignored). `docs/submission.md` is PARKED.
