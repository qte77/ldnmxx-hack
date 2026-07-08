# worker/ — Cloudflare Worker (`ldnmxx-hack-worker`)

The middleware. `POST /run?usecase=founders-copilot|on-it` → `runUsecase` (plan→tool→render) → SSE
(AG-UI events → A2UI batch), plus `POST /trace` (browser span forwarder). Self-contained
(`wrangler.toml`, `package.json`, `tsconfig`); tests in `worker/test/`. Secrets are Worker secrets only.

**Built + deployed:** live at
<https://ldnmxx-hack-worker.cloudflare-driveway392.workers.dev>. Files: `src/worker.ts` (`runUsecase`,
injection guard + per-IP rate-limit, `/trace`), `src/usecases.ts` (loads/guards `usecases/*.json`),
`src/agent/model.ts` (OpenRouter call, forced `render_ui` tool, stub fallback), `src/agent/providers.ts`
(keyless free chain: Workers AI → OpenRouter `:free` → GitHub Models → stub), `src/a2ui/cards.ts`
(deterministic stub cards from `data/demo/*.json`), `src/trace/arize.ts` (console spans + real Arize
OTLP export when `ARIZE_API_KEY`+`ARIZE_SPACE_ID` are set).

**Run:** `npm run dev` (or `make dev-worker`); tests via `npm run test` (plain-vitest `worker.fetch()`).

**Switches:** `?demo=1` forces the keyless stub even with a model key present; BYOK via
`Authorization: Bearer <key>` header + POST body `{prompt, model}`.

## Setup

Two credential files, both gitignored — copy the `.example` templates:

- **`worker/.env`** — deploy-time Cloudflare auth for `wrangler deploy` (NOT runtime):
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. Required **API-token permission groups**:
  - **Workers Scripts** (Edit) — deploy the Worker.
  - **Workers AI** (Read) — the `[ai]` binding's `/ai/run` inference. **Distinct from "Workers Scripts"** —
    a deploy-only token returns `401` on Workers AI.
  - **Account Settings** (Read) + any binding perms you use (KV, R2, …).
  - Simplest: the **"Edit Cloudflare Workers"** template **plus add Workers AI (Read)**.
- **`worker/.dev.vars`** — runtime secrets/vars (`OPENROUTER_KEY`, `WORKERS_AI_MODEL` + model overrides,
  `ARIZE_*`, `ALLOWED_ORIGINS`, …). In prod, set each with `wrangler secret put <NAME>`.

**Arize (optional tracing).** Set **both** `ARIZE_API_KEY` and `ARIZE_SPACE_ID`, copied from the **same**
`app.arize.com → Space Settings` page (the key must be that space's **ingestion API key**). The exporter
sends OTLP/HTTP **JSON** (Arize accepts JSON). If ingestion returns `unable to validate authorization`
even with a fresh space key + Arize's own OTel SDK, it's an **account-side ingestion entitlement** issue —
contact Arize support (not a code/config problem). Unset → spans log to the console (no dependency).
