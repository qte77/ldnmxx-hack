---
title: "Handoff 018 — post-launch polish. Start at P1 (row-read correction). Owner gate: the v1.8.0 tag."
type: handoff
updated: 2026-07-24
pairs_with: docs/plans/018-polish-input-honesty.md
---

# Handoff 018 — resume point

**Read [`docs/plans/018-polish-input-honesty.md`](../plans/018-polish-input-honesty.md) FIRST** — it
carries the source map, the LIVE measurements, and the per-phase TDD boundary. Predecessor **017 is
CLOSED** (single-input UX + auto-router + fo Linear theme, **deployed to `sortmy.london`**).

## The one-line why

017 shipped + deployed; live testing found a coherent polish/honesty/architecture backlog. Fix
correctness + honesty first (P1–P3), then config-separation (P4) and the visual pass (P5).

## State at handoff (2026-07-24)

- **Live:** 017's P1–P3 are **deployed** to `sortmy.london` (single input, router, theme) — verified:
  new build serving, entry JS `application/javascript` (no #178), Worker `/api` 204. **But prod is
  UNTAGGED** (footer still v1.7.0) and runs the **5 km widen** (row-read ~1.2×) + migration `0005`
  applied. Creds are repo-self-contained (`.env` token-only; account_id in `wrangler.toml`; **no
  `~/.cf-token`**).
- 🔴 **Two shipped-but-wrong things to own in P1–P2:** (1) P2b's docs claim ≥10× but prod is ~1.2×
  (fix = start widen at 0.5 km, LIVE-measured 17.5×); (2) `food hygiene near SE1` FAILS though "SE1" is
  the app's own placeholder (outward codes unsupported).
- **NEXT = P1 (row-read correction)** — one-line `WIDEN_KM` → `[0.5,2,8]` + correct the docs + re-measure
  live. Then P2 (outward postcodes, the SE1 bug) → P3 (the `data as of 1974` heritage-date honesty) →
  P4 (single shared usecase catalog) → P5 (visual/UX pass) → P6 (release).

## Reverted, to be redone properly in-arc (were ad-hoc; not lost)

These were prototyped live then reverted to keep 017 clean; redo with the plan's TDD boundary:

- **Row-read radius** `WIDEN_KM=[0.5,2,8]` (P1) — measured, one line.
- **Rotating example placeholders** (P5) — a `useRotatingPlaceholder(examples, paused)` hook over the
  routable examples, prefers-reduced-motion aware; pairs with P4's shared catalog (don't re-hardcode).

## Owner gate — the ONLY one

**The v1.8.0 tag.** Decide-by-default is to **HOLD** until P1–P3 land (so the released version isn't one
that errors on its own example), then tag v1.8.0 covering 017 + the must-fixes; 018's polish ships as
v1.9.0. Alternatively tag v1.8.0 now for the deployed 017 with honest caveats. Owner picks; the arc
proceeds under the default meanwhile.

## Deploy / verify (repo-self-contained, creds present this session)

`.env` holds `CLOUDFLARE_API_TOKEN` (token-only; account_id in `wrangler.toml`). Deploy: `make deploy`.
Migrations: `cd worker && ./node_modules/.bin/wrangler d1 migrations apply DB --remote --config
wrangler.toml`. Read-only measure: `wrangler d1 execute DB --remote --config wrangler.toml --json
--command "…"` (returns `meta.rows_read`). Sweep: `uv run --project /workspaces/qte77/polyfetch-scrape
python tests/e2e/ui_sweep.py https://sortmy.london <label>`. Local patchright may OOM → dispatch
`tier3-monitor.yml`.

## Gotchas (inherited — do not relearn)

- **markdownlint MD004:** never let a WRAPPED line start with `+`/`-`/`*` — it becomes a list marker and
  flips the whole file's bullet style (cost a lint failure this session). Single-file `markdownlint-cli2`
  runs mis-report config-disabled rules; trust the multi-file/glob (CI) form.
- **`exactOptionalPropertyTypes`:** optional props that can hold `undefined` need `?: T | undefined`.
- **Body reads once / `?usecase=` bypass / register-only** — see 017 handoff.
- Data honesty: labels/officialLink/attribution live in reviewed TS, never in ingested data.

## Conventions (hard — unchanged)

Conventional Commits · noreply (`qte77` / `93844790+qte77@users.noreply.github.com`) · `--no-gpg-sign` ·
`env -u GH_TOKEN -u GITHUB_TOKEN` on git/gh · strict module-TDD (RED first; glue/CSS/copy → e2e) ·
KISS/DRY/YAGNI/AHA · self-host all js/css/fonts · squash-`--admin` on green (never modify rulesets).
