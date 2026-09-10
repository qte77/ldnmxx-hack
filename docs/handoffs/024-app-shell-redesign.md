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

**Current state (2026-09-10):** rows 1–9 and 11 shipped. v2.0.0 is tagged and
[released](https://github.com/qte77/ldnmxx-hack/releases/tag/v2.0.0). Row 10 (deploy) is
[dispatched](https://github.com/qte77/ldnmxx-hack/actions/runs/34520670498) and sitting in `status: waiting` —
held by the `production` Environment's required-reviewer approval, a deliberate owner checkpoint; even
once approved, `gh secret list` confirms no `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secret
exists, so the preflight step fails fast by design. **This arc's agent-executable work is done** — row
10 needs the owner (approve + provision secrets, deploy locally, or cancel and defer).

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
| 9 | Version + release (v2.0.0) | shipped, PR [#299](https://github.com/qte77/ldnmxx-hack/pull/299) + tag [v2.0.0](https://github.com/qte77/ldnmxx-hack/releases/tag/v2.0.0) |
| 10 | Deploy + live verification | dispatched, blocked on owner ([run 34520670498](https://github.com/qte77/ldnmxx-hack/actions/runs/34520670498): `waiting` on Environment approval; secrets also absent) |
| 11 | Handoffs README housekeeping | done — resume pointer fixed early this arc (`docs/handoffs/README.md`), this progress table + the plan's remaining-work table done in PR [#298](https://github.com/qte77/ldnmxx-hack/pull/298) and this closing pass |
