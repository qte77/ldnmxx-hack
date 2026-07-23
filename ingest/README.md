# ingest/ — corpus seeding (Python, stdlib-only)

P1 (#182, plan 016): the keyless ingest pipeline. **No third-party deps, no API keys** — every
source is keyless and `redistribute_ok` (see `data/sources.json` for the per-source licence
obligations).

## Pipeline

`.github/workflows/ingest.yml` (weekly + dispatch) runs `seed.py`, which fetches each source and
normalises it through a **pure, pytest-covered parser** (`parsers.py`) into per-corpus JSON
artifacts, published to the rolling release tag **`corpus-data`**. The Worker's daily cron
(`worker/src/corpus/ingest.ts`, `scheduled()`) consumes the artifacts: shadow table → validate
(min-rows + the registry-attribution licence gate) → atomic swap → `corpus_meta` stamp. **No CF
credential ever enters CI; no GitHub credential ever enters the Worker** (the release is public).

## Sources → artifacts

| Source | Parser | Artifact | Feeds |
|---|---|---|---|
| postcodes.io bulk (OGL, GB-only — **never BT/NI**) | `parse_postcodes` | `postcodes.json` | `postcodes` gazetteer (P1) |
| Historic England NHLE ArcGIS GeoJSON (OGL) | `parse_nhle` | `nhle.json` | Wander (P2) |
| OS Open Greenspace GeoJSON (OGL) | `parse_greenspace` | `greenspace.json` | Wander (P2) |
| CQC Syndication `/locations` (OGL, `partnerCode=sortmy-london`) | `parse_cqc` | `cqc.json` | Care (P3) |
| FHRS establishments (OGL, show inspection date) | `parse_fhrs` | `fhrs.json` | Food Hygiene (P4) |

Corpus artifacts are arrays of the frozen `CorpusRecord` shape (`worker/src/corpus/contract.ts`);
`postcodes.json` is an array of `{postcode, lat, lng}`. Attribution strings are **NOT** in the
artifacts — they live in reviewed TS (`worker/src/corpus/registry.ts`), and the Worker's swap gate
refuses a corpus whose attribution is empty.

## Tests

Strict module-TDD on the **pure parsers only** (`tests/test_parsers.py`, fixtures =
small captured real payloads under `tests/fixtures/`). Fetch/orchestration glue (`seed.py`) is not
unit-tested — it is proven by real Action runs. Run: `uvx pytest -q ingest` (or via `make test`).

## Local exploration

For ad-hoc endpoint probing use polyfetch env-borrow — never `uv add` it here:
`uv run --directory ../polyfetch-scrape polyfetch fetch <url> --show-body --max-tier curl_cffi`
(the CLI does not follow 3xx — polyfetch#188). `seed.py` itself uses stdlib `urllib` so CI needs
nothing installed.
