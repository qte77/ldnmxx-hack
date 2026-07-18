---
title: "Plan 013 — sortmy.london: AG-UI/A2UI showcase → civic product (security · console-gate · brand · e2e · security-review)"
type: plan
updated: 2026-07-18
status: "not started — approved, ready to execute"
refs: ["#75 deploy (merge first)", "#72 Care (shipped #81)", "qte77/brand @qte77/ui-theme", "polyfetch-scrape"]
---

# Plan 013 — showcase → civic product

> **Read the Source Map (bottom) — file:line for everything; do NOT re-explore.** Full scope approved by the
> user (fuller dev-mode, full theme migration). Ends with a strict security review. Persist progress by ticking
> the Progress table; after **each major step** emit a **concise** block: `[N/7 · X%] ✓ shipped: … | ▶ next: …`.

## Context

`sortmy.london` is live but the UI is the hackathon **AG-UI/A2UI showcase** (dev event console, BYOK key panel,
◫ Catalog, Demo/Live). Wrong for the ICP: a stressed, **mobile-first Londoner** needing the right **official**
public service, unable to afford a wrong answer. **Keep the engine** (swap-a-JSON workflows = the asset); make
the **UI a civic product** — task-first, trust-forward (freshness + "signpost, not advice"), no dev chrome.
**USP:** *"the honest, free way to find the official public service you need near you — and know it's current."*
The deeper UX restructure (task-first landing + wiring `sort-my-care` as the flagship civic flow) is a **follow-on
(013b), flagged not built here.**

**Live security bug** (confirmed by source + Patchright/Chromium capture): the deployed bundle inlined a real
(now-invalid) OpenRouter key from `ui/.env`; the browser `liveAgent` path calls OpenRouter directly → `401 "User
not found"`. Item A removes the whole class.

## Progress — this run's queue (`% = done / 8`)

