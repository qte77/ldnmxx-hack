---
title: "Handoff 012 — resume: CF deploy (PR #75, user-gated) + Sort My Care (not started)"
type: handoff
updated: 2026-07-17
pairs_with: docs/plans/012-cf-deploy-and-care.md
---

# Handoff 012 — resume point

**Read [`docs/plans/012-cf-deploy-and-care.md`](../plans/012-cf-deploy-and-care.md) first** — it has the full
plan + a **Source map** (file:line for the engine/cards/tests/contract), so **do not re-explore**. Two efforts;
ship (1) first.

## Where we are

- **Effort 1 — full-CF deploy: DONE (code), PR #75 green, GATED ON THE USER.** SPA→CF Pages + Worker
  same-origin `/api/*` on `sortmy.london`; branch `feat/cf-pages-deploy`. **Before it can land:** the user adds
  `sortmy.london` as a CF zone + provides `CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID`, runs `scripts/provision_cf.sh` +
  `scripts/finish_cf.sh`, verifies, then **merges #75 together with the deploy** (merging alone retires
  gh-pages before CF is live). Nothing for the agent to do here until the user acts.
- **Effort 2 — Sort My Care + general engine foundation: NOT STARTED.** This is the next code work.

## First action (Effort 2)

Do **2a** as its own small PR: re-apply tag `wip/workflow-definition-contract` (`git show
wip/workflow-definition-contract`, commit `69bb925`) — `span`→`name` across `usecases.ts`/`worker.ts`/
`usecases/*.json` + the ajv contract test vendoring `qte77/protocols` (`bash
/workspaces/qte77/protocols/scripts/sync.sh`). Verify `make test` + `tsc` green. Then **2b** (registry + Care).

## How to handle it

- **Plan-mode first, then strict module-TDD** (tests first for load-bearing modules; NOT glue/JSON/scripts).
  Assume strict lint + typing + sec (CodeQL) — all gated.
- **Engine stays general** (dispatch by name via `worker/src/workflows.ts` registry; adding a workflow never
  edits `runUsecase`). **Each workflow owns its contract** (Care → `CareService`); keep contracts LOCAL
  (`qte77/protocols` is single-contract/YAGNI). **Data = pre-generated JSON now → CF D1 later; NO live fetch.**
  Care is model-free + fetch-free (deterministic corpus query). "Wayfinder" is a UX pattern, not the engine.
- **Reuse:** `cardsBatch` + `appendIncorporate` (→ `appendDisclaimer`), `isValidSearchResult` (validator
  pattern), the sibling deploy scripts. Don't rebuild.
- **Housekeeping in Effort 2:** drop "Track A/B" wording (`grep -rin "track[ -][ab]"`); add ADR
  `docs/adr/0001-*`; UserStory Care entry; open the "engine: general query stage + workflow manifest" issue.
- **Conventions:** branch-per-topic · Conventional Commits · `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh ·
  GitHub noreply + `--no-gpg-sign` · SHA-pin any new Action · **agent can't self-merge** (branch protection;
  auto-merge disabled; use `--admin` ONLY when the user explicitly says so). Surface green PRs for the user.

## Open PRs / issues

PR **#75** (deploy, green, user-gated) · issues **#72** Care / **#73** Wander / **#74** Scam / **#69** roadmap /
**#67** NPM-token (P5) / **#71** dependabot-group. Build order after Care: Wander → Scam (both reuse the
registry + own contracts, pre-generated JSON). Recommended overall: benefits-copilot (plan 011) shares the
same wayfinder-render pattern.
