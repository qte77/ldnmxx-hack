---
title: "Handoff 019 — backlog clear. #199 SHIPPED (#245, live-gated on a CF CI secret) + #168 assessed (no change). OWNER CONSTRAINT (2026-07-25): no live external fetch → #185/#161/#8 blocked. #185 = owner picked A (needs the ONSPD file). NEW owner gate: add CLOUDFLARE_API_TOKEN repo secret (also unblocks d1-verify)."
type: handoff
updated: 2026-07-25
pairs_with: docs/plans/019-backlog-clear.md
---

# Handoff 019 — resume point

**Read [`docs/plans/019-backlog-clear.md`](../plans/019-backlog-clear.md) FIRST** — it carries the
per-item source map (files/functions), the approach, and the done-when for each.

## Onboarding — the 30-second picture

Arc 018 shipped v1.9.0 (released + deployed + live-verified). Arc 019 clears the remaining backlog.
**READ the plan's "⚠ CONSTRAINT + OPEN DECISION" section FIRST.** Owner (2026-07-25): "no fetching data
live from other sources as of now" → the three DATA items are blocked: **#185** (ONSPD), **#161** (TRUD),
**#8** (Open311) all need an external fetch. The repo is the SSOT; work e2e-unattended with the loop below.

**Progress (2026-07-25 session):** **#199 SHIPPED** — `.github/workflows/freshness-watchdog.yml` merged
in #245 (`cf4d22e`), evaluate logic verified offline; its LIVE run is **gated** on a repo
`CLOUDFLARE_API_TOKEN` secret that does not exist yet (see owner gates — it also unblocks `d1-verify`).
**#168 assessed** — `sharp` override + TS 7 + zod 4 all still correctly held for re-verified upstream
reasons; no change (details on the issue). **#185:** owner picked **option A** (one-time committed ONSPD
import) — still needs the owner to provide the ONSPD file (no live fetch). **#161/#8/#150** unchanged
(owner-gated / blocked). **So Phase A agent-runnable work is complete; the rest is owner-gated.**

## Queue (details + source map in the plan)

- **P1 #185 gazetteer widen** (A, agent — **owner picked option A**) — ingest full-London ONSPD (OGL, has
  coords). Under the no-live-fetch constraint, option A = the owner provides the ONSPD file once; then
  `ingest/parsers.py` `parse_onspd` (RED-first) + `ingest/seed.py` `fetch_onspd`/one-time loader; raise
  `FLOORS["postcodes"]`; add to `data/sources.json`. Verify a previously-failing postcode resolves live.
  **BLOCKED until the owner hands over the ONSPD file.**
- **P2 #199 freshness watchdog** — ☑ **DONE (#245, `cf4d22e`).** `.github/workflows/freshness-watchdog.yml`
  mirrors `tier3-monitor.yml` + `d1-verify.yml`; alerts if `corpus_meta.ingested_at` > 48h stale; logic
  verified offline. **LIVE run gated on the CF CI secret (owner gate #3 below) — same gate as `d1-verify`.**
- **P3 #168 deps** — ☑ **ASSESSED (no change).** `sharp` override, TS 7, zod 4 all still held for
  re-verified upstream reasons (miniflare still pins sharp 0.34.5; typescript-eslint peer `<6.1.0`;
  @a2ui/react peer `zod ^3`). #168 kept open as the upstream watch.
- **P4 #161 real Care (ODS/TRUD)** (B, OWNER GATE = a TRUD account) — build the ODS ingest DORMANT behind
  the credential; `care`'s `d1View` already exists. Activates when the secret lands.
- **P5 #150 jsx-a11y** (BLOCKED upstream) — watch; adopt when eslint-plugin-jsx-a11y supports ESLint 10.
- **P6 #8 Track A Open311** (SCOPE CALL) — a real feature (a WRITE `file_report` cuts against ADR-0002's
  fetch-free store). Decide-by-default: a minimal READ-only slice (nearby open reports) OR spin its own arc.