**Shipped before this plan (context):** 2a v1-align (#77) · 2b Care engine (#81) · full-CF deploy live · DMARC
`p=reject` + no-mail lockdown · 401 diagnosed + live-confirmed · deploy-script fixes → #75.

| # | Queue item | Status |
|---|---|---|
| 0 | Merge #75 → main (single source) | ✅ shipped (#75 · CHANGELOG + care-test `/api/run` fixup) |
| A | Security: delete browser-BYOK → Worker path + hygiene + redeploy | ✅ shipped (#83 · redeployed + e2e-verified live) |
| B | Console-gate (fuller dev-mode) | ✅ shipped (#85) |
| C | Brand theme — vendored tokens (registry-independent, #82) | ✅ shipped (#86) |
| D | e2e UI harness (polyfetch/Patchright: viewport×device×orientation, DevTools console, screenshots+video) | ✅ shipped (#84) |
| E | Docs + issues (CHANGELOG/README/architecture/roadmap/UserStory/design; url/env/cli; open+close issues) | ▶ in progress |
| G | Civic essentials — a11y (WCAG AA) · privacy analytics + note · SEO/social meta · failure/empty states | ✅ shipped (#87) |
| F | Full-project strict security review (end) | ☐ to ship |

**Current: 6/8 = 75%** — E in progress; F + the batched final redeploy from main remain.

---

## 0. Prereq — merge #75 → main
Verify #75 green (deploy-fix commits `1c7db78`/`b1f40ca`/`29a28c3`), squash-merge (`--admin`) → main, prune
`feat/cf-pages-deploy` (remote+local). Clean (#75 didn't touch `App.tsx`; main's de-Tracked one wins). **All A–F
branch off updated main; redeploy from main.**

## A. Security — delete browser-BYOK, route via Worker, hygiene, redeploy · `feat/security-worker-only`
Worker `/api/run` already does BYOK safely (`worker/src/worker.ts:159-204` `resolveRun`: key-as-header →
keyed/free/stub server-side). Then:
- **Delete** `ui/src/agent/liveAgent.ts` + `ui/tests/liveAgent.test.ts`.
- `ui/src/agent/useAgentSSE.ts`: remove `runByokPath` (`:123-141`) + the `useByok` branch (`:206,209-213`) → always
  `runWorkerPath` (`:144-163`). Keep `buildHeaders` (`:85-89`, key→header). Drop orphaned `detectInjection` import.
- `ui/src/App.tsx`: drop `VITE_BYOK_*` prefill (`:98-99`) → `useState("")`. Keep ⚙ Key panel.
- `ui/package.json`: remove `@ai-sdk/openai` (`:18`) + `ai` (`:19`) → 345 KB `liveAgent-*.js` chunk gone.
- **Hygiene:** move `VITE_BYOK_*` from `ui/.env` → `ui/.env.development.local` (never on `build`); update
  `ui/.env.example` ("VITE_* = dev-only, NEVER in a build").
- **TDD (module, write test FIRST):** `useAgentSSE` — mock `fetch`; `run(...)` ALWAYS hits `WORKER_BASE + "/api/run"`,
  NEVER `openrouter.ai`. (Deletion needs no other new tests.)
- **Redeploy** from main (keyless): `npm --prefix ui run build` → `npx wrangler pages deploy ui/dist --project-name sortmy-london`.
- **User action:** confirm the leaked OpenRouter key is revoked.
- **Verify:** `make test` + ui `tsc` + `eslint`; post-redeploy console capture → no `openrouter` 401; keyed Run still works via `/api/run`.

## B. Console-gate — fuller dev-mode (civic-clean default) · `feat/dev-mode-gate`
Civic default = **prompt + Run + A2UI surface only**; dev-mode reveals AG-UI console + Catalog/⚙Key/Demo-Live.
(`claude-azure-workflows-gui` reference is Streamlit → conceptual only; implement React equivalents.)
- **New `ui/src/devmode.ts` (pure, tested):** `matchesToggle(e)` (`e.ctrlKey && (e.key==='k'||e.key==='i')`),
  `readDevMode()`/`writeDevMode()` (localStorage `qte77-dev` + `?dev=1` — mirror `ui/index.html:4-19` theme trick).
- **Delete (not gate) the dev-demo dead weight:** `◫ Catalog` → remove `CatalogViewer` (App.tsx:173) +
  `ui/src/CatalogViewer.tsx` + `ui/src/catalog.ts` (`buildCatalogBatch`) + `renderCatalog` (App.tsx:113-117) + any
  catalog test; and the **Live/Demo toggle** (App.tsx:152-172) → runs default Live (leave the Worker's `?demo=1` intact).
- `ui/src/App.tsx`: `devMode` ← `readDevMode()`; `useEffect` keydown (`preventDefault`+toggle) + header gear (`⋯`);
  gate behind `devMode`: the console `<aside>` (`:238-246`) + ⚙Key panel (`:174-181,186-203`).
- **TDD (module):** `ui/tests/devmode.test.ts` (matcher + persistence). Keydown wiring = glue (e2e).
- **Verify:** `make test`+tsc+lint; e2e — hidden by default, `Ctrl+K` reveals, `?dev=1`+reload persists.

## C. Brand theme — vendored tokens, registry-independent · `feat/brand-theme` · tracks #82
**Decision (#82): keep the `sortmy.london` build independent of the `@qte77` private registry** — vendor the brand
tokens, do NOT `npm i @qte77/ui-theme`. This drops the `.npmrc`/`NODE_AUTH_TOKEN` deploy-auth coupling entirely, so
the CF build stays keyless and is **not** blocked on #67. `ui/src/index.css` `@theme{}` (actual `:11-36`; token-setup
region `:1-76` ends where app rules begin `:78`; file is 303 lines) hand-copies tokens (drift). Tailwind v4:
- **Vendor** `tokens.css` into `ui/src/` with a **source-provenance header** (cite `qte77/brand` + the version/commit
  copied from). Replace the `@theme{}` block with `@import "tailwindcss"; @import "./tokens.css";`. Keep app rules
  (`.qte-*`/a11y/`.a2ui-surface` `:78-303`). **No** `ui/.npmrc`, **no** `NODE_AUTH_TOKEN`, **no** GitHub Packages auth.
- **Fonts (real gap):** `npm i @fontsource/inter @fontsource/jetbrains-mono` (**public** npm — registry-independent) +
  import in `ui/src/main.tsx` (today named but no `@font-face` → silent fallback).
- **Favicon:** `ui/public/favicon.svg` (`:5`, GH-blue `#388bfd`) → zero-blue mark copied from `qte77/brand/images/logo-mark.paths.dejavu.svg`.
- **Keep** the existing binary light/dark toggle + flagship (light-default) palette — light reads as more trustworthy
  for civic. (3-state toggle + BluBlock/dark-first → the Linear-theme issue; validate a palette against the ICP separately.)
- **Follow-on (optional, tracked in #82):** once #67 provisions `read:packages`, optionally swap vendored `tokens.css`
  for the `@qte77/ui-theme` package to kill manual re-vendoring; also open *"brand: add a Linear-style theme variant"*.
- **Verify:** `make test`+tsc+lint+markdownlint; keyless build (`npm --prefix ui ci` with no auth); e2e before/after screenshots (brand + real fonts + light/dark/system).

## D. e2e UI harness — polyfetch/Patchright · `feat/e2e-ui-harness` (test harness, NOT a module → no unit tests)
`.venv` ready (`/workspaces/qte77/polyfetch-scrape/.venv/bin/python`; patchright 1.61.2 + Chromium + ffmpeg).
- New `tests/e2e/ui_sweep.py` (seed from `scratchpad/e2e_console.py`): sweep **viewport × device × orientation**
  (desktop 1440×900, tablet, mobile; **portrait + landscape** via `" landscape"` device presets or viewport swap).
  Drive usecase/Live-Demo/theme/⚙Key/◫Catalog/prompt+**Run**; **DevTools console** (`.console_errors`/
  `.network_failures`) asserts **no `openrouter` 401** + clean console; assert A2UI cards + HUD chip + an **a11y** snapshot (`.page.locator("body").aria_snapshot()`); after B assert
  gated console; **screenshots** per state; **video** via `fetch(tier="patchright", render=RenderOptions(record_video_dir=...))`
  (render_session video broken — teardown bug). Targets: remote `sortmy.london` + local (`make dev` → :5173).
  Artifacts → `tests/e2e/results/` (gitignore).

**Ready harness — drop into `tests/e2e/ui_sweep.py`** (raw Patchright: handles video without the render_session
bug; run `.../polyfetch-scrape/.venv/bin/python tests/e2e/ui_sweep.py <url> <label>`; the site uses buttons, not
`<select>` dropdowns — swap to `page.select_option(...)` if a real dropdown lands):

```python
import os, sys
from patchright.sync_api import sync_playwright

TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://sortmy.london"
LABEL  = sys.argv[2] if len(sys.argv) > 2 else "remote"
OUT = os.path.join(os.path.dirname(__file__), "results", LABEL); os.makedirs(OUT, exist_ok=True)

CONFIGS = [  # (name, context_kwargs, record_video)
    ("desktop",          {"viewport": {"width": 1440, "height": 900}}, True),
    ("mobile-portrait",  {"device": "iPhone 13"},                      False),
    ("mobile-landscape", {"device": "iPhone 13 landscape"},            False),
    ("tablet-portrait",  {"device": "iPad (gen 7)"},                   False),
    ("tablet-landscape", {"device": "iPad (gen 7) landscape"},         False),
]

def hook(page, cons, net):
    page.on("console", lambda m: cons.append((m.type, m.text[:180])) if m.type in ("error","warning") else None)
    page.on("pageerror", lambda e: cons.append(("pageerror", str(e)[:180])))
    page.on("requestfailed", lambda r: net.append((r.url[:70], "FAILED " + str(r.failure)[:40])))
    page.on("response", lambda r: net.append((r.url[:70], r.status)) if r.status >= 400 else None)

def click(page, name, exact=False, t=2500):
    try:
        page.get_by_role("button", name=name, exact=exact).first.click(timeout=t); page.wait_for_timeout(400); return True
    except Exception:
        return False

def sweep(page, out, tag):
    def shot(n):
        try: page.screenshot(path=f"{out}/{tag}-{n}.png")
        except Exception as e: print(f"    shot {n}: {e}")
    shot("01-load")
    (click(page,"☾",exact=True) or click(page,"☀",exact=True)) and shot("02-theme")
    click(page,"On It") and shot("03-onit")
    click(page,"Catalog") and shot("04-catalog")   # (deleted after workstream B — will no-op)
    click(page,"Key") and shot("05-key")
    click(page,"Founder")
    if click(page,"Run",exact=True,t=3000): page.wait_for_timeout(6000); shot("06-after-run")

with sync_playwright() as pw:
    for name, kw, video in CONFIGS:
        print(f"\n=== {LABEL} · {name} ===")
        ck = {}
        if "device" in kw:
            d = pw.devices.get(kw["device"]);  ck.update(d) if d else ck.update({"viewport": {"width": 390, "height": 844}})
        if "viewport" in kw: ck["viewport"] = kw["viewport"]
        if video: ck["record_video_dir"] = f"{OUT}/video-{name}"
        browser = pw.chromium.launch(headless=True); context = browser.new_context(**ck); page = context.new_page()
        cons, net = [], []; hook(page, cons, net)
        try:
            page.goto(TARGET, wait_until="domcontentloaded", timeout=30000); page.wait_for_selector("text=Run", timeout=15000)
        except Exception as e: print(f"    load: {e}")
        print(f"    title={page.title()!r} viewport={page.viewport_size}")
        sweep(page, OUT, name)
        if name == "desktop":
            try:
                aria = page.locator("body").aria_snapshot(); print(f"    a11y: button={'- button' in aria} heading={'- heading' in aria}")
            except Exception as e: print(f"    a11y: {e}")
        errs = [c for c in cons if c[0] in ("error","pageerror")]
        bad  = [n for n in net if (isinstance(n[1],int) and n[1] >= 400) or "FAIL" in str(n[1])]
        print(f"    console_errors={len(errs)} network>=400/failed={len(bad)}")
        for c in errs[:4]: print("      C", c)
        for n in bad[:6]:  print("      N", n)
        vpath = None
        try:
            context.close();  vpath = page.video.path() if video else None   # read BEFORE browser.close()
        except Exception as e: print(f"    close/video: {e}")
        browser.close()
        if vpath: print(f"    video={vpath}")
print(f"\nARTIFACTS: {OUT}")
```
Expected today (pre-fix): `06-after-run` shows the "User not found" error + `network N ('openrouter.ai...', 401)`
— that's the item-A regression the harness guards; post-A it must be **absent**.

## E. Docs + issues (part of done)
CHANGELOG per PR · README (civic USP) · `docs/architecture.md` (civic view + gated dev-mode; browser never calls a
model API) · `docs/UserStory.md` + `docs/design.md` (ICP/USP; dark-first/BluBlock) · roadmap = `data/usecase-catalog.json`
· **url/env/cli:** document `?dev=1` (new), `?theme=`, `?usecase=`, `?demo=1` (no `NODE_AUTH_TOKEN` — build is
registry-independent, #82) · **issues:** #82 tracks brand (opened) + #88 tracks civic UX restructure 013b (opened); no 401 issue
exists (documented only in plan/handoff); PRs #83/#84/#85/#86/#87 reference #75/#82.

## G. Civic essentials — a11y · privacy analytics · SEO/meta · failure states · `feat/civic-essentials`
- **Accessibility (WCAG AA)** — semantic HTML, keyboard nav + focus order, a labelled postcode input, `aria-live` on
  results, AA contrast (brand targets AA). Fold fixes into the B/C UI PRs where touched (a11y is cross-cutting); assert
  in D via `aria_snapshot()`.
- **Privacy-first analytics + note** — enable **Cloudflare Web Analytics** (cookie-free, no PII) to measure user success
  (clicks to official links); add a one-line "no cookies / we track nothing" footer statement.
- **SEO / social meta** — real `<title>` + description + OpenGraph/Twitter tags (use brand `social-previews.toml`) in `ui/index.html`.
- **Friendly failure/empty states** — civic copy for invalid-postcode / no-services / worker-down (a next step, not a trace).
- **TDD:** only if a non-trivial pure helper emerges — else markup/glue, no unit tests.

## F. Full-project strict security review (END) · `feat/security-review-013`
Run `/security-review` + the `security-review` skill over the whole branch; manual: no secrets in the SPA bundle
(grep build for key patterns), Worker-secrets-only invariant, CORS/CSP/`_headers`, injection guard
(`shared/guard.ts`), postcode SSRF boundary (`shared/sanitize.ts`), rate-limit, DMARC/no-mail (done), deploy-token
least-privilege. Fixes as `fix/sec-*`; final e2e console capture as the gate. Record findings in `docs/adr/` or the handoff.

---

## Source Map (jump straight in)
**UI `ui/src/`** — `App.tsx`: USECASES `:10-25`; `ThemeToggle` `:34-57` (binary; `qte77-theme`); `StatusChip` `:67-90`;
`Dashboard` `:92`; **VITE_BYOK `:98-99`**; `onSubmit` `:104-111`; usecase buttons `:132-149`; **Live/Demo `:152-172`**;
**CatalogViewer `:173`**; **⚙Key `:174-181`+panel `:186-203`**; prompt/Run `:205-225`; A2UISurface `:232-237`; **AG-UI
console `<aside>` `:238-246`**. · `agent/useAgentSSE.ts`: `Byok` `:14-17`; **`buildHeaders` `:85-89`**; `readSSE`
`:102-119`; **`runByokPath` `:123-141` DELETE**; **`runWorkerPath` `:144-163` keep**; `run()` `:185`; **`useByok` `:206`
DELETE branch**. · `agent/liveAgent.ts` **DELETE** (`OPENROUTER_BASE :17-18`, `createOpenAI :84-87`, `streamPartToEvent
:40-68`) + `ui/tests/liveAgent.test.ts` DELETE. · `index.css` **`@theme{}` `:1-76` REPLACE**; app rules `:78-304` keep;
`theme/a2uiTheme.ts:15-49`; `A2UISurface.tsx:8-12`. · `index.html:4-19` anti-FOUC. · `public/favicon.svg:3-9` GH-blue.
· `package.json` deps `@ai-sdk/openai:18`,`ai:19` REMOVE; scripts `:7-14`.
**Worker** `worker/src/worker.ts:159-204` `resolveRun`; routing `/api/*` (deploy branch).
**Brand** `/workspaces/qte77/qte77/brand`: `DESIGN.md:9-53`; `ui-kit/README.md:12-24` (import) `:33-43` (npm auth);
`ui-kit/theme.js:10-131` (3-state); `images/logo-mark.paths.dejavu.svg`.
**polyfetch** `/workspaces/qte77/polyfetch-scrape` (`.venv/bin/python`): `render_session(url, wait_until="networkidle",
device=, viewport=(w,h), color_scheme=, record_video_dir=)` → `.page` + `.click/.click_text/.fill/.submit/
.wait_for_selector/.wait_ms/.shot/.console_errors/.network_failures`; **dropdowns** `.page.select_option`; **orientation**
`" landscape"` presets/viewport-swap; **screenshot** `.page.screenshot(path=)`; **VIDEO** `fetch(tier="patchright",
render=RenderOptions(record_video_dir=...))` (NOT render_session); headless-only.
**Deploy** `scripts/provision_cf.sh` (worker deploy `--config wrangler.toml`), `finish_cf.sh`; `wrangler.jsonc` (Pages
`sortmy-london`); `worker/wrangler.toml` (route `sortmy.london/api/*`); root `.env` (auto-sourced). Seed harness:
`scratchpad/e2e_console.py`.

## Conventions (hard)
Strict module-TDD (tests FIRST, model expected behavior; **only non-trivial tests, modules — NOT scripts/glue/CSS/
config**) · strict lint + typing + security every change · branch-per-topic + Conventional Commits · `env -u GH_TOKEN
-u GITHUB_TOKEN` on git/gh · noreply + `--no-gpg-sign` · SHA-pin new Actions · **push + squash-merge on green CI/tests**
(`--admin`) · **delete stale remote+local branches** · KISS/DRY/YAGNI · surface each green PR.

## Verification
`make test` + `tsc --noEmit` (ui+worker) + `eslint` + markdownlint + CI/CodeQL green per PR. A: no `openrouter` 401
post-redeploy. B: gated console persists. C: keyless (registry-independent) build; screenshots. D: screenshots+video across desktop/tablet/
mobile × portrait/landscape; console clean. F: `/security-review` clean; no bundled secrets. Final: redeploy from main;
`sortmy.london` live, clean, on-brand, civic-clean default.
