# AGENT_LEARNINGS

Ledger of recurring gotchas and their fixes (the compound-learning "2nd occurrence"
tier — see `.claude/rules/compound-learning.md`). Fix inline the first time; record it
here the second; promote to an always-on rule the third; extract a skill for a recurring
workflow. Human-facing patterns live in [`docs/engineering-practices.md`](docs/engineering-practices.md).

## Cloudflare: every bare wrangler command in worker/ hits the root Pages config

- **Pattern:** `make deploy` (`wrangler deploy`) *and* `make dev` (`wrangler dev`) run in
  `worker/` warn "you have run a Workers-specific command in a Pages project" and fail —
  wrangler v4 walks **up** the tree and prefers the root Pages config over
  `worker/wrangler.toml`. Same root cause bit both scripts.
- **Fix:** every wrangler subcommand in `worker/` needs `--config wrangler.toml`
  (`wrangler dev --config ...`, `wrangler deploy --config ...`). Pages is the separate
  `wrangler pages deploy ui/dist --project-name ... --branch main`; for UI-only changes do
  a **Pages-only** redeploy. The worker route re-assert needs `Zone > Workers Routes >
  Edit` and otherwise exits code 10000 *after* the script uploads fine — treat that step
  as non-fatal so a good deploy doesn't report failure.
- **Refs:** PR #99 (deploy) + #102 (route tolerance); the `dev` script needs the same fix;
  `scripts/provision_cf.sh`.

## ESLint 10 cannot lint files above its config; a `Partial<T>` cast hides real guards

- **Pattern (config):** `worker/eslint.config.js` could never lint `../shared/*.ts` — ESLint 10
  resolves a config's base path from the config file's own directory and **refuses files above
  it**, and `basePath` only scopes *downward*. The typed-lint project **service** compounds it by
  locating a project by walking **up** from each file, and `shared/` has no tsconfig above it. So
  the "clean root, no root package manifest" layout leaves shared code structurally unlintable.
- **Fix:** a **root** `eslint.config.js` that imports the worker's ruleset by relative path (so its
  bare deps still resolve from `worker/node_modules` — no root `package.json` needed), scoped with
  `basePath: "shared"`, and the parser pinned to the classic `project: ["./worker/tsconfig.json"]`
  (which must `include` `../shared`) instead of `projectService`. Chain it into worker's `lint`
  script so CI gates it with no ci.yml change. **Do not blanket-inherit the consumer's rule
  relaxations** into a security boundary — re-enable them explicitly.
- **Pattern (types):** casting untrusted parsed JSON straight to `as Partial<T>` asserts the very
  field types the validator exists to verify. It is circular: the type-checker then reports the real
  runtime null-guards as `no-unnecessary-condition`, and deleting them is a security regression. It
  hid a live bug — `isValidSearchResult` **threw** on `matches: [null]` instead of returning `false`.
- **Fix:** narrow (`typeof x !== "object" || x === null`) then cast to **`Record<string, unknown>`** —
  a *bridging* cast that asserts nothing about values, so every `typeof` check does real work. Prefer
  *widening* casts (`STAGES as readonly string[]`) over *assuming* ones. Guard each element of an
  untrusted array too. Also drop unnecessary casts on bundled JSON imports so the data is structurally
  **checked** against its interface rather than asserted.
- **Refs:** PR #123 (root config) + #124 (validator hardening, +2 tests), issue #122.

## Verify on the live target, not mocks or localhost

- **Pattern:** "Deploy done" was assumed but the site still served the previous build (a
  wrong command succeeded-looking). Unit mocks also miss binding/integration bugs.
- **Fix:** After deploying, inspect the served asset hashes + `Cache-Control` on the live
  URL before trusting any measurement. Drive the deployed target and regression-test the
  real failure mode, not just a stubbed one.
- **Refs:** PR #98 perf verification (headless probe against `sortmy.london`).

## `_headers` / CSP only take effect after a Pages deploy

- **Pattern:** Tweaked `_headers` (cache/CSP) and checked via `vite preview` — no effect.
- **Fix:** `vite preview` does not apply `_headers`; only a Cloudflare Pages deploy does.
  Verify header changes on the deployed URL, or via an e2e sweep after redeploy.
