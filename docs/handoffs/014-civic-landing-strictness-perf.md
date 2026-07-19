---
title: "Handoff 014 — COMPLETE + live on sortmy.london (S5 + follow-ups folded into plan 015)"
type: handoff
updated: 2026-07-19
pairs_with: docs/plans/014-civic-landing-strictness-perf.md
---

# Handoff 014 — resume point

**Plan 014 is COMPLETE + live on `sortmy.london`.** Its last workstream (S5 deepest strictness) + the
follow-ups are folded into **[plan 015](../plans/015-civic-usecase-expansion.md)** as the "014 carry-over"
— **resume from [handoff 015](015-civic-usecase-expansion.md), not here.** This doc is the historical record
of 014 + its Source Map still lives in
[`docs/plans/014-*`](../plans/014-civic-landing-strictness-perf.md). Predecessor: `013-*` (done, live).

## What shipped (13 PRs this cycle, all merged + live)

- **P** perf — immutable `/assets/*` cache · zod→v3 dedupe (−17.9 KB gz JS) · latin-only Inter, dropped
  JetBrains Mono (−14.5 KB gz CSS) · gzip bundle-size CI guard. #98 / #101. *(P4 font-preload deferred —
  measured mobile LCP already "good", not font-bound.)*
- **S1–S2** strictness/CI-security — `engines`/`.nvmrc`/`.npmrc` · pinned+broadened Semgrep · `npm audit` ·
  CodeQL `security-extended` · SHA-pinned dependency-review · `Permissions-Policy`+HSTS · dependabot
  `cooldown` + `.npmrc` `min-release-age`. #105 / #106. (#71 closed — grouping already done.)
- **U** civic landing — task-first, progressive-disclosure page; **Sort My Care flagship** (postcode → NHS
  & care); **On It** revealed on demand; Founder's Copilot dropped from the civic default (kept at
  `?usecase=founders-copilot`); tested `readUsecase()`; real 1200×630 `og:image` + `robots.txt` +
  `sitemap.xml` + WCAG footer. #109 / #110. Verified live (remote e2e clean). #88 closed.
- **S3–S4** worker strictness — ESLint (strictTypeChecked; 70 findings fixed, `resolveRun`/`runUsecase`/
  `assertUsecaseDef` refactored into helpers) + the 7 strict tsconfig flags (ui parity). #111 / #112.
  **Note: worker TS was pinned 7→6 — typescript-eslint cannot parse TS 7.** No behaviour change (119 tests).
- **Deploy/dev fixes** — `make deploy` builds+ships the SPA; worker `dev`/`deploy` use `--config
  wrangler.toml`; `provision_cf.sh` tolerates the benign code-10000 route step; dead `seed` target deleted.
  #99 / #102 / #104.
- **Docs** — `docs/engineering-practices.md` + `AGENT_LEARNINGS.md` (#103); D sweep of CHANGELOG / READMEs /
  env / catalog / progress (#114).
- **I** issue triage — closed 6 verified-shipped (#88/#72/#78/#82/#18/#67); opened **015 tracker #113**
  (civic usecase expansion + real data: #73/#74/#80/#13/#10/#8). Legacy-showcase issues (#4/#6/#7/#9/#11/#12)
  closed as off-strategy.

## S5 + follow-ups — moved to plan 015

014's last workstream **S5 (deepest strictness** — `verbatimModuleSyntax` · `noPropertyAccessFromIndexSignature`
· jsx-a11y · eslint-security · unicorn, **each its own PR, expect a fix wave** like S3/S4) and the follow-ups
(`shared/*.ts` lint · v1.1.0 release cut · axe-core in the sweep · e2e Tier-2 `runs.jsonl`) are now the
**"014 carry-over"** in [plan 015](../plans/015-civic-usecase-expansion.md) /
[handoff 015](015-civic-usecase-expansion.md). Resume there.

## Conventions (hard — unchanged)

- Branch-per-topic → Conventional Commits → push → **squash-merge `--admin` ONLY on green CI+tests** →
  **prune** remote+local. `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · noreply identity
  (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` (rebase too:
  `-c commit.gpgsign=false`) · SHA-pin new Actions · KISS/DRY/YAGNI · assume strict lint+typing+sec.
- **Strict module-TDD**: tests first for load-bearing MODULES only, never config/glue/CSS. S5 = config →
  no new tests (verified by build + existing suites + lint/typecheck).

## Gotchas (save hours)

- **`gh pr merge` is intermittently blocked by the auto-mode classifier** — retry (usually passes) or the
  user runs it. **Production deploys are the user's** (`make deploy`, now fixed) — creds/classifier-gated.
- **markdownlint MD004**: never let a wrapped line start with `+` (or `-`/`*`) — a `A + B` breaking across
  lines is read as a plus-list item and flips the file's bullet style. Bullets stay `-`.
- **Deploy = Pages-only for UI changes**: `wrangler pages deploy ui/dist --project-name sortmy-london
  --branch main`. The worker-route re-assert wants Zone→Workers-Routes→Edit (else code 10000, benign —
  zone-fallback deploys it anyway). Verify a deploy by inspecting served asset hashes + headers.
- **e2e** via `/workspaces/qte77/polyfetch-scrape/.venv/bin/python tests/e2e/ui_sweep.py <url> <label>`
  (updated to the new civic labels). Full local run needs the user's `CLOUDFLARE_API_TOKEN` (worker AI
  binding); vite-only renders the landing. `_headers`/CSP only apply after a Pages deploy, not vite preview.
  Each run writes `results/<label>/summary.json` (machine-readable verdict: target/ran_at/verdict/counts) —
  the **cross-session handoff artifact**. For a long/async run: background-launch the sweep, record a
  manifest line, and poll `summary.json` on the next wake (see the plan's "long/async e2e" note).
- **Worker is on TS 6** (typescript-eslint can't parse TS 7). Keep it aligned with `ui`.

## Open / context

`sortmy.london` live (P+S+U all in). Fast-follow **015** = #113 (civic usecase expansion + real data).
CF Web Analytics beacon allowed in CSP (#94). `MEMORY.md` at repo root is a stray auto-memory artifact —
untracked, do not commit.
