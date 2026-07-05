# usecases/ — declarative stage defs (PLANNED)

**Not built yet.** No `usecases/*.json` files exist today — the plan→tool→render stages for both
workflows are hardcoded TypeScript switches in `worker/src/worker.ts` (`preRenderStages`/`renderBatch`),
selected today via the `?usecase=founders-copilot|on-it` query param. Externalizing them to one JSON per
use-case here — so **swapping the file = swapping the app**, same engine, same `/run` endpoint — is
planned (#28). Target schema + both workflows: `docs/usecase-workflows.md`.
