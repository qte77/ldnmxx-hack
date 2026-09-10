---
title: "Handoff 024 — App shell redesign"
type: handoff
updated: 2026-09-10
pairs_with: docs/plans/024-app-shell-redesign.md
---

# Handoff 024 — resume point

**Read [docs/plans/024-app-shell-redesign.md](../plans/024-app-shell-redesign.md) FIRST.** It carries
the full onboarding (status, next steps in order, the loop, owner gates, commands, watch-outs), the
complete source map (exact sourced light+dark palette, file/function line refs, token strategy), and
the single remaining-work table (rows 1–11).

**Current state (2026-09-10):** P0–P4 shipped (rows 1–7 merged). Row 8 (e2e sweep + this housekeeping
pass) is PR [#298](https://github.com/qte77/ldnmxx-hack/pull/298). Rows 9–10 remain; row 10 is owner-gated (no `CLOUDFLARE_API_TOKEN` here, and per
`cf-ci-secret-gate` memory it was never provisioned to GitHub Actions either — `deploy.yml` is expected
dormant until the owner acts). This stub becomes the living handoff — its Progress table below gets
ticked per row as PRs land (per `handoff-numbering-convention`: one plan + one living handoff per arc,
no new handoff number until the arc closes).

## Progress

| Row | Item | Status |
|---|---|---|
| 1 | Tokens & fonts | shipped, PR [#288](https://github.com/qte77/ldnmxx-hack/pull/288) |
| 2 | Shared contracts (shell split, `prefs.ts`) | shipped, PR [#293](https://github.com/qte77/ldnmxx-hack/pull/293) |
| 3 | Catalog fields | shipped, PR [#289](https://github.com/qte77/ldnmxx-hack/pull/289) |
| 4 | Home screen | shipped, PR [#297](https://github.com/qte77/ldnmxx-hack/pull/297) (combined with row 5) |
| 5 | Result sheet | shipped, PR [#297](https://github.com/qte77/ldnmxx-hack/pull/297) (combined with row 4) |
| 6 | Settings screen | shipped, PR [#296](https://github.com/qte77/ldnmxx-hack/pull/296) |
| 7 | Docs (ADR 0006, design.md rewrite) | shipped, PR [#295](https://github.com/qte77/ldnmxx-hack/pull/295) |
| 8 | E2E + CI + bundle ceiling | shipped, PR [#298](https://github.com/qte77/ldnmxx-hack/pull/298) (found + fixed a real sheet-close bug, see the plan's Handoff note) |
| 9 | Version + release (v2.0.0) | not started |
| 10 | Deploy + live verification | not started (owner-gated) |
| 11 | Handoffs README housekeeping | done earlier this arc (see `docs/handoffs/README.md`); this progress table + the plan's remaining-work table are the rest of row 11's job, done in PR [#298](https://github.com/qte77/ldnmxx-hack/pull/298) |
