# Changelog

All notable changes are documented here (keep-a-changelog; hand-curated).

## [Unreleased]

Post-hackathon work on `main`, after the v1.0.0 tag.

### Added
- Workers AI default model → `@cf/openai/gpt-oss-120b` (live-verified 2026-07-08; `@cf/zai-org/glm-4.7-flash`
  hits capacity `429`). Documented the required Cloudflare API-token permissions (incl. **Workers AI Read**
  for `/ai/run`) + Arize ingestion setup in `worker/README.md`.
- Browser-BYOK founders render now appends the **same** verified incorporate card as the Worker: the
  how-to pack moved to dependency-free `shared/incorporate.ts`, imported by both paths (#37 fast-follow).
- Free chain: the OpenRouter `:free` tier now walks a fallback **list** of 6 verified free + tool-capable
  models (they rate-limit / rotate), first-valid-wins, each miss logged for `wrangler tail`; the winning
  model id rides into the render span. Override via `OPENROUTER_FREE_MODELS` (csv). (#37 fast-follow)
- Two-path model access (#37) — shared dependency-free `shared/` foundation (prompt/tool/validator), a
  prompt-injection guard (flagged prompt → deterministic stub), and a per-IP rate-limit (429) on `/run` (#42).
- Keyless free-fallback render chain: Workers AI → OpenRouter `:free` → GitHub Models → stub, first-valid
  wins with each tier structurally validated; a BYOK header stays the paid path, our key feeds `:free`
  (never a paid call), so the Worker rarely/never spends (#43).
- Real Arize **OTLP** export (OpenInference spans → `otlp.arize.com` when `ARIZE_API_KEY`+`ARIZE_SPACE_ID`
  are set; console otherwise) + a CORS-allowlisted `POST /trace` forwarder for browser spans (closes #21).
- A2UI render-surface theming, EyeRest-branded (port of base PR #168) (#31).
- Externalized both workflows' plan→tool→render choreography to `usecases/*.json`, read at runtime by a
  small `runUsecase` interpreter (`worker/src/usecases.ts`, guarded at load); render modes stay in code.
  "Swap a JSON, swap the app" is now literal for stage choreography (#28).
- Track-B **incorporate how-to-pack card**: a verified, static set of real gov.uk / Companies House
  links (clickable markdown anchors, never LLM-generated), appended to the founders render on both the
  stub and model paths, plus a `tool:incorporate` HUD stage. Not a live filing (#12; the live filing
  stays deferred).
- Style A2UI-surface markdown links (`<a>`) as links (primary colour + underline) so the incorporate
  card's verified links read as clickable (they were already anchors; this is the visible affordance).

## [1.0.0] - 2026-07-04

Final **Londonmaxxing 003** hackathon build — the state at the end of the hack day (commit `01d2c95`).

### Added
- Repo scaffold + docs (architecture, user stories, use-case workflows, build plan, submission).
- Phase 1 first E2E: SPA → `POST /run?usecase=<id>` (SSE) → built-in A2UI cards; `useAgentSSE`
  transport; `runStages` per usecase (`founders-copilot` + thin `on-it`); console Arize span
  per stage; optional in-dashboard BYOK; `ui`/`worker` CI jobs + GitHub Pages deploy workflow.
- Real OpenRouter call for Track B's `search_opportunities` render, with a deterministic stub
  fallback on any failure (#19).
- Theme toggle + `?demo=1` keyless auto-run (#20).
- Raised model `max_tokens` so the `render_ui` batch isn't truncated (#22).
- Live A2UI component catalog + Track-A default on load + 100% worker observability (#24).
- Usecase toggle now swaps the example input query to match the selected track (#25).
