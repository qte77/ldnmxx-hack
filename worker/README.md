# worker/ — Cloudflare Worker (`ldnmxx-hack-worker`)

The middleware. `POST /run?usecase=founders-copilot|on-it` → `runUsecase` (plan→tool→render) → SSE
(AG-UI events → A2UI batch). Self-contained (`wrangler.toml`, `package.json`, `tsconfig`); tests in
`worker/test/`. Secrets are Worker secrets only.

**Built + deployed:** live at
<https://ldnmxx-hack-worker.cloudflare-driveway392.workers.dev>. Files: `src/worker.ts` (`runUsecase`), `src/usecases.ts` (loads/guards `usecases/*.json`),
`src/agent/model.ts` (real OpenRouter call, forced `render_ui` tool, deterministic stub fallback),
`src/a2ui/cards.ts` (deterministic stub cards from `data/demo/*.json`), `src/trace/arize.ts` (console
spans; real export tracked in #21).

**Run:** `npm run dev` (or `make dev-worker`); tests via `npm run test` (plain-vitest `worker.fetch()`).

**Switches:** `?demo=1` forces the keyless stub even with a model key present; BYOK via
`Authorization: Bearer <key>` header + POST body `{prompt, model}`.
