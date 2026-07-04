# Groundwork

> **One AG-UI/A2UI workflow engine** on a **Cloudflare Worker** — *swap a JSON, swap the app.*
> Two London workflows, one core. Built for **Londonmaxxing 003** (Sat 4 Jul 2026).

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](CHANGELOG.md)
[![CI](https://github.com/qte77/ldnmxx-hack/actions/workflows/ci.yml/badge.svg)](https://github.com/qte77/ldnmxx-hack/actions/workflows/ci.yml)
[![CodeFactor](https://www.codefactor.io/repository/github/qte77/ldnmxx-hack/badge)](https://www.codefactor.io/repository/github/qte77/ldnmxx-hack)

## What

Groundwork is the **engine** — for **builders** who want agent apps as *config, not code*, and the
Londoners each workflow serves (founders; step-free travellers). Two pillars: a **swappable workflow
engine** (swap a JSON, swap the app) and **generative UI** (the agent streams the interface, not just
text). The two workflows below are **interchangeable examples** — add your own by dropping in a
`usecases/*.json`.

```text
              ┌─ Founder's Copilot · founders-copilot.json
   swap JSON ─┤  one toggle, same engine
              └─ On It · on-it.json
              │
              ▼
User ─▶ UI ─▶ Workflow ─▶ Agent ─▶ Generative UI ──┐
▲       AG-UI runStages   OpenRtr  A2UI + HUD       │
└────────────── renders back to user ──────────────┘
```

- **The engine:** one `POST /run?usecase=<id>` + a small `runStages` loop (plan → tool → render) —
  each workflow is one declarative `usecases/*.json`, swapped live with no new app.
- **Generative UI:** the agent streams **AG-UI** events that render as built-in **A2UI cards** — it
  paints the interface, not just text (AG Grid deferred).
- **Example workflow — Founder's Copilot (flagship):** describe your idea → grants matched to your
  stage, qualify-first → verified steps to incorporate.
- **Example workflow — On It (interchange proof):** a step-free London route — same engine, one JSON away.
- Keyless demo path; secrets stay Worker-only *(stack rationale below)*.

<details>
<summary>Screenshot — Founder's Copilot (Track B)</summary>

Grants matched to the idea, qualify-first gate, live AG-UI event stream.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/images/groundwork-founders-dark.png">
  <img alt="Groundwork Founder's Copilot: opportunity cards + AG-UI event stream" src="assets/images/groundwork-founders-light.png">
</picture>

</details>

<details>
<summary>Screenshot — On It (Track A)</summary>

A step-free London route — same engine, one `usecase` away.

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

Toggle the two example workflows in the UI; `cd worker && npm run tail` shows one Arize span per stage.
**Demo:** <https://qte77.github.io/ldnmxx-hack/>. Full map: [`docs/plans/001-build-plan.md`](docs/plans/001-build-plan.md).

## Why

One engine, many workflows — each a JSON. Two examples prove it: funding discovery (no single API) and
civic routing (TfL ↔ council data siloed by mandate, not tech). A modular agent built in a day joins what
incumbents can't, and swaps between both from one core. See [`docs/usecase-workflows.md`](docs/usecase-workflows.md).

## Stack — why these tools

- **Cloudflare** (Workers · Pages · KV · AI Gateway) — one serverless edge deploy, zero-ops; the Worker is
  the **trust boundary** (secrets server-side, sole egress), KV caches data, AI Gateway fronts the LLM.
- **OpenRouter** — one key, many models; route or swap the LLM with no code change (optional BYOK) — the
  "swap a JSON" idea, applied to models.
- **Arize** — LLM tracing: one span per stage makes `plan → tool → render` observable, debuggable, provable.

## Refs

- [Architecture](docs/architecture.md) · [User stories](docs/UserStory.md) ·
  [Use-case workflows](docs/usecase-workflows.md) · [Build plan](docs/plans/001-build-plan.md) ·
  [Submission](docs/submission.md) · [Design](docs/design.md) · [Demo script](docs/demo-script.md) ·
  [Resume point](docs/handoffs/003-phase1-done.md)
- Reuse base: [`qte77/agenthud-agui-a2ui`](https://github.com/qte77/agenthud-agui-a2ui) · fetcher:
  [`qte77/polyfetch-scrape`](https://github.com/qte77/polyfetch-scrape)

## License

Apache-2.0 — see [`LICENSE`](LICENSE) · third-party attribution in [`NOTICE`](NOTICE).
