---
title: "Maintenance backlog: flaky live sweep, area-aware card taps, Dependabot alerts"
type: plan
status: "OPEN — row 3 shipped (#386); row 1 fix merged pending 8 green scheduled runs (opened 2026-11-17)"
refs:
  - docs/plans/026-design-parity-completion.md (last closed arc)
  - "qte77 estate maintenance sweep, 2026-11-17: tiers open issues, alerts and TODOs by value and effort; this repo's rows above the cut are listed here"
---

# Plan 027 — Maintenance backlog

## Handoff (read this first)

**Status:** opened 2026-11-17 from the estate maintenance sweep. Row 3 shipped in #386 (2026-11-21). Row 1's
cause is found and its fix is in review; the row closes after 8 green scheduled runs.
It covers the open items in this repo that the sweep ranked high value and low to medium effort, each checked live on
2026-11-17. Lower-value open issues (#8, #161, #168, #185, #241, #305, #351, #352, #365) are not part of this arc and
stay in GitHub Issues.

**What's next, in order:**

1. **Row 1, the flaky live sweep (#337).** Diagnose from the failed runs' artifacts first. Reproduce locally only if
   the artifacts don't explain it.
2. **Row 2, card taps use the saved area (#353).** UI change plus an e2e assertion. The bundle-headroom blocker
   (#350) closed 2026-11-02, so the row is unblocked.
3. **Row 3, the minimatch Dependabot alerts (#96, #97).** Lockfile fix in `ui/` and `worker/`.
4. **Row 4 (#150)** waits on an upstream release; check it when touching ESLint config, no action otherwise.

**The loop:** one row per branch and PR, one worktree at a time. Before pushing, run `make test` and the same lint,
type and bundle checks CI runs (see [AGENTS.md](../../AGENTS.md) and `.github/workflows/`). Strike the row in the same PR that ships it. Merge once CI is green
and the owner has given the go-ahead for the session.

**Owner gates:** merges. No row needs a credential, data access or spend decision.

**Watch-outs:**

- Rows 1-3 need `npm ci` (UI and worker) and, for row 1's local repro, the e2e browser. Check free disk first.
- The UI bundle is close to its 160,000 B gzip JS budget (`ui/scripts/check-bundle-size.mjs`; see #365). Row 2 must
  keep that check green.
- The live sweep posts to #337 on every failing scheduled run. A green run does not close it.

## Source map

| Row | Files and refs |
|---|---|
| 1 | `.github/workflows/tier3-monitor.yml` (every 6 h; opens or comments on the alert issue on FAIL); `tests/e2e/ui_sweep.py` (`FAIL: a corpus flow (flows.json) did not render on: …`, around line 423); `tests/e2e/flows.json`. Failed runs: [43129117103](https://github.com/qte77/ldnmxx-hack/actions/runs/43129117103) (2026-11-12, desktop corpus flow did not render; axe 0 violations, 0 console errors, 0 failed requests) and one on 2026-11-08. The 22 scheduled runs after 2026-11-12 passed. |
| 2 | `ui/src/screens/Home.tsx`: `SuggestionChips` `onPick(u.example)` (around line 257) and `CategoryCard` `onPick(entry.example, entry.id)` (around line 478) submit the canned example. `ui/src/screens/locationAnchor.ts` `withLocationAnchor(text, borough)` anchors only asks that name no location. E2E: `tests/e2e/ui_sweep.py` `interactive_smoke`. Issue [#353](https://github.com/qte77/ldnmxx-hack/issues/353) has the approach and done-when. |
| 3 | `ui/package-lock.json`, `worker/package-lock.json` (minimatch); Dependabot alerts 96 and 97 (medium). |
| 4 | Issue [#150](https://github.com/qte77/ldnmxx-hack/issues/150); `ui/package.json` (ESLint 10). |

## Decisions (with defaults)

- **Row 2, area chip layout.** #353 says the chip's layout comes from the design work in #351, which is not in this
  arc. Default: ship the behaviour first (card and chip taps use the saved area; the canned example is used and labelled
  as an example only when no area is set) using existing components and tokens, and add the e2e budget assertion.
  The in-place area chip follows when #351's design lands.
- **Row 1, closing #337.** Default: once the cause is fixed (or shown to be a deploy-settling or network flake with a
  retry added), comment the evidence and leave the close to the owner.

## Remaining work

| # | Item | Value / effort | Gate | Done when |
|---|---|---|---|---|
| 1 | Find and fix the intermittent live-sweep failure (a corpus flow did not render on desktop) — [#337](https://github.com/qte77/ldnmxx-hack/issues/337). Cause (2026-11-21): the no-match flow's result was still running when `run_typed_flow`'s fixed 8 s sleep ended (screenshots show "Stop"); fix: wait for the markers up to 30 s and log time to render | broken monitoring / M | data (8 scheduled runs) | Cause stated in #337 with evidence; fix or bounded retry merged; next 8 scheduled runs green |
| 2 | Card and chip taps answer for the saved area — [#353](https://github.com/qte77/ldnmxx-hack/issues/353) | correctness / M | agent | With an area set, a card tap returns results for that area (verified live); e2e asserts the 2-taps-1-field path; bundle check green |
| ~~3~~ | ~~Clear the minimatch Dependabot alerts (96, 97) in `ui/` and `worker/`~~ shipped in #386 (2026-11-21); both alerts fixed | security / S | done | Lockfiles updated, CI green, both alerts closed |
| 4 | Adopt `eslint-plugin-jsx-a11y` once it supports ESLint 10 — [#150](https://github.com/qte77/ldnmxx-hack/issues/150) | hygiene / S | data (upstream release) | A jsx-a11y release declares ESLint 10 support; plugin enabled with the UI lint green |
