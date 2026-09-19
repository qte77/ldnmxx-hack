---
title: "ADR 0007 — MCP server: deterministic tool wrappers, same Worker, 4 of 6 usecases"
status: accepted
date: 2026-09-19
---

# ADR 0007 — MCP server: deterministic tool wrappers, same Worker, 4 of 6 usecases

## Status

**Accepted** (2026-09-19), shipping with **plan 025** ("Agent-native surface: a real MCP server").
Extends [ADR 0003](0003-no-agent-framework.md) — does not reopen it.

## Context

`agent-readiness-kit`'s scan of sortmy.london (23/F baseline, [issue #305](https://github.com/qte77/ldnmxx-hack/issues/305))
flagged a missing MCP server as the largest deferred item after the safe quick wins (PRs #315/#316)
shipped. Sibling repo `sfclarity` has a working reference implementation
(`workers/mcp-server/` — a separate Cloudflare Worker, hand-rolled JSON-RPC 2.0, no SDK) and its own
plan (`docs/plans/0047-*.md`) reasoning through the same problem independently. Three questions need
settling before any code is written:

1. Does adding an MCP server reopen ADR 0003's "no agent framework" decision?
2. Same Worker (new route) or a separate Worker (own `wrangler.toml`, own subdomain), matching
   sfclarity's choice?
3. How many of the 6 `shared/usecaseCatalog.ts` entries get an MCP tool?

## Decision

**1. ADR 0003's scope extends to MCP tools; it is not reopened.** Every MCP tool wraps an EXISTING
deterministic query function (`corpus/query.ts`, `scam/query.ts`) — no LLM call inside a tool
handler, ever. `tools/call` is a thin adapter, not a second agent loop. If a future session wants a
tool to route through a model call, that needs its own ADR revisiting 0003/0007, not a quiet addition
inside a handler.

**2. Same Worker, new route (`POST /api/mcp`) — default.** sfclarity's separate-Worker pattern is a
legitimate reference for the JSON-RPC dispatch *shape*, but ldnmxx-hack's own `worker.ts` already
does route-based dispatch inside one Worker (`/api/run`, `GET /api/freshness`, `POST /api/trace`).
Adding `/api/mcp` as a fourth route avoids a second `wrangler.toml`, a second deploy step, and a
second DNS/zone route the owner would need to provision before anything is agent-executable.
sfclarity's separate-Worker choice makes sense for its own repo (no sibling `/api/*` routes to be
consistent with); ldnmxx-hack has that convention already, so it wins here. This is a stated default,
not a permanent constraint — a future session may choose a separate Worker if a concrete reason
emerges (e.g. independent scaling/rate-limit isolation), but that is a discussion to have explicitly,
not a silent switch.

**3. Four tools, not six.** `sort-my-care`, `sort-my-wander`, `sort-my-food-hygiene`, and
`sort-my-scam-check` are real, deterministic, corpus/scam-backed usecases and each gets an MCP tool.
`founders-copilot` and `sort-my-route` are excluded: per [ADR 0004](0004-query-driven-auto-routing.md)
neither carries `keywords` (both are the two usecases never auto-routed), `sort-my-route` is a canned
stub with no real backing data, and `founders-copilot` needs live model backing to mean anything. The
same "never fabricate, never present a demo as real" discipline already applied to `auth.md` and the
Scam Check sample-data label applies here: an MCP client calling a stub tool and getting fabricated
output would be worse than the tool not existing. The filter is mechanical, not hand-listed:
`shared/usecaseCatalog.ts` entries where `keywords.length > 0` — the same predicate
`ui/src/screens/Home.tsx`'s `ROUTABLE` const already uses for "auto-routable," which happens to be
exactly the "real, not-demo" set too.

## Consequences

**Plus.** No new dependency (hand-rolled JSON-RPC 2.0, mirroring sfclarity — no
`@modelcontextprotocol/sdk`), no second Worker/deploy/DNS surface, no bundle growth from an agent
framework. MCP tool handlers reuse the exact same query path the SPA already exercises, so there is
no second data-correctness surface to keep in sync. The 4-of-6 filter means the endpoint can never
return a canned or model-dependent result as if it were a real lookup.

**Minus.** `founders-copilot` and `sort-my-route` stay MCP-invisible even though they're listed in
the catalog and reachable from the UI — an agent client discovering tools via `tools/list` will not
learn those two exist at all. This is intentional (see the "never fabricate" reasoning above), but it
means the MCP surface is narrower than the human-facing app; if either usecase later gets real
backing data, this ADR's filter automatically includes it (mechanical predicate, not a hand-maintained
list) and no ADR update is needed for that specific expansion.

**Revisit trigger.** If a future arc gives `founders-copilot` or `sort-my-route` real keywords/backing
data, the tool count changes automatically — no revisit needed. If a concrete reason emerges to split
the MCP endpoint into its own Worker (independent scaling, a rate-limit shape that conflicts with the
SPA's `RATE_LIMITER`, or a separate deploy cadence), reopen the "same Worker" decision explicitly
rather than drifting into it. If a tool handler is ever tempted to call a model, that is out of this
ADR's scope and needs a new ADR revisiting 0003.
