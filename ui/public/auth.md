# Authentication

sortmy.london's API requires **no authentication**. There is no login, no account, no API key
to request, and no OAuth flow anywhere on this site — this file exists to say so plainly, per
the [auth.md convention](https://workos.com/auth-md), rather than leave agents guessing.

## What actually gates access

- **Per-IP rate limiting** on `POST /api/run` (see `/openapi.json`) — excess requests get a
  `429`. There is no way to authenticate for a higher limit; the limit is the same for every
  caller.
- **CORS**: the API is same-origin in production (served from `sortmy.london` alongside the
  site). Cross-origin browser calls from another site are not allowed.
- **Optional BYOK**: a visitor MAY supply their own model API key via an `Authorization: Bearer
  <key>` header to use their own model quota instead of the site's free keyless path. This is
  entirely optional, controls nothing about *access* to the API (the endpoint works without it),
  and the key is forwarded per-request only — never stored server-side.

## If you were looking for OAuth / OIDC metadata

There is deliberately no `/.well-known/oauth-protected-resource`,
`/.well-known/openid-configuration`, or `/.well-known/oauth-authorization-server` document on
this site — publishing one would claim an OAuth server that doesn't exist. If that ever
changes, this file and those endpoints will be added together, not one without the other.
