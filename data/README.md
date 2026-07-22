# data/

- `demo/` — **synthetic, committed** sample opportunities/route data (Founder's Copilot + On It).
- `care/` — **synthetic, committed** Sort My Care corpus (NHS/care services + postcode gazetteer).
- `wander/` — **synthetic, committed** Sort My Wander corpus (heritage sites + green spaces + postcode gazetteer).
- `scam/` — **synthetic, committed** Sort My Scam Check dataset (fictional firms + FCA-register status).
- `real/` — scraped, **gitignored** (ToU-gated). Never commit scraped data.
- `sources.json` — vetted, machine-readable source catalog (feeds the usecase catalog below).
- `usecase-catalog.json` — the candidate-usecase backlog/idea layer (shipped ids live in `usecases/*.json`).

The `care`/`wander` corpus record shape is `worker/src/corpus/contract.ts` (`CorpusRecord extends Coords`)
— one shape for every nearest-N corpus workflow. Scam is a **match** shape, not nearest-N, so it has its
own `ScamRecord` (`worker/src/scam/registry.ts`) rather than fitting `CorpusRecord`.
