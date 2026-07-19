---
title: "Plan 014 — sortmy.london: civic landing (progressive disclosure) · strictness · performance"
type: plan
updated: 2026-07-18
status: "approved — ready to execute (0/5 workstreams shipped)"
refs: ["#88 (013b landing/rebrand)", "#71 (dependabot grouping)", "013 plan/handoff (predecessor)", "proposed 015 = #73/#74/#80/#13/#10"]
---

# Plan 014 — sortmy.london: civic landing (progressive disclosure) · strictness · performance

> **Read the Source Map (below) — do NOT re-explore.** Approved full scope, **max strictness** (YAGNI flag
> raised + overridden by the user). Persist progress by ticking the Progress table; after each major step
> emit a concise `[N/… ] ✓ … | ▶ …` block. Predecessor: `013-ui-pivot-security-brand-e2e.md` (shipped, live).

## Context

Plan 013 pivoted the app to a civic tool and shipped the hard parts (browser never calls a model host,
dev-mode gate, vendored brand theme + fonts, e2e harness, WCAG a11y + civic SEO/privacy, CSP + fail-closed
CORS + rate-limit) — all live on `sortmy.london`. But the **visible** UI is still the "Groundwork" showcase
single screen (usecase toggle, dev-flavoured), and three cross-cutting goals remain: (1) a **task-first,
progressive-disclosure** landing that doesn't overwhelm a stressed Londoner, with a **visible rebrand** and
**Sort My Care as the flagship**; (2) make **npm / eslint / typescript / CI / security as strict as
possible**; (3) improve **load performance**. Plus: fold the highest-ROI open issues in and close the stale.

**Decisions locked (user):** name = **`sortmy.london`** (lowercase wordmark); landing = **one screen,
progressive disclosure** (no routing — calm hero, one primary action, reveal-on-demand); strictness =
**max** (every knob, each its own reviewable PR); scope = **full 014**.

## Progress — queue

