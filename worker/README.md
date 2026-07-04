# worker/ — Cloudflare Worker (`ldnmxx-hack-worker`)

The middleware. `POST /run?usecase=<id>` → `runStages` (plan→tool→render) → SSE. OpenRouter via CF AI
Gateway; reads KV `OPPORTUNITIES` (`data/demo/` fallback); injectable Arize trace. Self-contained
(`wrangler.toml`, `package.json`, `tsconfig`); tests in `worker/test/`. Secrets are Worker secrets only.
**Not scaffolded yet.**
