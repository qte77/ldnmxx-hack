---
title: "Handoff 013 — resume: UI pivot (security · console-gate · brand · e2e · security-review), 0/7 not started"
type: handoff
updated: 2026-07-18
pairs_with: docs/plans/013-ui-pivot-security-brand-e2e.md
---

# Handoff 013 — resume point

**Read [`docs/plans/013-ui-pivot-security-brand-e2e.md`](../plans/013-ui-pivot-security-brand-e2e.md) FIRST** —
it carries the full **Source Map** (file:line for `App.tsx` / `useAgentSSE.ts` / `liveAgent.ts` / `index.css` /
brand kit / polyfetch API / deploy). **Do NOT re-explore.** Approved **full scope**; **0/7 shipped**.

## The one-line why
Pivot `sortmy.london` from the AG-UI/A2UI **showcase** UI to a **civic product** for a mobile-first Londoner
(engine stays; UI becomes task-first, trust-forward, no dev chrome). Plus a **live security bug**: the deployed
bundle inlined a real OpenRouter key (`ui/.env` → Vite → `liveAgent.ts` → OpenRouter → `401`); item **A** kills it.

## Queue & order (tick the plan's Progress table; emit `[N/7 · X%] ✓…|▶…` after each step)
`0` merge #75→main · `A` security (delete browser-BYOK → Worker path, redeploy) · `D` e2e harness (verify A, reuse
for B/C) · `B` console-gate — gate the console+⚙Key behind dev-mode, **delete** Catalog + Demo/Live · `C` brand theme
(vendored tokens — registry-independent, #82 — + fonts + favicon; **no** BluBlock/dark-first/3-state — keep binary light) · `E` docs+issues
· `G` civic essentials (a11y WCAG-AA · cookie-free CF Web Analytics + privacy note · SEO/OG meta · friendly failure
states) · `F` strict security review. **8 items.** **Do 0 then A first** (A is security-critical + a redeploy).

## First actions
1. **#75:** confirm green (deploy-fix commits `1c7db78`/`b1f40ca`/`29a28c3`) → squash-merge `--admin` → main, prune
   `feat/cf-pages-deploy`. Branch all A–F off updated main; **redeploy from main**.
2. **A** on `feat/security-worker-only`: TDD test FIRST (browser `run()` always hits `/api/run`, never `openrouter`),
   then delete `liveAgent.ts`(+test) + `runByokPath`/`useByok`, drop `VITE_BYOK` prefill, remove `@ai-sdk/openai`+`ai`
   deps, move `VITE_BYOK_*` → `ui/.env.development.local`. `make test`+tsc+lint → rebuild → `wrangler pages deploy
   ui/dist` → re-run the console capture (expect **no `openrouter` 401**).

## How to handle it (conventions — hard)
- **Strict module-TDD**: tests FIRST to model expected behavior; **only non-trivial tests, for modules — NOT
  scripts/glue/CSS/config** (e.g. the e2e harness = a script, no unit tests). Assume strict **lint + typing + sec**.
- **Branch-per-topic** · Conventional Commits · `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · noreply + `--no-gpg-sign`
  · SHA-pin new Actions · **push + squash-merge (`--admin`) on green CI/tests** · **prune stale remote+local branches**
  · KISS/DRY/YAGNI · surface each green PR · agent can't self-merge except the standing squash-on-green authorization.
- **After each major step**: emit a **concise** progress block (not verbose) + reprint the table only on a status flip.

## Gotchas (save hours)
- Worker `/api/run` already does BYOK **safely** (`resolveRun`, key-as-header) — that's why A just deletes the browser path.
- Theme is **vendored** (#82, registry-independent) — copy `tokens.css` into `ui/src/` with a source header; **no**
  `NODE_AUTH_TOKEN`/`ui/.npmrc`, CF build (`provision_cf.sh` → `npm ci`) stays keyless and is **not** blocked on #67.
- e2e: run via **polyfetch's venv** (`/workspaces/qte77/polyfetch-scrape/.venv/bin/python`); **video via `fetch(...record_video_dir)`**,
  NOT `render_session` (teardown bug); headless-only; dropdowns via `.page.select_option`; orientation via `" landscape"` presets.
- Worker deploy needs explicit **`--config wrangler.toml`** (wrangler v4 prefers the root Pages `wrangler.jsonc`).
- **Deploy creds:** root `.env` (auto-sourced by the scripts); DMARC/no-mail on `sortmy.london` already locked down.

## Open / context
PR **#75** (merge first). Shipped this session: #77 v1-align · #81 Care engine · full-CF deploy live · DMARC+no-mail ·
401 diagnosed+live-confirmed. Follow-on **013b** = issue **#88** (task-first civic landing + wire `sort-my-care` as flagship + visible rebrand).