| # | Workstream | Status |
|---|---|---|
| 0 | Persist plan + handoff to repo (this) | ✅ shipped (#97) |
| P | Performance — cache headers · zod dedupe · font subsetting · bundle-size CI guard · measured baseline | ✅ shipped (#98/#101; P4 preload deferred — LCP already good) |
| S1–S2 | Strictness quick — engines/nvmrc/npmrc · npm audit · semgrep/codeql breadth · Permissions-Policy/HSTS · #71 | ✅ shipped (#105/#106; #71 closed) |
| U | Civic landing + rebrand + real og:image + a11y statement · drop founders-copilot (#88) | ✅ shipped (#109/#110; #88 closed; live) |
| S3–S4 | Worker ESLint + strict tsconfig (isolated) | ✅ shipped (#111/#112; TS7→6 for eslint compat) |
| I | Close stale issues · open 015 tracker | ✅ shipped (closed 6 verified; 015 = #113) |
| D | Docs (CHANGELOG/README/sub-READMEs/env/catalog + Makefile CLI) | ▶ this PR (Makefile fixed in #99) |
| S5 | Max strictness — verbatimModuleSyntax · noPropertyAccess · jsx-a11y · eslint-security · unicorn | ☐ to ship (each its own PR) |

---

## Workstream P — Performance (first: low-risk, high-impact)

- **P1 · Immutable asset cache (biggest win).** `ui/public/_headers` sets **no** `Cache-Control`, so CF Pages
  defaults to `max-age=0, must-revalidate` — every repeat visit revalidates all hashed assets. Add:
  ```
  /assets/*
    Cache-Control: public, max-age=31536000, immutable
  ```
  Leave `/index.html` on the default so redeploys are picked up. (Effort S.)
- **P2 · Dedupe zod.** `ui/package.json` pins `zod@^4.4.3` but `@a2ui/react` peers `zod@^3.25.76` → **two zod
  copies ship**. Align the app to `^3.25.76`; `ui/src/agent/contract.ts` only uses
  `object/array/union/record/string/number/refine/infer` (stable v3↔v4). (Effort S.)
- **P3 · Font subsetting.** `ui/src/main.tsx` imports all Inter+JetBrains-Mono subsets (≈50 files). JetBrains
  Mono is used **only** in the dev-only `EventStream` (never painted for civic users) → drop it (system mono
  fallback stays in `tokens.css`). Inter → `latin-400.css`/`latin-700.css` only. ≈50 → ≈2–4 font files.
  (Effort S; `@fontsource-variable/inter` a later option.)
- **P4 · Preload critical fonts.** After P3, add `<link rel="preload" as="font" type="font/woff2" crossorigin>`
  for the two render-critical Inter woff2 (latin 400/700) → direct mobile-LCP win. Needs the post-build hashed
  filename (a tiny Vite/postbuild inject); else rely on the existing `font-display:swap` and skip. (Effort M.)
- **P5 · Bundle-size guard (CI).** Add a lightweight CI check that fails if the main JS gzip exceeds a
  threshold (`size-limit`, or a `du`+compare step) so the P-wins don't regress. Fits the strictness thrust.
- Verify: **measured, not vibes** — run the `web-perf`/Lighthouse skill for a mobile **before/after
  baseline** (LCP/INP/CLS); build-size delta; e2e sweep clean.

## Workstream S — Strictness (scoped PRs; ui/ already near-max — the gap is worker/ + CI). **Max depth.**

- **S1 · Version + quick flags (low-risk).** `engines` (`node >=22 <23`) + `.nvmrc` (`22`) + `.npmrc`
  (`engine-strict=true`, `save-exact=true`) in `ui/` and `worker/`; pin the Semgrep `pip install` version in
  `ci.yml`; add `noUncheckedSideEffectImports` to both `tsconfig`s.
- **S2 · CI security breadth (findings-first).** `npm audit --omit=dev --audit-level=high` in the `ui` +
  `worker` CI jobs; broaden Semgrep (`p/owasp-top-ten` + `p/security-audit` + `p/secrets`); CodeQL
  `security-extended`; `actions/dependency-review-action` on PRs (SHA-pinned). Group Dependabot (**#71**).
- **S2b · Security headers.** Add `Permissions-Policy` to `ui/public/_headers` (deny `camera` / `microphone`
  / `geolocation` / `payment` / `usb` — none are used) and confirm **HSTS** (`Strict-Transport-Security`) is
  served (CF edge usually sets it; add explicitly if not). Complements the CSP from 013·F.
- **S3 · Lint worker/ + shared/ (highest-value gap — isolate).** `worker/` has **no ESLint config** (11
  security-critical files never linted). Add `worker/eslint.config.js` (mirror `ui/eslint.config.js`'s
  `strictTypeChecked`+`stylisticTypeChecked`, node globals, no react), a `lint` script + CI step; extend to
  cover `shared/*.ts` (`guard.ts`, `sanitize.ts`). Fix what it surfaces. (Risk: high — its own PR.)
- **S4 · Strict worker tsconfig (isolate).** `worker/tsconfig.json` sets only `strict`. Add the 7 flags `ui/`
  has (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`). Fix surfaced errors. (Risk: high.)
- **S5 · Deepest strictness (max — large diffs accepted).** `verbatimModuleSyntax` +
  `noPropertyAccessFromIndexSignature` on both tsconfigs (rewrites imports / forces bracket-access — fix
  mechanically); `eslint-plugin-jsx-a11y` on `ui/`; `eslint-plugin-security` on `worker/`;
  `eslint-plugin-unicorn` (curated subset) on both. **Each knob its own reviewable PR.** (CI already runs
  gitleaks + Semgrep + SHA-pinned Actions — satisfied.)

## Workstream U — Civic landing + rebrand + progressive disclosure (biggest; #88)

One screen, no routing. Files: `ui/src/App.tsx` (`Dashboard`), a small new component or two, `index.html`.

- **U1 · Rebrand.** Header "Groundwork · one engine · two London workflows" → **`sortmy.london`** wordmark +
  civic tagline ("find the official public service you need"). Keep the light/dark toggle.
- **U2 · Task-first hero + progressive disclosure.** Calm above-the-fold: one question ("What do you need
  sorted?"), **Sort My Care as the default/flagship**, a **single primary input** (London postcode / query)
  and one CTA. Secondary civic flow: **On It** (step-free routes — genuinely a public service), revealed on
  demand. **Drop `founders-copilot` (Grants) from the civic default** — off-message for a public-service
  tool (it's a business tool / showcase remnant); keep it reachable via `?usecase=founders-copilot` (engine
  demo, dev-mode). Results/cards render below; freshness ("data as of") + "signpost, not advice" stay. Dev
  chrome already gated (013·B). **Mobile-first.** Uses the **existing** flows — no new usecase (those are 015).
- **U3 · Real og:image + a11y statement.** Generate a **real** 1200×630 image (self-contained SVG →
  rasterize to PNG; parchment/amber + `sortmy.london` wordmark + tagline) replacing the text-only OG (013·G).
  Add a one-line **accessibility statement** (footer link — "built to WCAG AA; report an issue at …").
- Verify: e2e sweep (a11y `heading=True`, 0 console/network/model-host) **+ an `axe-core` pass** injected into
  the sweep for concrete WCAG pass/fail; before/after screenshots desktop + mobile; keyboard-only pass.

## Workstream D — Docs (part of "done"; per PR + a final pass)

- **CHANGELOG.md** — an entry per PR. **README.md** — rebrand: drop "Groundwork" showcase framing for the
  `sortmy.london` civic USP + Care flagship (engine story stays lower down); the URL-params block
  (`?dev`/`?theme`/`?usecase`/`?demo`) already exists — extend if U2 adds a switch.
- **docs/architecture.md** — the civic landing / progressive-disclosure view + Care as default flow.
  **docs/UserStory.md + docs/design.md** — refine ICP/USP for the task-first landing.
  **Roadmap** `data/usecase-catalog.json` reflects the folded issues.
- **SEO static files** (civic tool → be crawlable): add `ui/public/robots.txt` (allow, point at the sitemap)
  and `ui/public/sitemap.xml` (the one civic URL) — tiny; pairs with the U3 OG/meta. The accessibility
  statement (U3) also gets a short `docs/` note if it links out.
- **CLI (Makefile) — STALE, must fix:** `deploy` says "UI deploys via gh-pages CI" (retired #75 → CF Pages/
  `provision_cf.sh`); `demo` → `qte77.github.io/ldnmxx-hack/` (now `sortmy.london`); dev targets say
  `proxies /run` (now `/api`). **Delete the dead `seed` target** (Phase-2 TODO, unbuilt) — don't leave dead
  CLI. Update + confirm `make help`. Document the CF-Web-Analytics dashboard toggle + the deploy-token
  **Workers-Routes** scope (Q4) in `docs/deploy-cloudflare.md`.
- **url/env/cli audit:** URL ✓ (README), env ✓ (`.dev.vars.example`/`.env.example`/`ui/.env.example`; no
  `NODE_AUTH_TOKEN`), CLI ✗ (Makefile) — this pass closes the CLI gap.

## Workstream I — Open-issue triage (22 verified vs CHANGELOG + merged PRs #75–#94)

- **Fold into 014:** **#88** (landing/rebrand → U; update the issue to this plan's approach) · **#71**
  (dependabot grouping → S2).
- **Close now (13 — done/legacy-off-strategy, one-line reason each):** #72 (Care, #81) · #78 (v1 contract,
  #77) · #82 (vendored brand, #86) · #18 (phase-2, #61/#62/#64; remainder legacy) · #69 (civic-v1 roadmap,
  superseded) · #67 (NPM_READ_TOKEN, obviated by #82/#86) · #12 · #11 · #9 · #7 · #6 · #5 (theme done, deploy
  superseded #75) · #4 — all legacy showcase off the "signpost, not act" strategy.
- **Defer — keep open; propose fast-follow plan 015 "civic usecase expansion + real data":** #73 Wander ·
  #74 Scam · #80 engine query-stage + manifest · #13 real Care corpus (replace synthetic `data/care/*`) ·
  #10 ingest cron. Plus #8 (Open311 write — off-strategy) · #50 (Arize — blocked account-side).

---

## Source Map (jump straight in — do NOT re-explore)

**UI `ui/src/`**
- `App.tsx` — `Dashboard()` (~L92). USECASES `:10-25` (founders-copilot · on-it; add care flagship for
  **U2**). `ThemeToggle` `:34-57`. `StatusChip` `:67-90` (dev-only). **Header** `:126` (visible "Groundwork"
  wordmark + tagline — **U1 rebrand**). sr-only `<h1>` civic already. usecase buttons `:134-161`. `devMode`
  and `?dev=1` keydown/persist `:97-129`. ⚙Key + `dev ✕` gated `:163-182`. Key panel gated `:187-204`.
  **prompt form** `:206-226` (single input + Run — **U2 hero input**). error `role=alert` `:228-231`.
  **results** `<main>`+`aria-live` `:232-238`; console `<aside>` gated `:239-249`. **footer** `:250+`.
- `devmode.ts` (`matchesToggle`/`readDevMode`/`writeDevMode`, localStorage `qte77-dev`, `?dev=1/0`; tested
  `ui/tests/devmode.test.ts`). `main.tsx` (imports `@fontsource/{inter,jetbrains-mono}/{400,700}.css` +
  `./index.css` — **P3**). `config.ts` (`WORKER_BASE = import.meta.env.VITE_WORKER_BASE ?? ""`).
- `index.css` (`@import "tailwindcss"; @import "./tokens.css";` + app rules; a11y baseline `.sr-only`/focus/
  reduced-motion `:110-155`; `.a2ui-surface .qte-*`). `tokens.css` (vendored `@theme` colors/fonts/
  `--radius-card`/`--shadow-card` + dark overrides).
- `agent/useAgentSSE.ts` (`run()` → `runWorkerPath` exported → `POST ${WORKER_BASE}/api/run?usecase=&demo=`).
  `EventStream.tsx:34` (ONLY `font-mono` user, dev-only → **P3** drop JetBrains Mono). `agent/contract.ts`
  (zod — **P2**). `A2UISurface.tsx`, `agent/applyA2UIEvent.ts`.
- `index.html` (head: external `theme-init.js` anti-FOUC CSP-safe; civic `<title>`/OG/Twitter — **U3
  og:image**; favicon.svg zero-blue). `public/_headers` (security + CSP incl. cloudflareinsights allowlist;
  `font-src 'self' data:` — **P1 add cache rule**). `public/_redirects`, `public/theme-init.js`, `public/favicon.svg`.
- **Config:** `package.json` (deps `@a2ui/react`/`react`/`react-dom`/`zod@^4.4.3`→**P2 ^3**/`@fontsource/*`).
  `eslint.config.js` (strictTypeChecked+stylisticTypeChecked, projectService). `tsconfig.app.json` (strict +
  9 flags; **S add** noUncheckedSideEffectImports/verbatimModuleSyntax/noPropertyAccess…). `vite.config.ts`
  (base `/`, react+tailwind, `test.environment:"node"`; **P2 manualChunks** option).

**Worker `worker/`** — `src/worker.ts`: `resolveRun` `:159-204` (BYOK key-as-header, forced-empty on demo/
injection, never logged); `corsHeaders` `:107-120` (fail-closed, never `*`); fetch handler `:352+` (OPTIONS
`:357`; `/api/run`|`/api/trace` allowlist `:358-360`; rate-limit `:362-370`). `src/workflows.ts` (registry —
render by `mode` founders/route/**care**; query by `exec` fetch_care_services). `src/usecases.ts`
(`getUsecase`/`assertUsecaseDef` v1). `src/care/{contract,careServices,render}.ts`, `src/geo.ts`.
`src/agent/{model,providers}.ts` (free chain). `test/{run,trace}.test.ts` (119 tests). **`tsconfig.json` —
only `strict` (S4 gap)**; **NO `eslint.config.*` (S3 gap)**. `wrangler.toml` (routes `sortmy.london/api/*`;
`[[ratelimits]]` 20/60; `[ai]`; `[vars] ALLOWED_ORIGINS`). `.dev.vars.example`.

**Shared** `shared/` — `guard.ts` (`detectInjection`), `sanitize.ts` (UK postcode, no-SSRF), `incorporate.ts`,
`assessTool.ts`/`searchTool.ts` (**S3 lint these; guard/sanitize are security-critical**).

**Data** — `usecases/{sort-my-care,founders-copilot,on-it}.json` (`name` per v1). `data/care/*.json`
(synthetic — #13/015). `data/usecase-catalog.json` (roadmap). `data/sources.json`.

**CI / infra** — `.github/workflows/ci.yml` (jobs `ui`/`worker`/`lint`/`security`=gitleaks+semgrep; node 22;
SHA-pinned; **S2**). `codeql.yaml` (default suite; **S2 security-extended**). `lint-md-links.yml`
(markdownlint — **MD004 dash-not-plus!**). `dependabot.yml` (**#71 grouping**). `scripts/provision_cf.sh`
(npm ci+build→pages deploy→worker deploy `--config wrangler.toml`), `finish_cf.sh` (DNS+Pages domain, NOT
the worker route). `Makefile` (**D: stale deploy/demo/dev/seed**).

**e2e** — `tests/e2e/ui_sweep.py` (Patchright sweep — fails on model-host hit) + `devmode_check.py`; run via
`/workspaces/qte77/polyfetch-scrape/.venv/bin/python`; artifacts `tests/e2e/results/` (gitignored).
**Deploy creds:** root `.env` (auto-sourced). **Classifier:** allows `wrangler pages deploy`, BLOCKS
`gh pr merge` (user runs merges, or adds a `Bash(...gh pr merge:*)` allow-rule).

## Order · conventions · verification

- **Order:** 0 (this) → P1–P3 → S1–S2 → U1–U3 → S3–S4 (isolated) → I → D → S5 (each knob its own PR). Batch
  UI redeploys; a final redeploy from main + e2e gate to close.
- **Conventions (hard):** branch-per-topic + commit-by-topic → Conventional Commits → push → squash-merge
  `--admin` **only when CI + tests green** (user runs the merge; **never modify rulesets**) → **prune stale
  remote + local branches**. `env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · noreply · `--no-gpg-sign` ·
  SHA-pin new Actions · KISS/DRY/YAGNI/AHA · assume strict lint + typing + security.
- **TDD scope:** test FIRST to model behavior — **only non-trivial tests, only for load-bearing MODULES**,
  never scripts/glue/CSS/config. So P (config) + S (eslint/tsconfig/CI) get **no new tests** (verified by
  build + existing suites + lint/sec/typecheck); U is markup/glue verified by the e2e sweep; add a test ONLY
  if a genuine pure module emerges (e.g. a flow-routing helper).
- **Verify per PR:** `make test` + `tsc` + `eslint` (+ new worker lint) + markdownlint + CI/CodeQL/Semgrep/
  gitleaks green. Perf: build-size delta + deployed `web-perf` check. Final: redeploy from main; e2e sweep
  clean; on-brand civic landing screenshots (desktop + mobile).
