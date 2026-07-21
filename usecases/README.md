# usecases/ — declarative stage defs

`founders-copilot.json` + `on-it.json` define each workflow's plan→tool→render **stage choreography**,
read at runtime by the small `runUsecase` interpreter in `worker/src/worker.ts` (loaded + guarded by
`worker/src/usecases.ts`). Selected by the `?usecase=<id>` query param — **swapping/adding a JSON swaps
the app**, same engine, same `/run` endpoint.

Render implementations (prompts, card builders, the model call) stay in code, referenced by
`render.mode` (`founders` = model-generated grant cards with stub fallback · `route` = the canned
step-free route · `corpus` = the GENERIC deterministic corpus render). A wholly new render *behaviour*
still needs a new mode in code — but a new **corpus** workflow does not: pair `"mode": "corpus"` with a
`query_corpus` stage naming a corpus registered in `worker/src/corpus/registry.ts`, and the engine needs
no TS change. An unregistered `corpus` id is rejected at load time.

**Contract:** each file is also a `workflow-definition/v1` (`qte77/protocols`) — the language-neutral
envelope shared with the Python doc-workflows engine (`qte77/azure-doc-workflows`). The two engines only
have to agree on a non-empty `id` + ordered, non-empty `stages[].name`; everything else here (`title`,
`render`, `stage.kind`, `stage.events`, `stage.exec`) is TS-engine-specific and layered on top by
`assertUsecaseDef`. `worker/test/usecases.contract.test.ts` validates every file here against the
vendored schema (`worker/test/fixtures/contract/`, synced via `protocols/scripts/sync.sh`).

`assertUsecaseDef` is **strict**: it rejects **unknown keys** at load (envelope `{id, title, render,
stages}`, stage `{name, kind, events, exec, corpus}`), so a misspelled optional field fails loudly
instead of being silently ignored. This is the TS engine's own strictness (adopting
`azure-doc-workflows`' pydantic `extra="forbid"`); the *shared* `workflow-definition/v1` schema stays
`additionalProperties:true` so cross-engine extras still pass — our usecases only carry TS fields.

Schema (guarded at load):

```jsonc
{
  "id": "on-it",
  "title": "On It",
  "render": { "mode": "founders" | "route" | "corpus" },
  "stages": [
    { "name": "plan", "kind": "plan", "events": [ { "type": "STEP_STARTED", "text": "…" } ] },
    // a corpus workflow's query stage — `corpus` must name a registered corpus
    { "name": "query", "kind": "tool", "exec": "query_corpus", "corpus": "care", "events": [] }
  ]
}
```

Each stage plays its `events` (paced) over SSE and emits one Arize span named `name`. Both workflows +
judging alignment: `docs/usecase-workflows.md`.
