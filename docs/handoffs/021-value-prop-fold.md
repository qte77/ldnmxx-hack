---
title: "Handoff 021 — first-principles pass + value-proposition fold. P1-P5 shipped in one PR; only the owner deploy + live sweep (P6) remain."
type: handoff
updated: 2026-08-05
pairs_with: docs/plans/021-value-prop-fold.md
---

# Handoff 021 — resume point

**Read [`docs/plans/021-value-prop-fold.md`](../plans/021-value-prop-fold.md) FIRST** — it carries the
first-principles method, the evidence, the source map and the done-when for the one open item.

## Onboarding — the 30-second picture

Arc 020 closed the UX overhaul (routing, place-names, re-shown examples, visual/motion/layout/help).
Arc 021 answered a different question: *why does the app look thin when it isn't?*

The analysis found the live deploy holds **112,380 real official records** while the landing page claimed
none of them — the slot under the H1 held the freshness **caveat**, and the covered categories existed only
inside chip labels that read as input examples. Root cause: the page was organised around *the input*,
while a visitor's first question is *"what does this know?"*.

The fold is now **coverage → proof → input → examples → a sample answer → one honesty line**, the honesty
copy is preserved (compact line + full text in `?`), and a place-less ask no longer reads as a form error.

## What shipped (all of P1-P5, one PR)

- `ui/src/coverage.ts` + `ui/tests/coverage.test.ts` (RED-first) — the honest number: infrastructure
  corpora excluded, rounds **down**, `null` in → `null` out.
- `ui/src/useCoverage.ts` — same-origin read of the existing `GET /api/freshness`; fails silent.
- `ui/src/App.tsx` — `CoverageLine`, `SampleCard` ("Here's what you get:", a real committed record labelled
  Example), caveat moved below the value + into `HelpPanel`, engine story moved to the footer.
- `worker/src/corpus/render.ts` (RED-first) — the place-less empty card is now
  **"Almost — which part of London?"**.

## Next (in order)

1. **P6 — owner deploy**, then the agent runs the live sweep. This is the ONLY open item; see the
   remaining-work table in the plan.

## Owner gates

- **Deploy** — dispatch `deploy.yml` (production Environment). The agent CANNOT deploy: no CF creds in the
  devcontainer, and dispatch is classifier-blocked. **Note for local work:** `make dev` cannot boot the
  Worker either (wrangler needs CF credentials for the remote AI binding). Verify the SPA locally with
  `VITE_WORKER_BASE=https://sortmy.london npm --prefix ui run dev` — `ALLOWED_ORIGINS` already whitelists
  `localhost:5173`, so the real API answers. **This trick is the arc's most reusable finding.**

## The loop (per phase / PR)

branch per topic → RED-first (modules only; CSS/wiring → the browser sweep) → gates (`npm --prefix
worker|ui run lint|typecheck|test` [ui: `build`+`size`] · semgrep · markdownlint `rtk proxy npx --yes
markdownlint-cli2 "<file.md>"`) → push → PR → CI green → `gh pr merge <n> --squash --admin
--delete-branch` → `git switch main && git pull` → per UI phase: deploy (owner) + sweep.

## Watch-outs (carried; do NOT relearn)

- **Honesty is enforced in code, not copy review** — never let the coverage number be a build-time
  constant, never round up, never fall back to a cached figure. A missing number is correct behaviour.
- **Do not "fix" corpus-level `asOf`** — it is deliberately the *oldest* row date, so `/api/freshness`
  reports `1901-01-01` (food-hygiene) and `1949` (listed buildings). Per-record card dates are correct.
  **Never surface corpus-level `asOf` in the civic UI.**
- **`ui/` must never import `worker/`** — `coverage.ts` mirrors the freshness payload's two needed fields.
- **`.qte-card` is scoped under `.a2ui-surface`** — do not borrow it for static UI; build from tokens.
- UI unit tests are pure/node-only (no jsdom); rendering is verified only by the browser sweep.
- `exactOptionalPropertyTypes`; complexity ≤12/function. Size budget JS ≤150KB / CSS ≤8KB gzip
  (now 141.2 / 5.1).
- `docs/design.md` is **stale**; `ui/src/tokens.css` + ADR 0005 are ground truth.

## Conventions (hard)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` ·
`env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · squash-`--admin` on green (never modify rulesets) · prune.
