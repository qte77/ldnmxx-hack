#!/usr/bin/env bash
# provision_cf.sh — build the Vite SPA (ui/) → Cloudflare Pages, then deploy the Worker.
# Full-CF topology: SPA on Pages (sortmy.london); the Worker serves sortmy.london/api/* via a Worker
# route (worker/wrangler.toml). Mirrors qte77/sfclarity + fo-scraper-miwi. See docs/deploy-cloudflare.md.
#
# Env overrides (all optional):
#   PROJECT        Pages project name   (default sortmy-london)
#   CF_TOKEN_FILE  API-token file       (default ~/.cf-token)
#   CF_ACCT_FILE   account-id file      (default ~/.cf-acct)
# Token scopes: Cloudflare Pages·Edit + Workers Scripts·Edit (+ Zone·Read / Zone·DNS·Edit for finish_cf.sh).
# No secrets stored here — the token/account are read at runtime from env or the files above.
#
# Run WITH BASH (dash lacks pipefail):  bash scripts/provision_cf.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
# Auto-load a gitignored repo-root .env (deploy creds: CLOUDFLARE_API_TOKEN / _ACCOUNT_ID) if present and
# not already exported — one source of truth for the full-CF deploy (Pages + Worker). Pre-exported vars
# win. Runtime Worker secrets (OPENROUTER_KEY, ARIZE_*) do NOT go here — use `wrangler secret put`.
[ -f "$REPO/.env" ] && [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && { set -a; . "$REPO/.env"; set +a; }
WRANGLER="npx --yes wrangler"
PROJECT="${PROJECT:-sortmy-london}"
CF_TOKEN_FILE="${CF_TOKEN_FILE:-$HOME/.cf-token}"
CF_ACCT_FILE="${CF_ACCT_FILE:-$HOME/.cf-acct}"

: "${CLOUDFLARE_API_TOKEN:=$(cat "$CF_TOKEN_FILE" 2>/dev/null || true)}"
: "${CLOUDFLARE_ACCOUNT_ID:=$(cat "$CF_ACCT_FILE" 2>/dev/null || true)}"
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "!! no API token in $CF_TOKEN_FILE (or CLOUDFLARE_API_TOKEN)"; exit 1; }
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
( cd "$REPO/worker" && $WRANGLER deploy --config wrangler.toml )

echo
echo "Deployed -> https://$PROJECT.pages.dev  (Worker /api via route on sortmy.london)"
echo "First time only:  DOMAIN=sortmy.london PROJECT=$PROJECT bash scripts/finish_cf.sh"
