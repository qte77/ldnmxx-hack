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
#   CF_TOKEN_FILE  API-token file           (default ~/.cf-token)
#   CF_ACCT_FILE   account-id file          (default ~/.cf-acct)
# Token needs: Pages·Edit + Zone·Read + Zone·DNS·Edit (Zone Resources = the domain).
#
# Run WITH BASH:  DOMAIN=sortmy.london bash scripts/finish_cf.sh
set -euo pipefail

# Auto-load a gitignored repo-root .env (CLOUDFLARE_API_TOKEN / _ACCOUNT_ID) if present + not already set.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env" ] && [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && { set -a; . "$ROOT/.env"; set +a; }

PROJECT="${PROJECT:-sortmy-london}"
DOMAIN="${DOMAIN:-sortmy.london}"
TARGET="${TARGET:-$PROJECT.pages.dev}"
CF_TOKEN_FILE="${CF_TOKEN_FILE:-$HOME/.cf-token}"
CF_ACCT_FILE="${CF_ACCT_FILE:-$HOME/.cf-acct}"
TOKEN="${CLOUDFLARE_API_TOKEN:-$(cat "$CF_TOKEN_FILE" 2>/dev/null || true)}"
ACCT="${CLOUDFLARE_ACCOUNT_ID:-$(cat "$CF_ACCT_FILE" 2>/dev/null || true)}"
[ -n "$TOKEN" ] || { echo "!! no token in $CF_TOKEN_FILE"; exit 1; }
[ -n "$ACCT" ]  || { echo "!! no account id in $CF_ACCT_FILE"; exit 1; }
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
