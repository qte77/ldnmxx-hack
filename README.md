# Groundwork

> **The honest, free way to find the official public service you need in London — and know it's current.**
> A civic tool on a single **Cloudflare Worker**: the model paints a live **A2UI** interface (not just
> text), and *swap a JSON, swap the app*. The default UI is task-first and **civic-clean**; the AG-UI/A2UI
> dev console lives behind a **dev mode** (`?dev=1` or `Ctrl+K`).

**[▶ sortmy.london](https://sortmy.london)** · one engine, many London workflows — Sort My Care (NHS
wayfinder), Sort My Wander (free heritage + green space), Sort My Scam Check (clone-firm flag), a
founder-funding copilot, step-free routing · Londonmaxxing 003.

> The **product** is a civic wayfinder (a signpost to official services, never advice — always confirm at
> the official source): a **task-first, progressive-disclosure landing** with **Sort My Care** as the
> flagship, live at [sortmy.london](https://sortmy.london). The **engine** underneath (Groundwork) is the
> reusable asset: add a workflow by dropping in a `usecases/*.json`.

[![License](https://img.shields.io/badge/license-Apache%202.0-58f4c2.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.4.0-58f4c2.svg)](CHANGELOG.md)
[![CI](https://github.com/qte77/ldnmxx-hack/actions/workflows/ci.yml/badge.svg)](https://github.com/qte77/ldnmxx-hack/actions/workflows/ci.yml)
[![CodeQL](https://github.com/qte77/ldnmxx-hack/actions/workflows/codeql.yaml/badge.svg)](https://github.com/qte77/ldnmxx-hack/actions/workflows/codeql.yaml)
[![CodeFactor](https://www.codefactor.io/repository/github/qte77/ldnmxx-hack/badge)](https://www.codefactor.io/repository/github/qte77/ldnmxx-hack)
[![Lint](https://github.com/qte77/ldnmxx-hack/actions/workflows/lint-md-links.yml/badge.svg)](https://github.com/qte77/ldnmxx-hack/actions/workflows/lint-md-links.yml)
[![Dependabot](https://github.com/qte77/ldnmxx-hack/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/qte77/ldnmxx-hack/actions/workflows/dependabot/dependabot-updates)

## What

Groundwork is the **engine** — for **builders** who want agent apps as *config, not code*, and the
Londoners each workflow serves (founders; step-free travellers). Two pillars: a **swappable workflow
engine** (swap a JSON, swap the app — each workflow's stage choreography is a `usecases/*.json` read at
runtime; render modes stay in code) and **generative UI** (the agent streams the interface, not just
text). The two workflows below are **interchangeable examples**, selected via the `?usecase=` query
param; add your own by dropping in a `usecases/*.json`.

```text
                  ┌─ Founder's Copilot · usecase=founders-copilot
   swap usecase ──┤  one toggle, same engine
                  └─ Sort My Route · usecase=sort-my-route
                  │
                  ▼
User ─▶ UI ─▶ Workflow ─▶ Agent ─▶ Generative UI ──┐
▲       AG-UI runUsecase  OpenRtr  A2UI + HUD       │
└────────────── renders back to user ──────────────┘
```

- **The engine:** one `POST /run?usecase=<id>` + a small `runUsecase` interpreter (plan → tool → render) —
  each workflow's plan→tool→render choreography is a declarative `usecases/*.json`, selected by the
  `usecase` query param; render + deterministic query dispatch by name via the `worker/src/workflows.ts`
  registry (`founders`/`route`/`corpus`), so adding a corpus workflow is **register-only** — a
  `corpus/registry.ts` entry + a JSON + a UI entry, no engine edit (open/closed).
- **Generative UI:** the agent streams **AG-UI** events that render as built-in **A2UI cards** — it
  paints the interface, not just text (AG Grid deferred).
- **Example workflow — Founder's Copilot (flagship):** describe your idea → the model **assesses your
  stage** and **ranks matching grants** (two live model tools that stream their reasoning, #18),
  qualify-first, plus a verified incorporate how-to pack. The live Companies House filing (#12) is planned.
- **Example workflow — Sort My Route (interchange proof):** a step-free London route — same engine, one
  `usecase` away (a canned stub today; live tools are planned).
- **Civic pilot — Sort My Care:** a **deterministic** postcode → nearest-NHS-services signpost — model-free
  and fetch-free, with honest "data as of …" freshness and a "confirm with the official source" disclaimer.
  Proof that a new corpus workflow is register + a JSON, not an engine edit. `?usecase=sort-my-care`.
- **Civic — Sort My Wander:** the same deterministic corpus signpost over free heritage sites + green
  spaces near a postcode — register-only, curated Historic England link. `?usecase=sort-my-wander`.
- **Civic — Sort My Scam Check:** a firm name/FCA-reference **flag**, never a verdict — register status +
  a deterministic clone look-alike note, signposting to the FCA register. `?usecase=sort-my-scam-check`.
- Keyless demo path; secrets stay Worker-only *(stack rationale below)*.

**URL parameters** (all optional): `?usecase=<id>` selects the workflow (`founders-copilot` · `sort-my-route` ·
`sort-my-care` · `sort-my-wander` · `sort-my-scam-check`); `?theme=light|dark` forces the theme (else
system); `?dev=1` reveals the AG-UI/A2UI dev console + ⚙ Key panel (also `Ctrl+K` / `Ctrl+I`; persisted in
`localStorage`); `?demo=1` forces the Worker's deterministic path. No secret is ever read from the URL or
inlined into the SPA bundle.

<details>
<summary>Screenshot — Founder's Copilot</summary>

Grants matched to the idea, qualify-first gate, live AG-UI event stream.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/images/groundwork-founders-dark.png">
  <img alt="Groundwork Founder's Copilot: opportunity cards + AG-UI event stream" src="assets/images/groundwork-founders-light.png">
</picture>

</details>

<details>
<summary>Screenshot — Sort My Route</summary>

A step-free London route — same engine, one `usecase` away.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/images/groundwork-on-it-dark.png">
  <img alt="Groundwork Sort My Route: step-free route cards" src="assets/images/groundwork-on-it-light.png">
</picture>

</details>

## How

```bash
make help    # all targets
make dev     # worker (:8787) + ui (:5173) locally, keyless
make test    # ui + worker + ingest tests
make deploy  # build the SPA + deploy the Worker to Cloudflare
make bump    # stamp a version across ui/worker + the README badge
make demo    # boot both, then open localhost:5173 (prod: sortmy.london)
```

Toggle the two example workflows in the UI; `cd worker && npm run tail` shows one Arize span per stage.
**Demo:** <https://sortmy.london> — SPA on **Cloudflare Pages**, Worker API same-origin at `/api/*`
([deploy](docs/deploy-cloudflare.md)). Full map: [`docs/plans/001-build-plan.md`](docs/plans/001-build-plan.md).

**Data pipeline (keyless, arc 016):** a weekly GitHub Action ([`ingest.yml`](.github/workflows/ingest.yml),
`GITHUB_TOKEN` only) runs the pure, pytest-covered parsers ([`ingest/`](ingest/README.md)) over five
keyless OGL sources and publishes normalised artifacts to the rolling
[`corpus-data` release](https://github.com/qte77/ldnmxx-hack/releases/tag/corpus-data); the Worker's
**daily cron** (04:47 UTC) ingests them into **D1** behind a swap gate (min-rows + licence-attribution) —
and every corpus degrades to its bundled sample whenever D1 is unbound, failing, or not yet swapped.

**Switches:** `?usecase=founders-copilot|sort-my-route|sort-my-care|sort-my-wander|sort-my-scam-check` picks the
workflow (`sort-my-care`/`sort-my-wander`/`sort-my-scam-check` are deterministic — model-free + fetch-free)
· a **Demo⇄Live toggle** in the header
(or `?demo=1`) forces the keyless deterministic stub even with a model key set — the events header then
shows an honest chip (`LIVE · <model> · ~N tok` / `DEMO · deterministic` / `STUB · fell back`) · `?theme=light|dark`
overrides the theme · BYOK sends `Authorization: Bearer <key>` to the Worker instead of its server-side key.

## Why

One engine, many workflows — each a `usecases/*.json` selected via the `usecase` query param. Two examples prove it: funding
discovery (no single API) and civic routing (TfL ↔ council data siloed by mandate, not tech). A modular
agent built in a day joins what incumbents can't, and swaps between both from one core. See
[`docs/usecase-workflows.md`](docs/usecase-workflows.md).

## Stack — why these tools

- **Cloudflare** (Workers · Pages · Workers AI · D1) — one serverless edge deploy, zero-ops; the Worker is
  the **trust boundary** (secrets server-side, sole egress). Workers AI serves the keyless free render
  chain; the **D1 corpus store** (fed by the daily ingest cron, bundled-sample fallback) + `data/demo/*.json`
  are the data sources (no KV; AI Gateway dormant, #29).
- **OpenRouter** — one key, many models. A BYOK key swaps the model with no code change; keyless runs use a
  **free chain** (Workers AI → OpenRouter `:free` → stub; the GitHub Models tier was dropped ahead of its
  2026-07-30 retirement, #132), so the Worker rarely/never spends.
- **Arize** — LLM tracing: one span per stage (`plan → tool → render`), exported to Arize over **OTLP** when
  `ARIZE_API_KEY`+`ARIZE_SPACE_ID` are set (console otherwise); browser spans forward via `POST /trace`.

## Refs

- [Architecture](docs/architecture.md) · [User stories](docs/UserStory.md) ·
  [Use-case workflows](docs/usecase-workflows.md) · [Glossary](docs/glossary.md) ·
  [Data sources](data/sources.json) · [Usecase catalog](data/usecase-catalog.json) ·
  [Design](docs/design.md) · archived (historical): [submission](docs/archive/submission.md),
  [demo script](docs/archive/demo-script.md)
- Reuse base: [`qte77/agenthud-agui-a2ui`](https://github.com/qte77/agenthud-agui-a2ui) · fetcher:
  [`qte77/polyfetch-scrape`](https://github.com/qte77/polyfetch-scrape)

## License

Apache-2.0 — see [`LICENSE`](LICENSE) · third-party attribution in [`NOTICE`](NOTICE).
