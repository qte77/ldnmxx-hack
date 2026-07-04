# Architecture

## One core, three seams

One `POST /run?usecase=<id>` endpoint → a ~60-LOC `runStages` engine (plan → tool → render) → an A2UI
HUD. Flip **Track B ⇄ A** by loading a different `usecases/*.json`:

```text
              ┌─ Track B · founders-copilot.json
   swap JSON ─┤  one toggle, same engine
              └─ Track A · on-it.json
              │
              ▼
User ─▶ UI ─▶ Workflow ─▶ Agent ─▶ Generative UI ──┐
▲       AG-UI runStages   OpenRtr  A2UI + HUD      │
└─────────────── renders back to user ─────────────┘
```

Only three seams change:

| Seam | Track B (Founder's Copilot) | Track A (On It) |
|---|---|---|
| `tools[]` | assess_stage · search_opportunities · find_contacts · incorporate | lookup_postcode · get_tfl_journey |
| `render` | built-in A2UI cards (Column/Card/Text) | RouteCard + lazy OSM `RouteMap` panel (keyless, read-only) |
| `input()` | text | voice (Web Speech STT + text fallback) |

## Data flow — one direction, one trust crossing

```
user input → SPA useAgentSSE ──POST /run?usecase=<id>──▶ Worker  [TRUST BOUNDARY — secrets here]
                                                          runStages: plan → tool → render
                                       ◀── SSE {type,text,a2uiMessages} + RUN_FINISHED ──
   SPA: parse frames → AgentEvent → applyA2UIEvent (validate vs contract.ts) → render seam
        → A2UI surface (built-in Column/Card render)  +  EventStream (live log)

  OFFLINE (out of band): ingest/seed.py → polyfetch → opportunities.json → KV OPPORTUNITIES
```

## Separation of concerns (module boundaries = single seams)

- `contract.ts` = validation · `applyA2UIEvent.ts` = render seam · `useAgentSSE.ts` = transport ·
  `UseCaseAdapter` = use-case seam · `runStages` + injectable emitter = observability.
- **Trust boundary:** SPA holds no secrets; keys are Worker secrets only; Worker is the sole egress;
  the CORS allowlist is the gate. No third-party JS/fonts/tiles (self-hosted).

## Stack

- **UI (Pages):** Vite 8 · React 19 · TS 6 · zod 4 · `@a2ui/react` 0.10.1 (v0_8 API) · `@ag-ui/core`
  0.0.57 · vitest 4 + jsdom.
- **Worker:** Wrangler 4 (compat ≈ 2026-06-24) · raw `fetch` → OpenRouter via CF **AI Gateway** ·
  **KV** (`OPPORTUNITIES`) · injectable **Arize** emitter (console default, key-gated).
- **Ingest:** Python/uv + **polyfetch** (3-tier httpx→curl_cffi→Patchright), one-shot → KV.
- **No Docker, no devcontainer** — serverless; the ingest's Chromium is a CI step, not a shipped image.

## Platform notes

Cloudflare **Workers (NOT Workflows)** + Pages + KV + AI Gateway. Arize tracing via an injectable
emitter (keyless console default). **AG Grid deferred** → built-in A2UI cards (removed the top build risk).

## Source map (reuse — don't rebuild)

| Path | What to take |
|---|---|
| `/workspaces/qte77/agenthud-agui-a2ui/` | SPA + Worker base — the verbatim reuse map is in `plans/001-build-plan.md`. |
| `/workspaces/qte77/polyfetch-scrape/` | the fetcher (v0.4.0) — `fetch()` API in the plan. |
| `/workspaces/sfsanity/_audit-docs/ingest/sfclarity_ingest/` | ingest patterns to borrow (polite fetch, host allowlist, JSON-LD extractor, dedup hash). |
| `/workspaces/qte77/ldnmxx/docs/` *(sibling)* | deep context: `agui-a2ui-gotchas.md`, `data-sources-api-map.md`, `track-b-*`, `track-a-*`, `decisions/`. |
