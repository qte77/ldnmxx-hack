---
title: "Handoff 003 — start here: Phase 1 done, Phase 2 next"
type: handoff
updated: 2026-07-04
---

> **Superseded** by [`docs/handoffs/004-post-mvp-priorities.md`](004-post-mvp-priorities.md) — resume
> there, not here.

# Handoff — next session starts here

**Status:** Phase 1 first E2E is **built and green** on branch `feat/phase1-foundation` (supersedes
handoff 002 as the resume point). SPA → `POST /run?usecase=<id>` (SSE) → built-in **A2UI cards** render,
with **one console Arize span per stage** in `wrangler tail`. Two workflows ship behind a UI toggle.

## What's built

- **`ui/`** (Vite/React SPA, `groundwork-ui`): live-only shell (`App.tsx`) with a **usecase toggle**
  (Founder's Copilot / On It), an optional **BYOK** field, prompt + Run. Transport =
  `src/agent/useAgentSSE.ts` (pure `parseSSE` + `fetch`/`ReadableStream`/`AbortController` hook) driving
  the reused `applyA2UIEvent` + `contract.ts` render/validate seam. Reused **verbatim** from
  `qte77/agenthud-agui-a2ui`: `A2UISurface`, `applyA2UIEvent`, `contract`, `EventStream`, `index.css`
  theme. **Dropped** (KISS/YAGNI): replay engine, mode toggle, BYOK/AI-SDK, DashboardShell chrome.
- **`worker/`** (`groundwork-worker`, `wrangler.toml`): one `/run` handler + CORS (+OPTIONS) + SSE
  `ReadableStream`; inline **stub `runStages`** per usecase (`founders-copilot`: plan → search_opportunities
  → render opp cards; `on-it`: plan → lookup_postcode → get_tfl_journey → render route cards). Emits both
  the SSE event **and** `emitter.span(...)` per stage. `src/trace/arize.ts` = injectable emitter (console
  default; real Arize adapter gated on `ARIZE_API_KEY`, stubbed). `src/a2ui/cards.ts` = one `cardsBatch`
  builder for both workflows, from `data/demo/{opportunities,route}.sample.json` (SSOT).
- **Tests:** `ui` 7 (SSE parser + enum mapping + malformed-frame + contract fixture + never-silent-blank);
  `worker` 6 (both usecases' self-contained batch + `RUN_FINISHED`, 4xx/405/204 guards, span-per-stage).
  Both green. UI: typecheck + strict eslint + build all clean. `wrangler dev` boots + serves.
- **CI/CD:** `ci.yml` gains `ui` (lint/typecheck/test/build) + `worker` (typecheck/test) jobs;
  `gh-pages.yml` builds `ui/` (base `/ldnmxx-hack/`) → Pages. `Makefile`: `dev`/`test`/`deploy` wired.

## Decisions locked (this session)

1. **Both workflows ship** (`founders-copilot` primary + thin `on-it`) via a UI toggle — the modularity
   proof. Same engine, different usecase JSON.
2. **Pages demo = live deployed Worker** (not a baked replay): one source of truth, no playback layer.
3. **BYOK = optional dashboard field**, runtime/in-memory only, forwarded to the Worker; our model key
   stays a **Worker secret** (keyless default). Nothing sensitive in the SPA bundle — coherent with
   `AGENTS.md`. Phase-1 stub makes no model call.
4. **Arize console span per stage kept** (screenshot-legible `⌁ span …` for the README).
5. **Minimal single-mode shell** written instead of reusing agenthud's dual-mode `DashboardShell`.

## Run it / preview

- Local: `make dev` (worker :8787 + ui :5173, Vite proxies `/run`). `make test`. Spans:
  `cd worker && npm run tail`.
- **Needs you (out-of-band):** (1) Settings ▸ Pages ▸ Source = **GitHub Actions**; (2) `make deploy`
  (Cloudflare auth) then bake the real `workers.dev` subdomain into `ui/src/config.ts` `WORKER_BASE`.

## Phase 2 next

Real model call (OpenRouter via AI Gateway, Worker secret or BYOK override) → child **`model:openrouter`
span `{model, tokens, costUSD}`** → HUD **cost chip**. Replace the stub with the real `runStages` over
`usecases/*.json` (`stages/` + `adapters/`), `search_opportunities` over seeded KV `data/`, the
`incorporate` verified pack. Real Arize/OpenInference exporter behind `ARIZE_API_KEY`. Capture the
Arize/cards **screenshots + GIF** into `docs/assets/` for the README. See `plans/001` + `demo-script.md`.