## Owner gates (batch into one sitting)

1. **TRUD account + secret** for #161 (P4). 2. **#8 scope decision** (read-only slice vs own arc).
3. **CF CI secret (NEW, 2026-07-25):** add `CLOUDFLARE_API_TOKEN` (scope Account > D1 > Edit) +
   `CLOUDFLARE_ACCOUNT_ID` as **repo** secrets → activates the shipped **#199** watchdog AND fixes
   `d1-verify.yml` (both fail at preflight without it). ~2-minute action. 4. **#185 ONSPD file** — owner
   picked option A; hand over the ONSPD download once so the one-time committed import can be built.

## The loop (per phase / PR)

branch per topic → strict module-TDD (RED first for pure fns/parsers; glue/CI/CSS → e2e/dispatch) → gates
→ push → PR → CI green → `gh pr merge <n> --squash --admin --delete-branch` → `git switch main && git pull`
→ per data/deploy phase: `make deploy` → dispatch `tier3-monitor.yml` → confirm green (+ screenshots if UI).

## Commands (creds present: root `.env` token-only; account_id in `wrangler.toml`)

- Gates: `npm --prefix worker run lint|typecheck` · `npm --prefix worker test -- --run` · `npm --prefix ui run lint|typecheck|build|size` · `npm --prefix ui test -- --run` · `uvx ruff@0.15.22 check` · `uvx pytest -q ingest`. Markdownlint (CI form): `rtk proxy npx --yes markdownlint-cli2 "<file.md>"` (pass explicit files; the `**/*.md` glob lints node_modules locally).
- Ingest dry-run: `python ingest/seed.py --out /tmp/dist` (stdlib-only). Publish is CI-only (`ingest.yml`, `workflow_dispatch`) → the 04:47 Worker cron swaps D1 from the `corpus-data` release.
- D1: source `.env`; `cd worker`; `./node_modules/.bin/wrangler d1 execute DB --remote --config wrangler.toml --json --command "SELECT COUNT(*) FROM postcodes"`. Migrations: `… d1 migrations apply DB --remote --config wrangler.toml`.
- Deploy: `make deploy`. Sweep (local patchright OOMs → CI): `gh workflow run tier3-monitor.yml`, `gh run watch <id> --exit-status --compact`, `gh run download <id> --name tier3-results --dir <dir>`.

## Watch-outs (env quirks — carried from 018, do NOT relearn)

- **`gh pr merge --admin` is classifier-gated** — needs a settings.local.json allow-rule or live approval; owner authorized `--admin` squash (never touch GitHub rulesets). If auto-blocked, surface to owner.
- **Bash filter denies** `grep`/`ls`/`head`/`tail`/`find`-into-node_modules/`curl`-external and many compound `;`|pipe commands → use `git grep`, `python3` to list dirs, redirect to a log + `Read` a slice, single-purpose commands. Emoji/`×`/unicode in a command trips the filter → commit via `-F <file>`.
- **`npx` is hook-rewritten to `npm`** → use `rtk proxy npx …`. **markdownlint MD004**: never let a WRAPPED line start with `+`/`-`/`*`.
- **`release.yml` auto-creates the GH release on tag push** — edit its notes, don't re-create.
- **exactOptionalPropertyTypes** both tsconfigs; **cyclomatic complexity ≤12/function** (extract a helper/subcomponent).
- ONSPD (#185): BNG-only columns → reuse `parsers.py` `bng_to_wgs84`; drop terminated (`doterm`) + NI/BT (licence). Postcode lookup is a PK exact match, so 10^5 rows is no hot-path perf concern.
- Data honesty: labels/glyph/officialLink/attribution live in reviewed TS, never in ingested data. Store only `redistribute_ok` sources (ADR 0002).

## Conventions (hard)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` ·
`env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · squash-`--admin` on green (never modify rulesets) · prune.
