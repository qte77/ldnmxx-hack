# usecases/ — declarative stage defs

`founders-copilot.json` + `on-it.json` define each workflow's plan→tool→render **stage choreography**,
read at runtime by the small `runUsecase` interpreter in `worker/src/worker.ts` (loaded + guarded by
`worker/src/usecases.ts`). Selected by the `?usecase=<id>` query param — **swapping/adding a JSON swaps
the app**, same engine, same `/run` endpoint.

Render implementations (prompts, card builders, the model call) stay in code, referenced by
`render.mode` (`founders` = model-generated grant cards with stub fallback · `route` = the canned
step-free route). A wholly new render behaviour still needs a new mode in code.

Schema (guarded at load):

```jsonc
{
  "id": "on-it",
  "title": "On It",
  "render": { "mode": "founders" | "route" },
  "stages": [
    { "span": "plan", "kind": "plan", "events": [ { "type": "STEP_STARTED", "text": "…" } ] }
  ]
}
```

Each stage plays its `events` (paced) over SSE and emits one Arize span named `span`. Both workflows +
judging alignment: `docs/usecase-workflows.md`.
