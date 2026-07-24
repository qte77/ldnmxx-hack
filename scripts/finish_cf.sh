#!/usr/bin/env bash
# finish_cf.sh — connect a custom domain (+ www) to the Cloudflare Pages project.
# Force-replaces the apex/www DNS with a PROXIED CNAME -> <project>.pages.dev, then attaches the
# Pages custom domain. Adapted from qte77/sfclarity + fo-scraper-miwi. Verbose: prints every API result.
#
# Prereq: sortmy.london must already be a zone on your Cloudflare account (nameservers on CF).
#
# Env overrides (all optional):
#   PROJECT        Pages project name       (default sortmy-london)
#   DOMAIN         apex domain (+ www)      (default sortmy.london)
#   TARGET         CNAME target             (default <PROJECT>.pages.dev)
# Token needs: Pages·Edit + Zone·Read + Zone·DNS·Edit (Zone Resources = the domain).
# Credentials are REPO-SELF-CONTAINED: CLOUDFLARE_API_TOKEN from the gitignored repo-root .env; the
# account id comes from worker/wrangler.toml (or CLOUDFLARE_ACCOUNT_ID if pre-exported). No ~/.cf-* files.
#
# Run WITH BASH:  DOMAIN=sortmy.london bash scripts/finish_cf.sh
set -euo pipefail

# Load the gitignored repo-root .env (CLOUDFLARE_API_TOKEN) unless already exported.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env" ] && [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && { set -a; . "$ROOT/.env"; set +a; }

PROJECT="${PROJECT:-sortmy-london}"
DOMAIN="${DOMAIN:-sortmy.london}"
TARGET="${TARGET:-$PROJECT.pages.dev}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
# account id: prefer a pre-exported env, else read the pinned account_id from worker/wrangler.toml.
ACCT="${CLOUDFLARE_ACCOUNT_ID:-$(sed -n 's/^account_id = "\([0-9a-f]\{1,\}\)".*/\1/p' "$ROOT/worker/wrangler.toml")}"
[ -n "$TOKEN" ] || { echo "!! no CLOUDFLARE_API_TOKEN — add it to the repo-root .env (see .env.example)"; exit 1; }
[ -n "$ACCT" ]  || { echo "!! no account id — set account_id in worker/wrangler.toml (or export CLOUDFLARE_ACCOUNT_ID)"; exit 1; }
API="https://api.cloudflare.com/client/v4"
AUTH="Authorization: Bearer $TOKEN"

api() { # method path [json-body]
  if [ -n "${3:-}" ]; then
    curl -s -X "$1" -H "$AUTH" -H "Content-Type: application/json" "$API$2" --data "$3"
  else
    curl -s -X "$1" -H "$AUTH" "$API$2"
  fi
}
show() { python3 -c 'import sys,json; d=json.load(sys.stdin); print("  OK" if d.get("success") else "  ERROR: "+json.dumps(d.get("errors")))'; }

echo "== zone lookup ($DOMAIN) =="
ZONE="$(api GET "/zones?name=$DOMAIN" | python3 -c 'import sys,json; r=(json.load(sys.stdin).get("result") or []); print(r[0]["id"] if r else "")')"
[ -n "$ZONE" ] || { echo "!! zone not found — add $DOMAIN to Cloudflare first, or token lacks Zone·Read"; exit 1; }
echo "   zone $ZONE  ->  target $TARGET"

for name in "$DOMAIN" "www.$DOMAIN"; do
  echo "== $name =="
  recs="$(api GET "/zones/$ZONE/dns_records?name=$name&per_page=100")"
  ok="$(printf '%s' "$recs" | python3 -c 'import sys,json; print("y" if json.load(sys.stdin).get("success") else "n")')"
  [ "$ok" = y ] || { echo "!! cannot list DNS (token needs Zone·DNS·Edit)"; exit 1; }
  printf '%s' "$recs" | python3 -c 'import sys,json
for r in (json.load(sys.stdin).get("result") or []): print(r["id"], r["type"], r.get("content",""))' | while read -r id type content; do
    [ -n "$id" ] || continue
    case "$type" in
      A|AAAA|CNAME) echo "   deleting $type -> $content"; api DELETE "/zones/$ZONE/dns_records/$id" | show ;;
      *) echo "   keeping $type -> $content" ;;
    esac
  done
  echo "   creating proxied CNAME $name -> $TARGET"
  api POST "/zones/$ZONE/dns_records" "{\"type\":\"CNAME\",\"name\":\"$name\",\"content\":\"$TARGET\",\"proxied\":true}" | show
  echo "   attaching Pages custom domain $name"
  api POST "/accounts/$ACCT/pages/projects/$PROJECT/domains" "{\"name\":\"$name\"}" | show
done

echo
echo "Done. Give it a couple minutes, then open https://$DOMAIN in a browser."
