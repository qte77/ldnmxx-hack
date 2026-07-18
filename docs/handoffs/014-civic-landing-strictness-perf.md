---
title: "Handoff 014 — resume: sortmy.london civic landing · max strictness · performance (0/8 not started)"
type: handoff
updated: 2026-07-18
pairs_with: docs/plans/014-civic-landing-strictness-perf.md
---

# Handoff 014 — resume point

**Read [`docs/plans/014-civic-landing-strictness-perf.md`](../plans/014-civic-landing-strictness-perf.md)
FIRST** — it carries the full **Source Map** (file:line for `App.tsx` / `useAgentSSE.ts` / `_headers` /
`main.tsx` / worker / CI / Makefile). **Do NOT re-explore.** Approved full scope, **max strictness**. 0/8.

## The one-line why
Plan 013 shipped the civic *guts* (security, dev-gate, brand, a11y, CSP) live on `sortmy.london`, but the
**visible** UI is still the "Groundwork" showcase. 014 makes it a real product: a **task-first,
progressive-disclosure landing** (rebrand to `sortmy.london`, Sort My Care as flagship), plus **max
strictness** (npm/eslint/ts/CI/sec) and **load-perf** wins — and cleans up the issue tracker.

## Queue & order (tick the plan's Progress table; emit a concise `[N/8] ✓…|▶…` after each step)
`0` this (plan+handoff) → `P` perf (cache headers · zod dedupe · fonts) → `S1-S2` strictness quick (engines/
nvmrc/npmrc · npm audit · semgrep/codeql breadth · #71) → `U` landing+rebrand+og (#88) → `S3-S4` worker
ESLint + strict tsconfig (isolated, high-risk) → `I` close 13 stale issues + update #88 + open 015 tracker
→ `D` docs (+ stale Makefile CLI) → `S5` deepest strictness (each knob its own PR). **Batch UI redeploys.**

**Folded enhancements (see plan):** P += font **preload** + **bundle-size CI guard** + **measured** web-perf
baseline; S += **Permissions-Policy/HSTS** headers; U += **real og:image** (SVG→PNG) + **a11y statement** +
an **axe-core** e2e pass + **drop `founders-copilot` from the civic default** (off-message; keep via
`?usecase=`); D += `robots.txt`/`sitemap.xml` + **delete the dead `seed` Makefile target**.

## First actions
1. This doc + the plan are Step 0 — commit on `docs/plan-014`, PR, squash-merge on green, prune. Branch each
   workstream off updated main.
2. **P first** (safe, high-impact, no tests): `ui/public/_headers` add `/assets/* → Cache-Control:
   public, max-age=31536000, immutable`; `ui/package.json` zod `^4.4.3`→`^3.25.76` (contract.ts stable);
   `ui/src/main.tsx` drop `@fontsource/jetbrains-mono/*` + Inter→`latin-{400,700}.css`. `make test`+build →
   size delta → PR.

## How to handle it (conventions — hard)
- **Strict module-TDD**: test FIRST to model behavior; **only non-trivial tests, for MODULES — NOT scripts/
  glue/CSS/config**. So **P + S = no new tests** (config; verified by build + existing suites + lint/sec/
  typecheck); **U = markup/glue** verified by the e2e sweep; add a test ONLY if a real pure module emerges.
- **Branch-per-topic + commit-by-topic** · Conventional Commits · `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh
  · noreply + `--no-gpg-sign` · SHA-pin new Actions · **push + squash-merge `--admin` ONLY on green CI+tests**
  · **prune stale remote+local branches** · KISS/DRY/YAGNI · assume strict lint+typing+sec · surface each PR.
- **After each step**: concise progress block; reprint the table only on a status flip.

## Gotchas (save hours)
- **`gh pr merge` is BLOCKED by the auto-mode classifier** — the user runs each merge (or adds a
  `Bash(env -u GH_TOKEN -u GITHUB_TOKEN gh pr merge:*)` allow-rule). `wrangler pages deploy` IS allowed.
- **Deploy:** `npm --prefix ui ci && run build` → `wrangler pages deploy ui/dist --project-name sortmy-london
  --branch main` (creds from root `.env`). **Worker deploy** (`provision_cf.sh`) re-asserts the
  `sortmy.london/api/*` route and the CF token lacks **Zone Workers-Routes·Edit** → that step errors (code
  10000) but the **script uploads fine + the route already exists**, so `/api/*` serves. (User will add the
  token scope.) Pages-only redeploy avoids it.
- **e2e** via `/workspaces/qte77/polyfetch-scrape/.venv/bin/python tests/e2e/ui_sweep.py <url> <label>` —
  its verdict is model-host-hits (the item-A gate); watch `console_errors` for CSP regressions (a CSP change
  is only live after a Pages redeploy — vite preview does NOT apply `_headers`).
- **markdownlint MD004**: unordered lists use **dash**, never `+` at line start (bit us in 013).
- **S3/S4 are high-risk** (first-ever lint/strict-type on ~11 worker + 7 shared files) — isolate each, expect
  a wave of fixes, keep them their own PRs. **S5** knobs (verbatimModuleSyntax/unicorn/…) = large mechanical
  diffs — one PR each.

## Open / context
`sortmy.london` is live (013, 8/8). CF Web Analytics: CSP allows the beacon (#94) — user toggles it in the
dashboard. Follow-on **015** = issue cluster #73/#74/#80/#13/#10 (new civic usecases + real data). Predecessor:
`013-ui-pivot-security-brand-e2e.md` (DONE, live).
