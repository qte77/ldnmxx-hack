---
title: "Engineering practices — sortmy.london / ldnmxx-hack"
type: reference
updated: 2026-07-22
---

# Engineering practices

Distilled, reusable patterns proven on this project (a civic SPA on Cloudflare Pages
plus a Worker API). Terse, project-specific rules live in [`AGENTS.md`](../AGENTS.md);
recurring gotchas and their fixes accrue in [`AGENT_LEARNINGS.md`](../AGENT_LEARNINGS.md).
This doc is the human-facing "why + how" for the cross-cutting practices.

Overriding principle: **measure and verify on the live target — not vibes, not mocks.**

## Performance

- **Immutable-cache content-hashed assets.** `/assets/* → Cache-Control: public,
  max-age=31536000, immutable`; keep `index.html` on the revalidating default so
  redeploys still land. Pages otherwise revalidates every hashed asset on repeat
  visits. Verify the header on the **deployed** site — `_headers` is applied by a
  Pages deploy, never by `vite preview`.
- **Dedupe transitive deps to the peer range.** Two copies of a library ship when the
  app pins a different major than a dependency's peer. Align to the peer (`zod ^4 → ^3`
  to match `@a2ui/react`) and confirm with `npm ls <dep>` (a single resolved version).
  Measured: −17.9 KB gzip on the entry JS.
- **Subset fonts — but know what actually ships.** Latin-only `@fontsource/inter` and
  dropping an unused family shrink the build, yet browsers already fetch only the
  `unicode-range` subsets a page renders. The measured win was the **CSS payload**
  (fewer `@font-face` blocks, −14.5 KB gzip), not font transfer. Don't claim a
  transfer win you can't measure.
- **Guard the win in CI.** A gzip bundle-size ceiling (`ui/scripts/check-bundle-size.mjs`,
  node `zlib`, no new dependency) fails the build if JS/CSS regress past a threshold.
- **Measure mobile, before/after, on the deploy.** Throttled (Fast-3G + 4× CPU)
  LCP/FCP/CLS via a real headless browser against the live URL. Report honest deltas —
  a page already in the "good" band barely moves; the value is fewer bytes + caching.

## Security

- **Secrets are Worker secrets only.** `wrangler secret put`, never in code or the SPA
  bundle. The browser holds no model-host key.
- **The browser never calls a model host.** BYOK-from-browser was removed; the e2e
  sweep (`tests/e2e/ui_sweep.py`) fails if any request hits a model host — a standing
  regression gate, not a one-off check.
- **Defence at the edge.** CSP + fail-closed CORS (never `*`) + rate-limit +
  `X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options` in `_headers`
  (extend with `Permissions-Policy` / HSTS). Input is sanitized (UK postcode, no-SSRF)
  and injection-screened (`shared/guard.ts`) before it reaches a model.
- **CI is the security gate.** gitleaks + Semgrep + CodeQL + `npm audit`; every GitHub
  Action is **SHA-pinned** (repo policy: `sha_pinning_required`) with the tag in a
  trailing comment. One unpinned tag ref fails the whole workflow.
- **ToU-gated data stays out of git — and licence-gate the serving channel too.**
  Only synthetic fixtures are committed; scraped corpora are gitignored — that guards
  the *repository* channel. Serving ingested data from our own store (D1 → user) is a
  distinct act of **redistribution**, gated by the source **licence**, not by
  `.gitignore`: only sources whose licence permits it (OGL/permissive, with the required
  attribution) may be ingested and served; `tou-gated` ("don't warehouse") stay
  live-display / link-only. `data/sources.json` carries `license` + `redistribute_ok`
  so the ingester enforces the gate per re-seed. See [ADR 0002](adr/0002-real-data-store.md).
- **Read-through a store; keep the hot path fetch-free.** The request path reads CF D1
  only; sources are fetched out-of-band on a cron + trigger, so no SSRF surface, no
  third-party latency, and no source secret ever rides the hot path — and `asOf` is a
  real ingest timestamp. Fits reference/directory corpora; real-time feeds need a
  different pattern. See [ADR 0002](adr/0002-real-data-store.md).
- **Self-hosted, vendored third-party libs — never fetch at runtime.** Test-only libs
  needed inside the page (e.g. `axe-core`) are vendored under `tests/e2e/vendor/` and
  injected via `page.evaluate` rather than fetched, mirroring the app's own
  no-external-resources CSP. Vendored code is excluded from CI scanners
  (`.semgrepignore`) and marked `linguist-vendored` in `.gitattributes` so it doesn't
  count as reviewable diff/stats.

## UX / Accessibility (civic)

- **Task-first, progressive disclosure.** One calm question + one primary action above
  the fold; reveal secondary flows on demand; mobile-first. Don't greet a stressed user
  with a control panel.
- **Signpost, not adjudicator.** Frame as a wayfinder to official services; show
  freshness ("data as of") and an advice disclaimer; never imply authority you lack.
