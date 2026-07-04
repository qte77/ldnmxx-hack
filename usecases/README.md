# usecases/ — declarative stage defs

One JSON per use-case — `founders-copilot.json` (Track B), `on-it.json` (Track A) — defining the
plan→tool→render stages the Worker's `runStages` interprets at runtime. **Swapping the file = swapping the
app** (B ⇄ A); same engine, same `/run` endpoint. Schema + both workflows: `docs/usecase-workflows.md`.
