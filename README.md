# ldnmxx-hack

> A modular **AG-UI/A2UI** agent on a **Cloudflare Worker** — one core, three seams, two London
> use-cases. Built for **Londonmaxxing 003** (Sat 4 Jul 2026).

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.0.0-blue.svg)](CHANGELOG.md)
[![CI](https://img.shields.io/badge/CI-pending-lightgrey.svg)](.github/workflows/ci.yml)

## What

- **One `POST /run?usecase=<id>` endpoint** + a ~60-LOC `runStages` engine — *swap a JSON, swap the app.*
- **Track B — Founder's Copilot:** describe your idea once → a one-click journey (assess stage → grants →
  who to talk to → incorporate).
- **Track A — On It:** voice → step-free TfL route for a mobility-constrained Londoner.
- Cloudflare **Workers + Pages + KV** · **OpenRouter** via AI Gateway · **Arize** tracing · **A2UI/AG-UI** HUD.
- Keyless/offline demo path + a pre-baked replay safety net.
- Secrets are Worker-only; scraped data is ToU-gated.

## How

```bash
make help    # all targets
make dev     # boot worker (:8787) + ui (:5173) locally, keyless
make test    # ui + worker tests
```

One `POST /run?usecase=<id>` endpoint streams AG-UI SSE events that render built-in **A2UI cards**.
Two workflows share the one engine — toggle them in the UI (the modularity proof):

- **`founders-copilot`** (Track B) — grants matched to your idea, with a qualify-first gate.
- **`on-it`** (Track A, thin) — a step-free London route.

Optional **BYOK**: paste a model key in the dashboard (held in memory only); otherwise the Worker uses
its own key. Observability: `cd worker && npm run tail` shows one Arize span per stage.

**Demo (GitHub Pages):** <https://qte77.github.io/ldnmxx-hack/> — the SPA calls the deployed Worker.

Build it: [`docs/plans/001-build-plan.md`](docs/plans/001-build-plan.md). Design:
[`docs/architecture.md`](docs/architecture.md).

## Why

London's builders and residents both need agents that do real work across fragmented systems — but
funding discovery has no single API, and civic data (TfL ↔ council) is siloed by mandate, not tech.
Incumbents can't join it; a modular agent built in a day can. We prove one core across both of London's
tracks. See [`docs/usecase-workflows.md`](docs/usecase-workflows.md).

## Refs

- [Architecture](docs/architecture.md) · [User stories](docs/UserStory.md) ·
  [Use-case workflows](docs/usecase-workflows.md) · [Build plan](docs/plans/001-build-plan.md) ·
  [Submission](docs/submission.md) · [Design](docs/design.md) · [Demo script](docs/demo-script.md)
- Reuse base: [`qte77/agenthud-agui-a2ui`](https://github.com/qte77/agenthud-agui-a2ui) · fetcher:
  [`qte77/polyfetch-scrape`](https://github.com/qte77/polyfetch-scrape)

## License

Apache-2.0 — see [`LICENSE`](LICENSE) · third-party attribution in [`NOTICE`](NOTICE).
