# ingest/ — corpus seeding (Python/uv)

`seed.py` is **not built yet — deferred to #161** pending an NHS ODS TRUD account (human action).

Pipeline (decided — W4/W6, ADR 0002): fetch **NHS ODS bulk via TRUD** (OGL — the live DoS/Service
Search API **forbids caching**, see `data/sources.json` `redistribute_ok`) → parse ZIP/CSV →
normalise to `CorpusRecord` → geocode each postcode once via **postcodes.io** (OGL, keyless; GB
only, never NI/BT rows) → write **CF D1** (`wrangler d1 execute/import`; schema + views live in
`worker/migrations/`). Emit the OGL attribution strings with the corpus labels.

- **Fetch via polyfetch env-borrow** — never `uv add` it (heavy deps poison the lockfile):
  `uv run --directory ../polyfetch-scrape polyfetch fetch <url> --show-body` (typed error taxonomy,
  retry with `Retry-After`, anti-bot tiers). Caveat: the CLI surfaces 3xx without following — see
  polyfetch#188.
- **Secrets:** the TRUD API key is an **ingester secret** (GitHub Actions), never on the hot path;
  the request path reads D1 only.
- **Tests** only on the pure parsers (module-TDD); fetch/glue is not unit-tested.
