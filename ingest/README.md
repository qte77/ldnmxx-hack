# ingest/ — one-shot seed (Python/uv)

`seed.py` scrapes opportunities via **polyfetch** → `opportunities.json` → `wrangler kv:bulk put` → KV.
Borrow the fetch/extract patterns from `/workspaces/sfsanity/_audit-docs/ingest/sfclarity_ingest/`
(polite fetch, host allowlist, JSON-LD/`__NEXT_DATA__` extractor, `url_hash` dedup = KV key). Tests only
on the pure parsers. **Not built yet.**
