---
title: "Handoff 013 — UI pivot (security · console-gate · brand · e2e · civic · security-review): 8/8 DONE, live on sortmy.london"
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

## DONE — plan 013 complete (8/8)
All items merged (#83 A · #84 D · #85 B · #86 C · #87 G · #89 E · #90/#91 F) and **live on `sortmy.london`**
(Pages + Worker redeployed). Final e2e sweep across 5 device configs: **0 console errors · 0 network≥400 ·
0 model-host hits**; civic title, `heading=True` a11y.

**Security review (F) — sign-off: SECURE TO SHIP, 0 must-fix.** All 8 audited invariants PASS with
bundle/config evidence: (1) no secret in the SPA bundle; (2) browser never calls a model host — only
`/api/run`; (3) Worker-secrets-only (`OPENROUTER_KEY`/`ARIZE_*` via `env.*`, BYOK forwarded-not-logged,
forced-empty on demo/injection); (4) CORS allowlist — now **fails closed** (never `*`, #90); (5) injection
guard (`shared/guard.ts`) applied Worker-side; (6) postcode SSRF boundary — `sort-my-care` is provably
fetch-free; (7) per-IP rate-limit (429); (8) least-privilege deploy token (Zone-scoped). Hardening landed:
**CSP** (`ui/public/_headers`; anti-FOUC script externalized to `theme-init.js`; `font-src` allows `data:`)
plus **fail-closed CORS** (never `*`, with 3 new preflight tests). Follow-ups (non-blocking): a 1200×630
`og:image`; optional adoption of `@qte77/ui-theme` once #67 provisions the token.

**Deploy wrinkle (non-fatal):** `wrangler deploy` (Worker) re-asserts the `sortmy.london/api/*` route each
run and the CF token lacks Zone **Workers-Routes·Edit**, so that step errors (`code 10000`) — but the Worker
**script uploads fine** and the route already exists, so `/api/*` serves the new code. Fix later: add the
scope, or drop `route` from `worker/wrangler.toml` post-setup. **Open loose end:** PR **#76** (historical
012/010/011 docs) — user decision (merge or close; outside 013 scope).