- **Refs:** PR #98 (P1 immutable cache).

## Font `unicode-range` subsetting: the win is CSS, not font bytes

- **Pattern:** Assumed dropping font subsets would cut font transfer (~46 → ~4 files).
- **Fix:** Browsers already fetch only the `unicode-range` subsets a page renders, so the
  measured saving was the **CSS payload** (fewer `@font-face` blocks), not font download.
  Claim only wins you can measure on the deployed build.
- **Refs:** PR #98 (P3 latin-only fonts).

## markdownlint MD004: a wrapped `+` at line start flips the file's bullet style

- **Pattern:** prose like `Cloudflare Pages + a Worker API` wrapping so `+ a Worker...`
  begins a line is parsed as a plus-marked list item; MD004 "consistent" then expects `+`
  for the whole file and flags every intended `-` bullet ("Expected: plus; Actual: dash").
- **Fix:** never let `+` (or `-` / `*`) start a wrapped line — reword (`plus`) or reflow.
  Bullets stay `-`. This is the handoff's "never `+` at line start" warning.
- **Refs:** PR #103; handoff 013/014.

## git rebase must disable signing here; stacked-on-squash needs `--onto`

- **Pattern:** `git rebase` failed with "gpg failed to sign" (repo signs commits, no key),
  and a branch stacked on a squash-merged PR showed the parent's diff again.
- **Fix:** rebase with `-c commit.gpgsign=false --no-gpg-sign` (commits already use
  `--no-gpg-sign`). After a stacked PR's base is squash-merged, replay only the top commit:
  `git rebase --onto origin/main <old-parent> <branch>`.
- **Refs:** PR #101 (P5 rebased onto main after #98 squash-merged).

## Pages SPA fallback + immutable `/assets/*` can cache-poison a deploy for a year

- **Pattern:** a sweep launched the instant `make deploy` returned found EVERY viewport blank with
  `Failed to load module script … MIME type "text/html"`. During the deploy-propagation window the
  new hashed asset briefly 404'd → Pages' **SPA fallback answered index.html (HTTP 200)** for the
  asset URL → our `_headers` rule stamped that HTML response `public, max-age=31536000, immutable`
  → the edge cached the poisoned **encoding variant** for a year. Curl (identity encoding) looked
  healthy while Chromium (br/gzip variant) kept getting HTML — so "verify the deploy landed" via
  curl alone can lie. Two consecutive sweeps failed on it.
- **Fix:** (1) immediate: **purge the poisoned URLs** from the zone cache (dashboard Caching →
  Purge, or an API token with Zone → Cache Purge — the deploy token lacks it). (2) durable:
  `ui/public/404.html` — its presence DISABLES the Pages SPA fallback, so a missing asset returns a
  real 404 (uncacheable as immutable HTML); safe because the app is single-route (query params
  only). (3) practice: never trust a sweep started in the same breath as a deploy — let the edge
  settle or pre-flight the asset MIME with browser-like headers; when curl and the browser disagree,
  suspect a per-encoding cache variant.
- **Refs:** postrename/postrename2 sweep FAILs (runs.jsonl 2026-07-23); the 404.html hardening PR.


## Firing a Workers cron for real: `--test-scheduled` does not exist in `--remote` dev

- **Pattern:** verifying a deployed `scheduled()` handler end-to-end (P1 #182): `wrangler dev
  --remote --test-scheduled` silently ignores the flag — `GET /__scheduled` falls through to your
  own `fetch` handler (here: a 404), so the "fire" looks like it happened but nothing ran. There is
  also NO public CF API to fire a deployed cron on demand.
- **Fix:** run **local** dev with a **remote binding**: temporary `wrangler.test.toml` = copy of
  `wrangler.toml` + `remote = true` on the `[[d1_databases]]` binding (+ drop `routes`), then
  `wrangler dev --test-scheduled --config wrangler.test.toml` and
  `curl http://127.0.0.1:<port>/__scheduled?cron=...` → `scheduled()` runs in local workerd against
  the REAL D1 + real outbound fetch. Verified: `ingest gazetteer: swapped=true rows=6656` landed in
  prod D1. Delete the temp config afterwards; the deployed daily cron remains the standing prover.
