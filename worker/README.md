# worker/ — Cloudflare Worker (`ldnmxx-hack-worker`)

The middleware. `POST /api/run?usecase=founders-copilot|on-it|sort-my-care|sort-my-wander|sort-my-scam-check`
→ `runUsecase` (plan→tool→render) → SSE (AG-UI events → A2UI batch), plus `POST /api/trace` (browser span
forwarder).
Self-contained (`wrangler.toml`, `package.json`, `tsconfig`); tests in `worker/test/`. Secrets are Worker
secrets only.

**Live:** serves <https://sortmy.london/api/*> via a Worker route (`wrangler.toml`). Files: `src/worker.ts`
(`runUsecase`, injection guard + per-IP rate-limit, fail-closed CORS, `/api/trace`), `src/usecases.ts` (loads/guards `usecases/*.json`),
`src/agent/model.ts` (OpenRouter call, forced `render_ui` tool, stub fallback), `src/agent/providers.ts`
(keyless free chain: Workers AI → OpenRouter `:free` → GitHub Models → stub), `src/a2ui/cards.ts`
(deterministic stub cards from `data/demo/*.json`), `src/trace/arize.ts` (console spans + real Arize
OTLP export when `ARIZE_API_KEY`+`ARIZE_SPACE_ID` are set).

**General engine.** `src/workflows.ts` is the registry — render `mode` → card builder, deterministic
query `exec` → corpus query. Adding a **corpus workflow** (nearest-N, e.g. **Sort My Care**/**Sort My
Wander**) is register + a JSON; `runUsecase`/`renderBatch` never change (open/closed). **Sort My Scam
Check** is a **match**-shape workflow instead (firm name/FRN lookup, not nearest-N) — it lives in its own
`src/scam/{registry,query,render}.ts` module behind a dedicated `scam` render mode + `query_scam` exec,
never a verdict, always a signpost to the FCA register. Flagship: **Sort My Care** (`src/corpus/*`,
`usecases/sort-my-care.json`) — a model-free + fetch-free postcode → nearest-NHS signpost over a
**synthetic** corpus (`data/care/*.json`; real ingest + CF D1 are follow-ups). It reports honestly as
deterministic (`USAGE mode:demo`) and shows the corpus freshness + a curated "confirm with the official
source" disclaimer in the render. `src/dates.ts` validates the `asOf` freshness date (oldest valid ISO
date only), and `src/agent/model.ts`'s `callModelTool` retries once on a transient HTTP status before
falling back. No new env or CLI switch beyond `?usecase=<id>` (postcode/query passed as the run `prompt`).

**Run:** `npm run dev` (or `make dev-worker`); tests via `npm run test` (plain-vitest `worker.fetch()`);
lint via `npm run lint` (strictTypeChecked, matching `ui/`).

**Switches:** `?demo=1` forces the keyless stub even with a model key present; BYOK via
`Authorization: Bearer <key>` header + POST body `{prompt, model}`.

## Setup

Credentials are gitignored — copy the `.example` templates:

- **Deploy auth** — the full-CF deploy reads `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from a
  gitignored **repo-root `.env`** (copy `.env.example`; auto-sourced by `scripts/provision_cf.sh` /
  `finish_cf.sh`). Token scopes + one-time setup: [`docs/deploy-cloudflare.md`](../docs/deploy-cloudflare.md).
  *(For a worker-only `wrangler deploy` you can instead `wrangler login`, or just export the two vars.)*
- **`worker/.dev.vars`** — runtime secrets/vars (`OPENROUTER_KEY`, `WORKERS_AI_MODEL` + model overrides,
  `ARIZE_*`, `ALLOWED_ORIGINS`, …). In prod, set each with `wrangler secret put <NAME>`.

**Arize (optional tracing).** Set **both** `ARIZE_API_KEY` and `ARIZE_SPACE_ID`, copied from the **same**
`app.arize.com → Space Settings` page (the key must be that space's **ingestion API key**). The exporter
sends OTLP/HTTP **JSON** (Arize accepts JSON). If ingestion returns `unable to validate authorization`
even with a fresh space key + Arize's own OTel SDK, it's an **account-side ingestion entitlement** issue —
contact Arize support (not a code/config problem). Unset → spans log to the console (no dependency).
