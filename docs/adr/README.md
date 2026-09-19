# Architecture Decision Records

Index of every ADR for `ldnmxx-hack` (newest first for open questions; numbers are chronological).
Each row links to the full record — this file is an index, not a summary that can drift from it.

| # | ADR | Status | One-liner |
|---|---|---|---|
| [0007](0007-mcp-server-deterministic-tools.md) | MCP server: deterministic tool wrappers | accepted | Extends [0003](0003-no-agent-framework.md)'s no-agent-framework scope to MCP tools; `/api/mcp` on the existing Worker, not a second one; 4 of 6 usecases get a tool (the 2 non-real/never-routed ones excluded). |
| [0006](0006-civic-navy-red-palette.md) | Civic navy/red palette, serif type, tab-based shell | accepted | Supersedes [0005](0005-project-owned-theme.md). One sourced navy/red palette (light+dark, verbatim from the design), Cormorant Garamond + Lora, tab-based Home/Settings shell replacing the single-page layout. |
| [0005](0005-project-owned-theme.md) | Project-owned theme | superseded | Superseded by [0006](0006-civic-navy-red-palette.md) — the fo Linear neutrals + 3 accent variants are gone from `tokens.css`. Its "project owns its theme, never re-vendor `qte77/brand`" principle still holds. |
| [0004](0004-query-driven-auto-routing.md) | Query-driven auto-routing | accepted | One free-text input replaces the manual usecase switcher; hybrid heuristic-first classifier resolves the workflow, with a `?usecase=` bypass and a no-match card. |
| [0003](0003-no-agent-framework.md) | No agent framework | accepted | Every model call (assess/search stages, intent classifier, and now MCP tools) stays a single forced-tool-call with zod-validated structured output — no Pydantic-AI/Vercel AI SDK/Cloudflare Agents SDK adopted. |
| [0002](0002-real-data-store.md) | Real-data store | accepted | Supersedes 0001 §4's data-store question: read-through Cloudflare D1 + licence-gated self-serve ingest, not a live third-party fetch per request. |
| [0001](0001-general-workflow-engine.md) | General workflow engine | accepted | Registry + per-workflow contracts + pre-generated corpora, so each new civic usecase (Care, Wander, …) is a data/config addition, not a new branch in the Worker's core loop. |

## Reading order for a new session

Read **0003** and **0004** first — they govern how every request is routed and every model call is
shaped, and every later ADR either extends or assumes them. **0001**/**0002** govern the data layer
underneath all of that. **0005**→**0006** is a superseded/superseding pair — read 0006 for the
current palette, 0005 only for the "why we don't re-vendor the theme" reasoning it established.
**0007** is the newest and narrowest in scope (MCP tool surface only).

## Adding a new ADR

Next number is **0008**. Add the file under `docs/adr/`, then add its row here in the same PR — this
index is not auto-generated, so an ADR merged without a row here is incomplete. If the new ADR
supersedes an existing one, update that ADR's own `## Status` section (see 0005 for the pattern) and
this table's `Status` column together.
