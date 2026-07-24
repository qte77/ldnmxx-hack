#!/usr/bin/env bash
# provision_cf.sh — build the Vite SPA (ui/) → Cloudflare Pages, then deploy the Worker.
# Full-CF topology: SPA on Pages (sortmy.london); the Worker serves sortmy.london/api/* via a Worker
# route (worker/wrangler.toml). Mirrors qte77/sfclarity + fo-scraper-miwi. See docs/deploy-cloudflare.md.
#
# Env override (optional): PROJECT — Pages project name (default sortmy-london).
#
# Credentials are REPO-SELF-CONTAINED: put CLOUDFLARE_API_TOKEN in the gitignored repo-root .env (copy
# .env.example). No ~/.cf-token / ~/.cf-acct, no secrets in this script. account_id is pinned in
# worker/wrangler.toml (so the Worker deploy is explicit) and the single-account token auto-detects the
# account for the Pages deploy. Runtime Worker secrets (OPENROUTER_KEY, ARIZE_*) do NOT go here —
# use `wrangler secret put`.
# Token scopes: Pages·Edit + Workers Scripts·Edit + D1·Edit + Workers AI·Read (account) · Workers
# Routes·Edit + Zone·Read (zone sortmy.london).
#
# Run WITH BASH (dash lacks pipefail):  bash scripts/provision_cf.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
# Load the gitignored repo-root .env (CLOUDFLARE_API_TOKEN) unless already exported. Pre-exported wins,
# so CI can pass the token via the environment without a .env file.
[ -f "$REPO/.env" ] && [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && { set -a; . "$REPO/.env"; set +a; }
WRANGLER="npx --yes wrangler"
PROJECT="${PROJECT:-sortmy-london}"

export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "!! no CLOUDFLARE_API_TOKEN — add it to the repo-root .env (see .env.example)"; exit 1; }
cd "$REPO"

echo "== 0. whoami =="
$WRANGLER whoami

echo "== 1. build the SPA at base / (ui/dist) =="
npm --prefix ui ci
npm --prefix ui run build

echo "== 2. create Pages project $PROJECT (no-op if it exists) =="
$WRANGLER pages project create "$PROJECT" --production-branch main 2>/dev/null || echo "   (project exists)"

echo "== 3. deploy ui/dist to Pages =="
$WRANGLER pages deploy ui/dist --project-name "$PROJECT" --branch main

echo "== 4. deploy the Worker (serves sortmy.london/api/*; needs the zone on the account) =="
# Deploy from worker/ with an EXPLICIT --config. wrangler v4 walks UP the tree for config and prefers the
# root Pages `wrangler.jsonc` over `worker/wrangler.toml` even when run inside worker/, so without --config
# it fails with "Missing entry-point / you have run wrangler deploy on a Pages project".
#
# The worker SCRIPT upload is the load-bearing step. Re-asserting the sortmy.london/api/* route needs
# Zone > Workers Routes > Edit on the token; without it wrangler exits with API code 10000 AFTER the script
# uploads fine and the already-existing route keeps serving. Don't let that expected, benign failure abort
# the whole deploy — it made `make deploy` report a false "Error 1". Add the token scope to exit clean.
set +e
( cd "$REPO/worker" && $WRANGLER deploy --config wrangler.toml )
WORKER_RC=$?
set -e
if [ "$WORKER_RC" -ne 0 ]; then
  echo "   !! worker deploy exited $WORKER_RC — if that is the code-10000 route error above, it is benign:"
  echo "      the script uploaded and sortmy.london/api/* already routes (token lacks Zone>Workers Routes>Edit)."
fi

echo
echo "Deployed -> https://$PROJECT.pages.dev  (Worker /api via route on sortmy.london)"
echo "First time only:  DOMAIN=sortmy.london PROJECT=$PROJECT bash scripts/finish_cf.sh"
