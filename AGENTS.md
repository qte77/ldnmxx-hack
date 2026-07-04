# AGENTS.md — ldnmxx-hack

Operating rules for agents (single source of truth; `CLAUDE.md` points here).

## What this is

Modular **AG-UI/A2UI** hackathon app on a **Cloudflare Worker** (Londonmaxxing 003, Sat 4 Jul 2026).
- Build plan + source map: `docs/plans/001-build-plan.md`
- Resume point: latest `docs/handoffs/NNN-*.md` · Design: `docs/design.md` · Demo: `docs/demo-script.md`
- **This repo (`ldnmxx-hack`) is the SSOT** — the sibling `qte77/ldnmxx` is read-only **archival
  deep-reference** only (do not edit it or treat it as canonical).
- Architecture: `docs/architecture.md` · Use cases: `docs/usecase-workflows.md`

## Conventions

- **Clean root.** Runnable code in self-contained subdirs: `ui/` (SPA), `worker/` (CF Worker),
  `ingest/` (Python). Data in `data/`; stage defs in `usecases/`. No root `package.json`/`pyproject`.
- **Cloudflare Workers**, not *Workflows*. Stage defs are **JSON**, read at runtime by a ~60-LOC
  `runStages`. One `/run?usecase=<id>` endpoint.
- Thin **`Makefile`** is the only cross-language launcher — `make help`. Tests external to `src/`.
- **Reuse**, don't rebuild: base = `qte77/agenthud-agui-a2ui`; fetcher = `qte77/polyfetch-scrape`.

## Workflow

- **Plan mode before implementing** · **strict TDD** (tests first for load-bearing *modules*, not glue or
  one-shot scripts) · **lint + security** gate (gitleaks + Semgrep).
- Branch per topic → Conventional Commits (`.gitmessage`) → CI-gated PR → prune.
- Identity: GitHub **noreply only** (`qte77` / `93844790+qte77@users.noreply.github.com`); `--no-gpg-sign`;
  prefix git/gh with `env -u GH_TOKEN -u GITHUB_TOKEN`.
- **Secrets** (OpenRouter / Arize / ElevenLabs / Companies House) are **Worker secrets only** — never in
  code or the SPA bundle.
- **Scraped data is ToU-gated** → `data/real/` gitignored; only synthetic `data/demo/` is committed.

## Decisions locked

- **AG Grid deferred** → render built-in A2UI cards (Column/Card/Text). **A2UI/AG-UI are the protocol
  stack, NOT sponsors.**
- Sponsors: Cloudflare · OpenRouter · Arize · AG Grid (deferred) · ElevenLabs (stretch) · TRMNL (opt).