- **WCAG AA is verified, not asserted.** sr-only `<h1>`, `aria-live` results, visible
  focus, `prefers-reduced-motion`, a keyboard-only pass, and an **axe-core** check in
  the e2e sweep — real pass/fail.
- **axe-core gates on `critical`, reports `serious`+.** The e2e sweep injects a
  **self-hosted, vendored** `axe-core` (`tests/e2e/vendor/axe.min.js`) via
  `page.evaluate` — `add_script_tag` would be blocked by the page's own strict CSP —
  and runs a WCAG 2 A/AA scan on the desktop config today (a mobile-viewport run is
  queued). GATE on `critical` only, so the sweep stays a usable green/red signal;
  REPORT `serious`+ loud plus into `summary.json` and an `axe-desktop.json` artifact,
  so a real regression is visible without blocking every run on a design-system nit.
  Already caught one: card official-link contrast 4.42 < 4.5 on the light surface
  (#154).
- **Gate dev chrome.** Dev tooling (event stream, key panel) sits behind `?dev` / a
  devMode flag so civic users never see it. Anti-FOUC theme init is an external,
  CSP-safe script — no inline handler.

## Deploy / Infra

- **Two commands, don't mix them.** Pages (SPA): `wrangler pages deploy ui/dist ...`;
  Worker: `wrangler deploy --config wrangler.toml`. wrangler v4 walks **up** the tree
  and prefers the root Pages config, so a bare `wrangler deploy` in `worker/` is misread
  as a Pages deploy ("you have run wrangler deploy on a Pages project"). Always pass
  `--config` for the worker.
- **UI-only change → Pages-only redeploy.** Skips the worker route re-assert, which
  needs `Zone > Workers Routes > Edit` and otherwise exits code 10000 *after* the script
  uploads fine and the existing route keeps serving. Tolerate that benign step so a
  successful deploy never reports failure.
- **One deploy entrypoint.** `scripts/provision_cf.sh` (called by `make deploy`) is the
  SSOT: build ui → Pages, then the worker with `--config`. Creds load from a gitignored
  root `.env`. Keep the Makefile pointing here — don't let CLI help drift from reality.
- **Verify the deploy landed.** Inspect the served asset hashes + `Cache-Control` on the
  live URL. "Deploy done" is not proof the new bits are live — a wrong command can look
  successful while the old build still serves.

## Workflow / Process

- **Plan first, then reconcile with reality.** Before executing an approved plan, verify
  its factual claims — trackers drift (we found "0/8" when step 0 had shipped, and two
  issues already closed). A cheap check that prevents redundant work.
- **Strict, module-only TDD.** Tests first for load-bearing *modules*; not for glue,
  config, CSS, or one-shot scripts (those are covered by build + existing suites +
  lint / typecheck / security).
- **Branch-per-topic → Conventional Commit → CI-gated PR → squash on green → prune.**
  Each concern is its own reviewable PR; merge only when CI + tests are green; delete
  merged branches, local and remote.
- **Isolate discovery in subagents.** Fan out read-only exploration so search noise
  stays out of the main context; return structured findings only.
- **Compound learning.** Fix inline (1st occurrence) → `AGENT_LEARNINGS.md` (2nd) → an
  always-on rule (3rd) → a skill (recurring workflow). Promote by root cause, not symptom.
- **Identity hygiene.** noreply author, `--no-gpg-sign`, and prefix git/gh with
  `env -u GH_TOKEN -u GITHUB_TOKEN`.
- **Deepest-strictness lint/type gates, one knob per PR.** `verbatimModuleSyntax` +
  `noPropertyAccessFromIndexSignature` (both tsconfigs), `eslint-plugin-security`
  (worker+shared, `detect-object-injection` off + reviewed `detect-unsafe-regex`
  exceptions), and a **curated** `eslint-plugin-unicorn` (worker+ui) are now standing
  CI gates — each shipped as its own small, reviewable PR rather than one big-bang
  lint change. `eslint-plugin-jsx-a11y` stays deferred: its latest release peers
  ESLint `^3`–`^9`, incompatible with this repo's ESLint 10, and forcing it on would
  need `legacy-peer-deps` — which undermines the same dependency strictness the other
  knobs add.
- **A committed e2e run manifest carries history across sessions.** Each sweep run
  appends a compact JSON line (target, verdict, model-host hits, axe counts, broken
  flows) to `tests/e2e/runs.jsonl` (committed) alongside the existing gitignored
  per-run `summary.json` — a durable log a later session reads instead of re-parsing
  stdout or re-running the sweep to check history.
- **Queued hardening (not yet built).** `ruff` (the currently-unlinted `ingest/` +
  `tests/e2e/*.py`), `actionlint` (CI workflow linting), ESLint
  `reportUnusedDisableDirectives` + `eslint-plugin-regexp`, and a11y-strict (fix
  #154's contrast, gate axe on `serious`, run axe on a mobile viewport too).
