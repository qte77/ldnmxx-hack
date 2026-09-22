---
title: "Agent-native surface: a real MCP server + the remaining agent-readiness backlog"
type: plan
status: "rows 1-6 shipped (through e2e verification, incl. an honest local-sweep FAIL, not a regression - see row 6); rows 7-9 not started (2026-09-22)"
refs:
  - docs/adr/0003-no-agent-framework.md (this arc EXTENDS its scope to the MCP server, does not reopen it)
  - docs/handoffs/024-app-shell-redesign.md (arc 024 status — design/perf/dependency work, separate concern)
  - github.com/qte77/ldnmxx-hack/issues/305 (agent-readiness deferred-items tracker — this arc closes several of its rows)
  - github.com/qte77/agent-readiness-kit/issues/25 (external remediation tracker, comment-only, never edit its body — bot-owned)
  - "/workspaces/sfsanity/sfclarity/workers/mcp-server/ (reference implementation — read before writing worker/src/mcp/*)"
  - "/workspaces/sfsanity/sfclarity/docs/plans/0047-agent-native-surface-and-backlog.md (sfclarity's own plan for the same problem — read its §Explicitly declined section)"
  - docs/adr/0007-mcp-server-deterministic-tools.md (this arc's own ADR, row 1 — extends ADR 0003 to MCP tools, same-Worker default, 4-of-6 usecase filter)
---

# Plan 025 — Agent-native surface: MCP server + remaining backlog

## Handoff (read this first)

**Status: rows 1-6 shipped** — row 1 (ADR 0007, PR [#319](https://github.com/qte77/ldnmxx-hack/pull/319)),
rows 2-3 (JSON-RPC dispatch + 4 tool wrappers, PR [#320](https://github.com/qte77/ldnmxx-hack/pull/320)),
row 4 (server-card.json, PR [#322](https://github.com/qte77/ldnmxx-hack/pull/322)), row 5 (discovery
cross-links, PR [#326](https://github.com/qte77/ldnmxx-hack/pull/326)), row 6 (e2e verification, PR
[#328](https://github.com/qte77/ldnmxx-hack/pull/328) — a new live HTTP contract test for `/api/mcp`,
PASS; the local UI sweep recorded an honest FAIL, confirmed to be a pre-existing local-sample-data gap,
**not** a regression from this arc or 026 — see the PR for the full investigation). Rows 7-9 not
started, next is row 7 (docs & issues sync). Everything below was scoped
across a single long
session (2026-09-18/19) that (a) shipped the "safe quick wins" tier already (PRs #315, #316 — llms.txt,
JSON-LD, api-catalog, agent-skills index, auth.md, markdown twin, AGENTS.md link, RFC 8288 Link headers,
sitemap lastmod), raising sortmy.london off its 23/F baseline, and (b) explored two sibling repos
(`agent-readiness-kit`, `sfclarity`) to ground every decision below in either a working reference
implementation or an independently-reached, matching design decision — nothing here is a guess.

**What's next, in order:**
1. **P0 (serial, one worktree)** — ADR 0007 (the architecture decision this whole arc rests on: write it
   FIRST, not last, so P1's implementation has something to point at instead of re-deriving the reasoning
   mid-code). Row 1.
2. **P1 (serial after P0, one worktree)** — the MCP endpoint itself: JSON-RPC 2.0 dispatch added as a NEW
   route on the EXISTING `worker/src/worker.ts` (not a second Worker — see "Same-Worker vs.
   separate-Worker" below), wrapping the 4 real deterministic lookups already in `corpus/query.ts` +
   `scam/query.ts`. Rows 2–4. Nothing here can run in parallel with itself (one file, `worker.ts`, gets
   touched by all three rows) — keep it serial.
3. **P2 (parallel, up to 2 worktrees)** — discovery surface (server-card.json + llms.txt/agent-skills
   cross-links) and the e2e verification suite can run concurrently once P1 is merged, since they touch
   disjoint files (`ui/public/*` vs `tests/e2e/*` + a new `worker/test/mcp/*`). Rows 5–6.
4. **P3 (serial, after P2, mostly docs)** — CHANGELOG/README/architecture.md/issue-tracker sync. Row 7.
5. **P4 (owner)** — deploy + rescan. Rows 8–9.

**The loop:** for each row in "Remaining work" — read its done-when, do the work on its own
branch/worktree, run its verify commands, open a CI-gated PR, squash-merge on green (standing
authorization, `workflow-preferences` memory — use `gh api --method PUT .../merge -f merge_method=squash`,
NOT `gh pr merge --admin`, which is reliably blocked by this environment's auto-mode classifier), strike
the row in the SAME PR.

**Owner gates:** only rows 8–9 (deploy + rescan) — this devcontainer's `CLOUDFLARE_API_TOKEN` (repo-root
`.env`) is valid as of 2026-09-19 (confirmed via `wrangler whoami`) and CAN deploy locally via
`bash scripts/provision_cf.sh`, but a production push is still a deliberate checkpoint each time per this
session's established pattern — confirm with the user before running it, don't treat prior deploy
authorization as standing.

**Commands:** `cd worker && npm run lint && npm run typecheck && npm test`; new MCP-specific tests live
under `worker/test/mcp/*.test.ts` (mirror the existing `worker/test/` layout, don't invent a new one).
Repo-wide gate unchanged from arc 024's plan: `cd ui && npm run lint && npm run typecheck && npm test &&
npm run build && npm run size`; root `ruff check && uvx pytest -q ingest`. actionlint on any workflow
file touched.

**Watch-outs (do NOT relearn these):**
- **This is NOT a new agent framework.** ADR 0003 already settled "no agent framework, one forced
  tool-call, deterministic output" for the WHOLE app (2026-07-23) — this arc's ADR 0007 explicitly
  extends that scope to the MCP server's tools, it does not reopen the question. Every MCP tool wraps an
  EXISTING deterministic query function (`corpus/query.ts`, `scam/query.ts`) — no LLM call inside a tool
  handler, ever. If a future session is tempted to make a tool "smarter" by routing it through a model
  call, that's out of scope for this arc and needs its own ADR revisiting 0003/0007, not a quiet addition
  here.
- **Only 4 tools, not 6.** The usecase catalog has 6 entries, but `founders-copilot` and `sort-my-route`
  are the two never-auto-routed demo flows (ADR 0004 — no `keywords`, no real backing data,
  `sort-my-route` is a canned stub, `founders-copilot` needs live model backing to mean anything). Expose
  MCP tools ONLY for the 4 real, deterministic, corpus/scam-backed usecases (`sort-my-care`,
  `sort-my-wander`, `sort-my-food-hygiene`, `sort-my-scam-check`) — same "never fabricate, never present
  a demo as real" discipline this repo has enforced all session (see auth.md, the Scam Check
  sample-data label). Do not add the other 2 "for completeness."
- **Same-Worker vs. separate-Worker — read before starting row 2.** sfclarity built its MCP server as a
  SEPARATE Cloudflare Worker (`workers/mcp-server/`, its own `wrangler.toml`, own `*.workers.dev`
  subdomain) — a legitimate pattern, and a real working reference to copy the JSON-RPC dispatch shape
  from. But ldnmxx-hack's OWN existing architecture already does route-based dispatch inside ONE Worker
  (`worker.ts`'s `resolveTarget` already serves `/api/run`, `GET /api/freshness`, `POST /api/trace`) —
  adding `/mcp` as a fourth route on the SAME Worker avoids a second `wrangler.toml`, a second deploy
  step, and (most importantly) a second DNS/zone route that would need the OWNER to provision before
  anything is agent-executable. **Default: same Worker, new route.** This is a real architecture choice
  with a stated default (per the "decide-by-default" convention) — if a future session disagrees, that's
  a discussion, not a silent switch; document why in the PR if you deviate.
- **A2A, WebMCP, OAuth-discovery docs, Web Bot Auth, NLWeb — all explicitly OUT of this arc's scope**,
  each already declined with reasoning matching sfclarity's own independent conclusions (see
  `github.com/qte77/ldnmxx-hack/issues/305`'s "Declined" and "Deferred" sections — read it before
  re-litigating any of these). Building any of them is a scope violation of this plan, not a bonus.
- **`ldnmxx-hack#305` is a real, hand-maintained tracking issue (not bot-owned) — update it as rows
  close.** `agent-readiness-kit#25` IS bot-owned (auto-rewritten by that repo's `scan.yml` on every scan)
  — never edit its body, only comment on it (see the 2026-09-19 comment already there for the exact
  pattern to follow for future updates).
- Bash denies `ls`/`find`/`grep`/`cat`/`head`/`tail`/`awk` by command name regardless of flags — use
  Read/Glob/Grep tools or `python3 -c "..."`. `env -u GH_TOKEN -u GITHUB_TOKEN git/gh ...` is the
  allowlisted, working pattern from the MAIN session — but a prior worktree-isolated subagent this
  session found that same pattern blocked inside a worktree by the `rtk-rewrite.sh` hook
  ("cannot verify worktree-safety") and worked around it with inline `GH_TOKEN= GITHUB_TOKEN= git ...`
  instead of stopping to report the block — **do not repeat that.** If a worktree agent hits this same
  block, it must stop and report it, not find a syntactic bypass (feedback on this was filed this
  session; check whether it's been addressed before assuming the workaround is still needed).

## Source map

### The reference implementation (read this before writing any MCP code)

`/workspaces/sfsanity/sfclarity/workers/mcp-server/` — a real, deployed Cloudflare Worker:
hand-rolled JSON-RPC 2.0 (no SDK — `@modelcontextprotocol/sdk` was deliberately not used; read
sfclarity's own `docs/plans/0047-*.md` for why if curious, don't re-derive it), `initialize` /
`tools/list` / `tools/call` methods, 2 read-only tools (`search_events`, `get_event`), unauthenticated,
CORS `*`, rate-limited via the Workers-native `ratelimits` binding (the SAME binding mechanism
`worker/wrangler.toml` already uses for `RATE_LIMITER` in ldnmxx-hack — copy the pattern, not the code).
A third sibling repo, `/workspaces/qte77/2026-08-26-AgentNativeHack-FT-CF-SF/src/mcp.ts`, is sfclarity's
own cited "canonical reference" for this shape — worth a second read if sfclarity's version raises
questions.

### ldnmxx-hack files this arc touches

- `worker/src/worker.ts` — `resolveTarget`/route dispatch (currently `/api/run`, `GET /api/freshness`,
  `POST /api/trace`) gets a fourth route, `POST /mcp` (or `/api/mcp` — pick one and stay consistent with
  the existing `/api/*` prefix convention already used for everything else on this Worker; recommend
  `/api/mcp` for that consistency, though sfclarity's own choice was root-level `/` on its OWN worker
  since it has no sibling routes to be consistent with — ldnmxx-hack does, so match its own convention).
- `worker/src/corpus/query.ts`, `worker/src/scam/query.ts` — the EXISTING deterministic query functions
  each MCP tool wraps. Read `docs/architecture.md`'s "One core, three seams" section first for how these
  already compose (`query_corpus`/`query_scam` execs, `CorpusRow`/`CorpusSource` seam, D1-vs-bundled
  fallback, bbox-bounded reads) — an MCP tool handler is a thin adapter over these, not a new query path.
- `shared/usecaseCatalog.ts` — the 6-entry catalog; filter to the 4 real usecases
  (`u.keywords.length > 0` already IS this filter — it's the same expression `ui/src/screens/Home.tsx`'s
  `ROUTABLE` const uses for "auto-routable", which happens to be exactly the "real, not-demo" set too;
  reuse that predicate, don't hand-list 4 ids).
- New: `worker/src/mcp/{dispatch,tools,server-card}.ts` (or similar — name to match this repo's existing
  module-per-concern style, e.g. `corpus/{registry,query,render}.ts`'s pattern) + `worker/test/mcp/*.test.ts`.
- `ui/public/.well-known/agent-skills/index.json`, `ui/public/llms.txt` — already exist (PR #315/#316),
  need a cross-link added once the MCP endpoint is live (both files are small, hand-edit, no codegen).
- `ui/public/.well-known/mcp/server-card.json` — NEW, or served by the Worker itself at
  `/.well-known/mcp/server-card.json` if that route can be added to the SAME Worker (check whether
  `/.well-known/*` on the Pages domain already resolves to the Worker's route or to Pages' static
  file serving — `worker/wrangler.toml`'s route is `sortmy.london/api/*` only, so `/.well-known/mcp/
  server-card.json` would currently hit Pages, not the Worker; either widen the route or serve it as a
  static file listing `/api/mcp` as the `serverUrl` — decide when you get to row 5, don't guess now).
- `docs/adr/0007-*.md` — new (slug TBD by the agent, e.g. `0007-mcp-server-deterministic-tools.md`).
- `docs/architecture.md` — "Stack"/"Platform notes" sections need one paragraph once shipped (follow the
  existing terse, cross-referenced style — don't write a new prose block that duplicates the ADR).
- `CHANGELOG.md` — `## [Unreleased]` is currently empty, ready for this arc's entries.
- `tests/e2e/ui_sweep.py` — the existing Patchright UI regression suite (locally AND against the remote
  deploy per this repo's own `unattended-execution.md` convention) — this arc's row 6 EXTENDS its
  viewport/device-emulation/click-and-verify coverage per the explicit ask below; it does NOT need a new
  file, extend the existing one. A SEPARATE new script (or `worker/test/mcp/*.test.ts` if plain HTTP
  assertions suffice — an MCP JSON-RPC endpoint has no DOM, so Patchright is only relevant for confirming
  the EXISTING UI didn't regress, not for testing the MCP endpoint itself, which is a raw HTTP contract
  test) covers the JSON-RPC contract (`initialize`/`tools/list`/`tools/call`, CORS headers, rate-limit
  behaviour, error shapes).

## E2E verification requirement (explicit user ask — applies to row 6)

Per direct instruction this session: use **polyfetch + its Patchright Chromium** for e2e UI tests, **both
locally and against the remote deploy**. Vary the **viewport and device emulation**; **click buttons,
dropdowns, and other interactive elements** to verify functionality AND appearance, not just render
presence. Take **screenshots and (opt-in) videos in both horizontal and vertical orientation**. Use
Patchright/Chromium **devtools** — capture **console errors** (fail the run on app console errors) and
failed network requests. This governs how row 6 extends `tests/e2e/ui_sweep.py` for the EXISTING UI
regression pass (the MCP server itself has no UI/DOM — it gets a plain HTTP JSON-RPC contract test
instead, see the source-map note above; don't try to "Patchright" a JSON-RPC endpoint).

## Docs & issues audit requirement (explicit user ask — applies to row 7)

Per direct instruction this session, every milestone in this arc checks: does CHANGELOG / root README /
`docs/architecture.md` / an ADR / a roadmap or userstory doc (`docs/UserStory.md` exists here — no
separate "roadmap" doc exists in this repo, don't invent one) need updating? Is every new URL
(`/api/mcp`, `/.well-known/mcp/server-card.json`), env var, and CLI switch documented (this repo's
convention is inline in README's "Stack" section + CHANGELOG, not a separate table — match that, don't
add a new doc structure)? Do issues need opening/updating/closing (`ldnmxx-hack#305`'s "Deferred" section
has the exact rows this arc should strike; `agent-readiness-kit#25` gets a comment, never a body edit)?

## Remaining work

| # | Item | Gate | Done-when |
|---|---|---|---|
| 1 | ✅ shipped (PR [#319](https://github.com/qte77/ldnmxx-hack/pull/319)) — **P0 — ADR 0007**: write `docs/adr/0007-*.md` extending ADR 0003's "no agent framework" scope explicitly to MCP tools; document the same-Worker-vs-separate-Worker decision (default: same Worker) and the 4-tools-not-6 decision, both with the reasoning already captured in this plan's Handoff section (don't re-derive, cite/summarize). | agent | ADR merged; cross-linked from this plan's `refs` frontmatter (already done) and from row 2's PR description. |
| 2 | ✅ shipped (PR [#320](https://github.com/qte77/ldnmxx-hack/pull/320)) — **P1 — JSON-RPC dispatch**: add `POST /api/mcp` to `worker/src/worker.ts`'s route dispatch; `initialize` + `tools/list` (returns the 4 real tools' name/description/inputSchema, derived from `shared/usecaseCatalog.ts`'s routable-and-real subset) + `tools/call` (dispatches to the 4 wrapper functions below). Hand-rolled JSON-RPC 2.0, no new dependency (mirrors sfclarity — no `@modelcontextprotocol/sdk`). CORS `*` (public, unauthenticated, matches this app's "no account" ethos). | agent | `worker/test/mcp/dispatch.test.ts` (RED-first) covers `initialize`/`tools/list`/`tools/call` + malformed-request error shapes; `cd worker && npm run lint && npm run typecheck && npm test` green. |
| 3 | ✅ shipped (PR [#320](https://github.com/qte77/ldnmxx-hack/pull/320)) — **P1 — 4 tool wrappers**: one per real usecase, each a thin adapter calling the EXISTING `corpus/query.ts` (`sort-my-care`, `sort-my-wander`, `sort-my-food-hygiene`) / `scam/query.ts` (`sort-my-scam-check`) functions — no new query logic, no D1/fallback changes. Rate-limited via a NEW `ratelimits` binding added to `worker/wrangler.toml` (separate limit from `RATE_LIMITER`, since MCP callers are a different traffic shape than the SPA — pick a starting limit, e.g. 20/60s matching the existing one, adjust later if real traffic says otherwise). | agent | Same test file as row 2 covers all 4 tools' happy-path + empty-result shapes; a manual `curl -X POST /api/mcp` (or the Patchright-adjacent plain-HTTP check, local `wrangler dev`) round-trips one real query end-to-end. |
| 4 | ✅ shipped (PR [#322](https://github.com/qte77/ldnmxx-hack/pull/322)) — **P1 — `/.well-known/mcp/server-card.json`**: decide (per the source-map note) whether this is Worker-served or a static Pages file; publish it either way with real `name`/`description`/`version`/`serverUrl`/`tools[]` matching row 2/3's actual implementation, not aspirational copy. | agent | `curl https://sortmy.london/.well-known/mcp/server-card.json` (once deployed) returns valid JSON matching the MCP server-card schema; `tools[]` lists exactly the 4 real tools. |
| 5 | ✅ shipped (PR [#326](https://github.com/qte77/ldnmxx-hack/pull/326)) — **P2 — discovery cross-links**: add the MCP endpoint to `ui/public/llms.txt` and `ui/public/.well-known/agent-skills/index.json` (each real skill entry gains an `mcp_tool` or equivalent cross-reference — check the agent-skills-index convention for how it expects this, don't invent a field name unilaterally if the spec has one). | agent | Both files still validate (JSON syntax for the index, plain-text convention for llms.txt) and reference the real, now-live `/api/mcp` path. |
| 6 | ✅ shipped (PR [#328](https://github.com/qte77/ldnmxx-hack/pull/328)) — **P2 — e2e verification**: extend `tests/e2e/ui_sweep.py` per the "E2E verification requirement" section above (viewport/device variation, click-through, screenshots+video both orientations, console-error + failed-network-request capture, run against BOTH `npm run preview` locally AND the remote `https://sortmy.london` once deployed) to confirm the existing UI has zero regression from this arc's Worker changes; separately, a plain-HTTP contract test (new script or `worker/test/mcp/*.test.ts` if sufficient) exercises the deployed `/api/mcp` JSON-RPC endpoint for real (not just local `wrangler dev`). | agent | Local sweep PASS; a documented (in the PR body) live-deploy sweep PASS once row 8 ships; MCP contract test PASS against the real deployed URL. |
| 7 | **P3 — docs & issues sync**: `CHANGELOG.md` `## [Unreleased]` entry for this arc; `docs/architecture.md` one-paragraph addition (Stack/Platform notes); strike the "MCP server" row in `ldnmxx-hack#305`'s "Deferred" section with this arc's PR numbers; comment (not edit) on `agent-readiness-kit#25` once deployed, matching the 2026-09-19 comment's pattern. | agent | All four artifacts updated in the closing PR(s) of this arc; no orphaned "TODO" left in any of them. |
| 8 | **P4 — deploy**: `bash scripts/provision_cf.sh` (local deploy — this devcontainer's `.env` `CLOUDFLARE_API_TOKEN` is valid as of 2026-09-19) or the `deploy.yml` GitHub Actions path — either is fine, but confirm with the user first regardless of any prior-session deploy authorization; production pushes are a standing per-instance checkpoint, not blanket-authorized. | **owner** | Live site verified serving the new `/api/mcp` route + server-card.json (independent verification via curl/Patchright, not just trusting the deploy script's exit code — this session's own established discipline after an earlier false "deploy successful" claim). |
| 9 | **P4 — rescan**: trigger `agent-readiness-kit`'s scan (`npm run scan` there, or wait for its weekly schedule) and/or orank's `POST https://ora.ai/api/scan` for sortmy.london; record the new score in `ldnmxx-hack#305` and comment the delta on `agent-readiness-kit#25`. | **owner** (needs row 8 live first) | New score recorded in both places; if `oraAi.mcp-server-card`/`cloudflareMcp.mcp-server-card` findings don't clear despite row 4 shipping, investigate why before assuming the scanner is wrong. |

## Worktree dispatch (how rows 2–6 actually run)

1. Row 1 (ADR) is small — can run serially in the main session or as a single non-worktree pass; no
   parallelism benefit for one file.
2. Rows 2–4 (P1) touch the SAME file (`worker/src/worker.ts`) repeatedly — do NOT parallelize these
   across worktrees, they will conflict. One agent, one branch, sequential commits (or one PR covering
   all three if small enough — use judgment, this repo's convention favors focused PRs but three tiny
   sequential commits to the same growing feature is also fine as one PR, unlike three genuinely
   unrelated concerns).
3. After row 1–4 merge to `main`: rows 5–6 CAN run as 2 parallel `Agent(isolation: "worktree")` dispatches
   in one message (disjoint files: `ui/public/*` vs `tests/e2e/*` + `worker/test/mcp/*`). Brief each
   worktree agent with this plan's Handoff + Source map sections (so it doesn't re-derive them) and the
   Bash-deny-list + rtk-hook-worktree watch-outs.
4. Row 7 (docs) depends on rows 1–6 all being merged (it references their PR numbers) — runs after, not
   parallel with them.
5. Rows 8–9 are the owner checkpoint — pre-stage everything else so this is an approval, not a work
   session (per this repo's own `unattended-execution.md` "Pre-stage every gate during Phase A").

## Verification (repo-wide, run after every merge)

- `cd worker && npm ci && npm run lint && npm run typecheck && npm test`
- `cd ui && npm ci && npm run lint && npm run typecheck && npm test && npm run build && npm run size`
  (only if a row touches `ui/` — rows 5–6 do, rows 1–4 don't)
- root: `ruff check && uvx pytest -q ingest` (unlikely to be touched by this arc, run anyway per the
  repo's own "never à la carte" gate discipline)
- `npx --yes markdownlint-cli2 "**/*.md"` (ADR + plan + CHANGELOG rows)
- Full CI gate = `.github/workflows/ci.yml` must be green before squash-merge.
