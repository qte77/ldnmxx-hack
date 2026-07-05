# Changelog

All notable changes are documented here (keep-a-changelog; hand-curated).

## [Unreleased]

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
- A2UI render-surface theming, EyeRest-branded (port of base PR #168) (#31).
- Externalized both workflows' plan→tool→render choreography to `usecases/*.json`, read at runtime by a
  small `runUsecase` interpreter (`worker/src/usecases.ts`, guarded at load); render modes stay in code.
  "Swap a JSON, swap the app" is now literal for stage choreography (#28).
