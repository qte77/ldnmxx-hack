# Deploy to Cloudflare (full CF)

Groundwork runs fully on Cloudflare: the **SPA on Cloudflare Pages** at `sortmy.london`, and the existing
**Worker** serving **same-origin `/api/*`** via a Worker route (no CORS). GitHub Pages is retired.

## One-time setup

1. **Zone:** add `sortmy.london` to the Cloudflare account (move its nameservers to Cloudflare).
2. **API token** (Pages·Edit + Workers Scripts·Edit + Zone·Read + Zone·DNS·Edit) → `~/.cf-token`;
   **account id** → `~/.cf-acct` (or export `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`).
3. **Worker secrets** (unchanged): `cd worker && npx wrangler secret put OPENROUTER_KEY` (+ `ARIZE_*` if used).

## Deploy

```bash
bash scripts/provision_cf.sh                      # build ui/ -> Pages, deploy the Worker
DOMAIN=sortmy.london bash scripts/finish_cf.sh    # first time only: attach the custom domain
```

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
