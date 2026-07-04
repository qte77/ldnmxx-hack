# Groundwork

> One **AG-UI/A2UI** workflow engine on a **Cloudflare Worker** — *swap a JSON, swap the app.*
> Two London workflows, one core. Built for **Londonmaxxing 003** (Sat 4 Jul 2026).

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](CHANGELOG.md)
[![CI](https://github.com/qte77/ldnmxx-hack/actions/workflows/ci.yml/badge.svg)](https://github.com/qte77/ldnmxx-hack/actions/workflows/ci.yml)
[![CodeFactor](https://www.codefactor.io/repository/github/qte77/ldnmxx-hack/badge)](https://www.codefactor.io/repository/github/qte77/ldnmxx-hack)

## What

- **One `POST /run?usecase=<id>` endpoint** + a small `runStages` engine — swap a JSON, swap the app.
- Streams **AG-UI** SSE events that render built-in **A2UI cards** (AG Grid deferred).
- **Track B — Founder's Copilot:** describe your idea → grants matched to your stage, qualify-first.
- **Track A — On It (thin):** a step-free London route — the modularity proof, same engine + different JSON.
- **Cloudflare Worker** trust boundary · **OpenRouter** (optional in-dashboard BYOK) · **Arize** span per stage.
- Keyless demo path; secrets stay Worker-only.

<details>
<summary>Screenshots — one engine, two workflows</summary>

**Track B — Founder's Copilot** · grants matched to the idea, qualify-first gate, live AG-UI event stream.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/images/groundwork-founders-dark.png">
  <img alt="Groundwork Founder's Copilot: opportunity cards + AG-UI event stream" src="assets/images/groundwork-founders-light.png">
</picture>

**Track A — On It** · a step-free London route — same engine, different `usecase` JSON.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/images/groundwork-on-it-dark.png">
  <img alt="Groundwork On It: step-free route cards" src="assets/images/groundwork-on-it-light.png">
</picture>

</details>

## How

```bash
make help    # all targets
make dev     # worker (:8787) + ui (:5173) locally, keyless
make test    # ui + worker tests
```

Toggle the two workflows in the UI; `cd worker && npm run tail` shows one Arize span per stage.
**Demo:** <https://qte77.github.io/ldnmxx-hack/>. Full map: [`docs/plans/001-build-plan.md`](docs/plans/001-build-plan.md).

## Why

Funding discovery has no single API, and civic data (TfL ↔ council) is siloed by mandate, not tech — so
incumbents can't join it. A modular agent built in a day can, and proves it across *both* of London's
tracks from one core. See [`docs/usecase-workflows.md`](docs/usecase-workflows.md).

## Refs

- [Architecture](docs/architecture.md) · [User stories](docs/UserStory.md) ·
  [Use-case workflows](docs/usecase-workflows.md) · [Build plan](docs/plans/001-build-plan.md) ·
  [Submission](docs/submission.md) · [Design](docs/design.md) · [Demo script](docs/demo-script.md) ·
  [Resume point](docs/handoffs/003-phase1-done.md)
- Reuse base: [`qte77/agenthud-agui-a2ui`](https://github.com/qte77/agenthud-agui-a2ui) · fetcher:
  [`qte77/polyfetch-scrape`](https://github.com/qte77/polyfetch-scrape)

## License

Apache-2.0 — see [`LICENSE`](LICENSE) · third-party attribution in [`NOTICE`](NOTICE).
