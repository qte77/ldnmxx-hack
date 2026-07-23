# Deploy to Cloudflare (full CF)

Groundwork runs fully on Cloudflare: the **SPA on Cloudflare Pages** at `sortmy.london`, and the existing
**Worker** serving **same-origin `/api/*`** via a Worker route (no CORS). GitHub Pages is retired.

## One-time setup

1. **Zone:** add `sortmy.london` to the Cloudflare account (move its nameservers to Cloudflare).
2. **API token** — scopes **Cloudflare Pages·Edit + Workers Scripts·Edit + Zone·Read + Zone·DNS·Edit**
   (+ Workers AI·Read for the `AI` binding), **Zone Resources = `sortmy.london`**. Put it + the **account
   id** in a gitignored repo-root **`.env`** (copy `.env.example`; `provision_cf.sh` / `finish_cf.sh`
   auto-source it), or `~/.cf-token` / `~/.cf-acct`, or export `CLOUDFLARE_API_TOKEN` /
   `CLOUDFLARE_ACCOUNT_ID`. *(Editing a token's permissions keeps its value; **rolling** it changes the
   secret — update `.env` if you roll.)*
3. **Worker secrets** (unchanged): `cd worker && npx wrangler secret put OPENROUTER_KEY` (+ `ARIZE_*` if used).

## Deploy

```bash
bash scripts/provision_cf.sh                      # build ui/ -> Pages, deploy the Worker
DOMAIN=sortmy.london bash scripts/finish_cf.sh    # first time only: attach the custom domain
```

### …or from CI, with no local credential (017 P1)

A dev environment without Cloudflare credentials cannot deploy **or verify** anything: the D1 binding
is `remote = true`, so even `wrangler dev` refuses to start. Two dispatch-only workflows move that
work into Actions:

| Workflow | Does | Gate |
|---|---|---|
| **Deploy (Cloudflare)** `.github/workflows/deploy.yml` | runs `provision_cf.sh`, then asserts the hashed entry script is served as JavaScript with browser headers (the #178 SPA-fallback regression) | `workflow_dispatch` + `production` Environment |
| **D1 Verify (read-only)** `.github/workflows/d1-verify.yml` | one of four **static** SELECTs — `corpus_meta` freshness, `row_counts`, and P2b's `bbox_plan` / `bbox_rows_read` | `workflow_dispatch` + `production` Environment |
| **Tier-3 Monitor** `.github/workflows/tier3-monitor.yml` | the full e2e sweep against the live site | none — credential-free |

**Setup (once):** add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets
(`gh secret set CLOUDFLARE_API_TOKEN --repo qte77/ldnmxx-hack` prompts for hidden input — never paste
a token into a shell history or a chat), then add required reviewers to the `production` Environment
so a deploy is an approval rather than a button. **`d1-verify` additionally needs Account > D1 >
Edit** on the token — Cloudflare has no read-only D1 scope. Both workflows fail fast with a readable
message while the secrets are absent.

The D1 statement set is **static and read-only by construction**: the dispatch takes a `choice`, not
free-text SQL, mirroring how ADR 0002 keeps `VIEW_SQL` a closed whitelist.

## D1 corpus store (016 #182)

- **Migrations** (after any `worker/migrations/` change; additive ones are safe to pre-stage):
  `cd worker && ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config wrangler.toml`
  — ALWAYS pass `--config` (bare wrangler walks up to the root Pages config).
- **Data** flows in via the daily cron (`scheduled()`, 04:47 UTC): `corpus-data` release assets →
  shadow table → validate (min-rows + registry-attribution licence gate) → atomic swap →
  `corpus_meta` stamp. The weekly ingester is `.github/workflows/ingest.yml` (dispatchable).
- **Fire the cron on demand** (verification): `--test-scheduled` does NOT exist in `--remote` dev —
  copy `wrangler.toml` to a temp config with `remote = true` on the D1 binding (drop `routes`),
  run `wrangler dev --test-scheduled --config <temp>`, hit `/__scheduled?cron=47+4+*+*+*`, poll
  `corpus_meta` for the LAST target's stamp, delete the temp config (see AGENT_LEARNINGS).
- **State check:**
  `./node_modules/.bin/wrangler d1 execute DB --remote --config wrangler.toml --command "SELECT * FROM corpus_meta" --json`
- Every corpus degrades to its bundled sample when D1 is unbound, failing, unseeded, or its view
  is not yet swapped — an empty store never breaks a workflow.

## Worker environment (reference)

Secrets (via `wrangler secret put`, never in code/config): `OPENROUTER_KEY` · `ARIZE_API_KEY` ·
`ARIZE_SPACE_ID`. Vars/bindings (in `worker/wrangler.toml`): `ALLOWED_ORIGINS` · `AI` (Workers AI)
· `DB` (D1) · `RATE_LIMITER`. Optional overrides (`Env` in `worker/src/worker.ts`):
`ARIZE_PROJECT` · `AI_GATEWAY_URL` · `DEFAULT_MODEL` · `PACE_MS` · `WORKERS_AI_MODEL` ·
`OPENROUTER_FREE_MODEL` · `OPENROUTER_FREE_MODELS` — all documented at their `Env` declaration;
treat every name above as RESERVED.

## Topology

- **SPA:** Vite build (`ui/dist`, base `/`) -> CF Pages project `sortmy-london`. SPA fallback
  `ui/public/_redirects`; security headers `ui/public/_headers`. Project config: `wrangler.jsonc`.
- **API:** `worker/` deploys to a **route** `sortmy.london/api/*` (`worker/wrangler.toml` `routes`). Worker
  routes win over Pages, so `/api/*` -> Worker, everything else -> the static SPA. Same-origin => no CORS.
- **Paths:** `POST /api/run?usecase=<id>` (SSE) · `POST /api/trace`. Prod `WORKER_BASE=""` (`ui/src/config.ts`).

## Edge security (Cloudflare dashboard, per zone)

Always Use HTTPS · HSTS (start `max-age` ~1 month; `includeSubDomains` OK; **hold Preload** until stable) ·
TLS min 1.2 · no-sniff. CI stays lint/test only (no CF action -> no Actions-policy churn).

## Alternative: Pages Git integration

Dashboard -> Pages -> Connect to Git -> root `ui`, build `npm run build`, output `dist` — auto-build on push,
no scripts. The SPA is keyless, so no build env vars are needed.
