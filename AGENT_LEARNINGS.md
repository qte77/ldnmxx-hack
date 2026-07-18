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
