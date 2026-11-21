#!/usr/bin/env python3
"""e2e UI sweep for sortmy.london (plan 013 · item D).

Drives the SPA across viewport x device x orientation with raw Patchright (Chromium, headless),
capturing the DevTools console + network, screenshots per state, and video for the desktop run.

The load-bearing assertion is the **item-A security guard**: after the browser-BYOK path was deleted,
the page must NEVER issue a direct request to a model host (openrouter.ai / api.openai.com / ...), and
the console must never carry the "User not found" 401 that the old direct-OpenRouter call produced.
Any such hit fails the whole sweep (exit 1) so this doubles as a regression gate.

Run via polyfetch's venv (Patchright + Chromium already provisioned):
    /workspaces/qte77/polyfetch-scrape/.venv/bin/python tests/e2e/ui_sweep.py <url> <label>
Examples:
    ... tests/e2e/ui_sweep.py https://sortmy.london remote
    ... tests/e2e/ui_sweep.py http://localhost:5173 local     # needs `make dev` running

Artifacts land in tests/e2e/results/<label>/ (gitignored). Video uses raw Patchright's
record_video_dir (polyfetch's render_session has a teardown bug that drops the file).
"""
import contextlib
import json
import os
import sys
import time
from datetime import UTC, datetime

from patchright.sync_api import sync_playwright

TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://sortmy.london"
LABEL = sys.argv[2] if len(sys.argv) > 2 else "remote"
OUT = os.path.join(os.path.dirname(__file__), "results", LABEL)
os.makedirs(OUT, exist_ok=True)

# A model host must never be contacted from the browser (item-A invariant).
MODEL_HOSTS = ("openrouter.ai", "api.openai.com", "generativelanguage", "api.anthropic.com")

CONFIGS = [  # (name, context_kwargs, record_video)
    ("desktop", {"viewport": {"width": 1440, "height": 900}}, True),  # video: LANDSCAPE
    ("mobile-portrait", {"device": "iPhone 13"}, True),  # video: PORTRAIT (both orientations, #130)
    ("mobile-landscape", {"device": "iPhone 13 landscape"}, False),
    ("tablet-portrait", {"device": "iPad (gen 7)"}, False),
    ("tablet-landscape", {"device": "iPad (gen 7) landscape"}, False),
]


def hook(page, cons, net):
    page.on("console", lambda m: cons.append((m.type, m.text[:180])) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: cons.append(("pageerror", str(e)[:180])))
    page.on("requestfailed", lambda r: net.append((r.url[:90], "FAILED " + str(r.failure)[:40])))
    page.on("response", lambda r: net.append((r.url[:90], r.status)) if r.status >= 400 else None)


def click(page, name, exact=False, t=2500):
    try:
        page.get_by_role("button", name=name, exact=exact).first.click(timeout=t)
        page.wait_for_timeout(400)
        return True
    except Exception:
        return False


def close_sheet(page):
    """ResultSheet.tsx's full-viewport backdrop AND its visible ✕ button share the SAME accessible
    name ("Close results" via aria-label) — click()'s .first resolves to the backdrop, whose
    click-point (Playwright clicks a target's geometric center) coincides with the DIALOG's own area
    on >=640px viewports (Tailwind `sm:items-center sm:justify-center` centers the sheet there), so the
    click lands on the dialog instead of reaching the backdrop underneath and the sheet never closes.
    Confirmed empirically: every viewport >=640px (desktop/tablet/mobile-landscape) left the sheet open
    and blocking #civic-query for the next flow; only mobile-portrait's bottom-anchored sheet (no
    center collision) worked. .last is always the dialog's own ✕ button (DOM order: backdrop first,
    dialog's ✕ second) — on top regardless of viewport width."""
    try:
        page.get_by_role("button", name="Close results").last.click(timeout=2500)
        page.wait_for_timeout(400)
        return True
    except Exception:
        return False


# The civic flows this sweep drives live in flows.json (a DATA manifest), so a new workflow is a
# manifest edit, not a change to this test source. P3 (017): each entry is a TYPED ask — `query` (with
# a routing keyword), `markers` (rendered result incl. its own summary line so flows sharing one surface
# can't false-pass off a stale render), and an optional `routedTo` (the workflow the Worker's router must
# pick, asserted as "Showing: <title>"). There is no `switchLabel` any more — the router decides.
def load_flows():
    with open(os.path.join(os.path.dirname(__file__), "flows.json"), encoding="utf-8") as fh:
        return json.load(fh)["flows"]


FLOWS = load_flows()

# How long a typed flow may take to render its markers. A fixed 8 s sleep failed the no-match flow
# intermittently (#337): its screenshots showed the result still running ("Stop" visible) while the
# same ask timed live at 1.3-4.0 s (12 calls, 2026-11-21), so an occasional slow model-router answer
# outlasted the sleep. Waiting for the markers returns as soon as they render and still fails on a
# real break.
RENDER_BUDGET_MS = 30000


def wait_for_markers(page, wanted, budget_ms=RENDER_BUDGET_MS):
    """Wait until every string in `wanted` is in the page text, up to `budget_ms`; return seconds."""
    started = time.monotonic()
    # A timeout is not an error here: the caller reads the body and reports what is missing.
    with contextlib.suppress(Exception):
        page.wait_for_function(
            "ms => ms.every(m => document.body.innerText.includes(m))",
            arg=list(wanted),
            timeout=budget_ms,
        )
    return time.monotonic() - started


def run_typed_flow(page, out, tag, flow, shot_n):
    """Type a REAL free-text ask into the single input, submit, and assert the Worker BOTH routed it
    to the right workflow (the "Showing: <title>" announcement) AND rendered that workflow's cards.

    Load-bearing: submitting an empty input only ever yields the no-match / "enter a valid …" state,
    so without typing + asserting both routing and markers, a broken router or render would still pass
    this sweep. Needs the Worker (a deployed target) — a vite-only preview serves the static landing
    page with no router, so the corpus flows will correctly fail there.
    """
    name, query, markers = flow["name"], flow["query"], tuple(flow["markers"])
    routed = flow.get("routedTo")
    try:
        page.fill("#civic-query", query)
    except Exception as e:
        print(f"    !! {name} fill: {e}")
        return False
    if not click(page, "Find it", t=3000):
        print(f"    !! {name}: CTA 'Find it' not found")
        return False
    waited = wait_for_markers(page, markers + ((f"Showing: {routed}",) if routed else ()))
    try:
        page.screenshot(path=f"{out}/{tag}-{shot_n}.png")
        body = page.inner_text("body")
    except Exception as e:
        print(f"    !! {name} read: {e}")
        return False
    missing = [m for m in markers if m not in body]
    if routed and f"Showing: {routed}" not in body:
        missing.append(f"routed→{routed}")
    if missing:
        print(f"    !! {name} did not route/render in {waited:.1f}s; missing={missing}")
        return False
    print(f"    {name}: routed + rendered for {query!r} in {waited:.1f}s")
    return True


# #353: the budget for a first personal answer on a fresh device, no sign-in: 2 taps + 1 field. The
# path is Home's area select (one tap opens it, the borough chosen is the field), then a card tap.
# Every interaction on the path goes through FirstAnswerSteps, which counts as it acts, so a step added
# to the path raises the count and the run fails once it is over budget.
FIRST_ANSWER_MAX_TAPS = 2
FIRST_ANSWER_MAX_FIELDS = 1
AREA, OTHER_AREA = "Camden", "Hackney"
# Rendered only by the Worker's corpus answer (worker/src/corpus/render.ts: the care summary line and
# the "<glyph> N services near <place>" title), so neither can come from the client-side chips or label.
FIRST_ANSWER_MARKERS = ("Showing: Sort My Care", "Nearest public-service signposts", f"services near {AREA}")


class FirstAnswerSteps:
    """Acts AND counts: a native select is one tap to open plus one field; a button is one tap."""

    def __init__(self, page):
        self.page, self.taps, self.fields = page, 0, 0

    def choose(self, selector, value):
        self.taps += 1
        self.fields += 1
        self.page.select_option(selector, value)

    def tap(self, name):
        self.taps += 1
        return click(self.page, name, exact=True, t=3000)

    def over_budget(self):
        return self.taps > FIRST_ANSWER_MAX_TAPS or self.fields > FIRST_ANSWER_MAX_FIELDS


def select_value(page, selector, timeout=5000):
    """The select's value once it is on the page (Settings is a lazy chunk), or None."""
    try:
        page.wait_for_selector(selector, timeout=timeout)
        return page.eval_on_selector(selector, "el => el.value")
    except Exception:
        return None


def body_text(page):
    try:
        return page.inner_text("body")
    except Exception as e:
        print(f"    !! read body: {e}")
        return ""


def screenshot(page, path):
    with contextlib.suppress(Exception):
        page.screenshot(path=path)


def clear_area(page):
    """Unset the area on Home (or in storage if Home's select is not reachable); True when Home reads ''.
    Keeps the typed flows below unanchored: the no-match and scam asks name no place."""
    with contextlib.suppress(Exception):
        page.select_option("#area-select", "", timeout=3000)
    with contextlib.suppress(Exception):
        page.evaluate("() => localStorage.removeItem('qte77-borough')")
    return select_value(page, "#area-select", timeout=3000) == ""


def choosing_area_changed_nothing(page):
    """WCAG 3.2.2: choosing an area only stores it; it neither navigates nor submits."""
    return (
        select_value(page, "#civic-query", timeout=1000) == ""
        and page.get_by_role("button", name="Close results").count() == 0
        and "Showing:" not in body_text(page)
    )


def area_syncs(page, out, tag):
    """Home's area select and Settings' select are one stored value (ui/src/AreaSelect.tsx + prefs.ts):
    the area set on Home shows in Settings, and a change there shows on Home. Ends with the area cleared."""
    ok = True
    click(page, "Change", exact=False)
    if select_value(page, "#borough-select") != AREA:
        print(f"    !! area sync: Settings does not show the Home area {AREA!r}")
        ok = False
    with contextlib.suppress(Exception):
        page.select_option("#borough-select", OTHER_AREA)
    click(page, "Home", exact=True)
    if select_value(page, "#area-select") != OTHER_AREA:
        print(f"    !! area sync: Home does not show the Settings area {OTHER_AREA!r}")
        ok = False
    if not clear_area(page):
        print("    !! area sync: the area did not clear")
        ok = False
    screenshot(page, f"{out}/{tag}-03-area-sync.png")
    return ok


def first_answer_path(page, out, tag):
    steps = FirstAnswerSteps(page)
    try:
        steps.choose("#area-select", AREA)
    except Exception as e:
        print(f"    !! first answer: Home area select: {e}")
        return False
    if not choosing_area_changed_nothing(page):
        print("    !! first answer: choosing an area navigated or submitted (WCAG 3.2.2)")
        return False
    if not steps.tap("Sort My Care"):
        print("    !! first answer: 'Sort My Care' card not found")
        return False
    waited = wait_for_markers(page, FIRST_ANSWER_MARKERS)
    asked = select_value(page, "#civic-query", timeout=1000)
    body = body_text(page)
    screenshot(page, f"{out}/{tag}-03-first-answer.png")
    close_sheet(page)
    missing = [m for m in FIRST_ANSWER_MARKERS if m not in body]
    if asked != f"GP near {AREA}" or missing:
        print(f"    !! first answer: asked {asked!r}, missing={missing} after {waited:.1f}s")
        return False
    if steps.over_budget():
        print(
            f"    !! first answer took {steps.taps} taps + {steps.fields} fields "
            f"(budget {FIRST_ANSWER_MAX_TAPS} + {FIRST_ANSWER_MAX_FIELDS})"
        )
        return False
    print(f"    first personal answer: {steps.taps} taps + {steps.fields} field, {AREA}, {waited:.1f}s")
    return True


def first_personal_answer(page, out, tag):
    """#353: from a fresh device, pick an area on Home, then tap a card; the Worker's answer must be for
    that area, within the tap/field budget. Then check Home and Settings agree. The area is always
    cleared afterwards, even when a step fails early."""
    try:
        return first_answer_path(page, out, tag) and area_syncs(page, out, tag)
    finally:
        clear_area(page)


def interactive_smoke(page, out, tag):
    """026: click-through the NEW interactive elements this arc shipped — the header borough "Change"
    link, the trust-bar dismiss X, a category-card tap (bypass routing via submitPrompt(text, id), NOT
    the typed-ask router flows.json/run_typed_flow already cover), and a "Recently looked up" chip
    re-running its usecase. Desktop + mobile-portrait only, mirroring axe_matrix/run_axe's existing
    asymmetric richness (full check on the two reference viewports; the typed-flow loop alone still
    runs on every config)."""
    # #353 first, while the context is fresh (no area, no recent chips): the budget is for a new visitor.
    ok = first_personal_answer(page, out, tag)

    # "Change" (BoroughSwitcher, ui/src/screens/Home.tsx) navigates Home -> Settings' borough select,
    # and back. Its accessible name is "{boroughLine} Change" (both spans concatenate) — a fresh
    # Patchright context has no localStorage, so boroughLine reads "Set your area"; match on the
    # stable "Change" suffix only (exact=False), not the full borough-dependent string.
    if click(page, "Change", exact=False):
        try:
            page.wait_for_selector("#borough-select", timeout=3000)
            page.screenshot(path=f"{out}/{tag}-03-change-settings.png")
        except Exception as e:
            print(f"    !! Change nav: borough-select not found: {e}")
            ok = False
        click(page, "Home", exact=True)
        try:
            page.wait_for_selector("#civic-query", timeout=5000)
        except Exception as e:
            print(f"    !! Change nav: back on Home failed: {e}")
            ok = False
    else:
        print("    !! 'Change' link not found")
        ok = False

    # Trust bar (TrustBar, Home.tsx): dismiss, confirm it's gone. aria-label="Dismiss" is the button's
    # WHOLE accessible name (an aria-label overrides text content), so exact=True is correct here.
    if click(page, "Dismiss", exact=True):
        page.wait_for_timeout(200)
        try:
            visible = page.get_by_text("Free · No sign-up · No cookies").is_visible()
        except Exception:
            visible = False
        if visible:
            print("    !! trust bar still visible after dismiss")
            ok = False
        else:
            page.screenshot(path=f"{out}/{tag}-04-trustbar-dismissed.png")
    else:
        print("    !! trust-bar Dismiss button not found")
        ok = False

    def tap_card_or_chip(name):
        """A CategoryCard/RecentChips button's accessible name is its title text alone (no Demo/
        sample-data badge on the 4 real usecases used here) — exact=True is safe. Needs the same
        ~8s settle as a typed flow, since it drives a real Worker run via submitPrompt's bypass path."""
        if not click(page, name, exact=True, t=3000):
            print(f"    !! '{name}' button not found")
            return False
        page.wait_for_timeout(8000)
        try:
            body = page.inner_text("body")
        except Exception as e:
            print(f"    !! '{name}' read: {e}")
            return False
        if f"Showing: {name}" not in body:
            print(f"    !! '{name}' tap did not open the expected result")
            return False
        page.screenshot(path=f"{out}/{tag}-05-{name.replace(' ', '-')}.png")
        close_sheet(page)
        return True

    # first_personal_answer already tapped the "Sort My Care" card, so it is in "Recently looked up",
    # which renders BEFORE CategoryCardList in the DOM (Home.tsx): click()'s .first resolves these
    # "Sort My Care" taps to the recent CHIP ("tap a chip re-runs its usecase"); the card tap itself is
    # covered by first_personal_answer. "Sort My Wander" has no chip yet, so that tap is a card tap.
    ok = tap_card_or_chip("Sort My Care") and ok
    ok = tap_card_or_chip("Sort My Wander") and ok
    ok = tap_card_or_chip("Sort My Care") and ok

    return ok


def sweep(page, out, tag):
    def shot(n):
        try:
            page.screenshot(path=f"{out}/{tag}-{n}.png")
        except Exception as e:
            print(f"    shot {n}: {e}")

    shot("01-load")
    # 026: the new interactive elements (borough switcher, trust bar, category-card tap, recent chip)
    # get their own click-through pass on the two reference viewports before anything else touches the
    # page state (dismissing the trust bar / accumulating recent-chip history should not perturb the
    # typed-ask flows below, which key off #civic-query + the router, not these bypass-mode taps).
    interactive_ok = interactive_smoke(page, out, tag) if tag in ("desktop", "mobile-portrait") else True
    # 024 (ADR 0006): the header's light/dark glyph toggle is gone — Appearance moved into Settings as
    # a System/Light/Dark control (ui/src/screens/Settings.tsx). Visit Settings, set Dark (deterministic,
    # unlike the old toggle's "flip whatever's current"), screenshot, then back to Home — every flow
    # below needs #civic-query, which only exists on the Home screen.
    if click(page, "Settings", exact=True):
        page.wait_for_timeout(200)
        (click(page, "Dark", exact=True) or click(page, "Light", exact=True)) and shot("02-theme")
        click(page, "Home", exact=True)
        page.wait_for_selector("#civic-query", timeout=5000)
    # P3 (017): each flow is a TYPED ask into the one input; the Worker's router picks the workflow.
    # A flow's own summary line is in its markers, so a leftover render from a prior flow can never
    # false-pass a broken one; the no-match flow asserts the discovery card.
    ok = interactive_ok
    for f in FLOWS:
        rendered = run_typed_flow(page, out, tag, f, f"run-{f['name']}")
        ok = ok and rendered
        # 024: a result now opens in a modal ResultSheet whose backdrop covers #civic-query (z-40) —
        # close it before the next flow, or that flow's page.fill("#civic-query", ...) fails against
        # an obscured element. See close_sheet()'s docstring for why it's NOT click(page, "Close
        # results") — that resolves to the backdrop, which is occluded by the sheet itself above 640px.
        close_sheet(page)
    return ok


def model_host_hits(net):
    """network entries that touched a model host (the item-A regression)."""
    return [(url, status) for url, status in net if any(h in url for h in MODEL_HOSTS)]


def user_not_found(cons):
    return [c for c in cons if "user not found" in c[1].lower() or "openrouter" in c[1].lower()]


def context_kwargs(pw, name, kw, video):
    """Resolve Patchright new_context kwargs for a config (device preset, viewport, video dir)."""
    ck = {}
    if "device" in kw:
        d = pw.devices.get(kw["device"])
        ck.update(d) if d else ck.update({"viewport": {"width": 390, "height": 844}})
    if "viewport" in kw:
        ck["viewport"] = kw["viewport"]
    if video:
        ck["record_video_dir"] = f"{OUT}/video-{name}"
    return ck


def load(page):
    try:
        page.goto(TARGET, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector("#civic-query", timeout=15000)  # the flow-agnostic hero input
    except Exception as e:
        print(f"    load: {e}")


def snapshot_a11y(page):
    try:
        aria = page.locator("body").aria_snapshot()
        print(f"    a11y: button={'- button' in aria} heading={'- heading' in aria}")
        with open(f"{OUT}/a11y-desktop.txt", "w") as f:
            f.write(aria)
    except Exception as e:
        print(f"    a11y: {e}")


_AXE_SRC = None


def axe_source():
    """The VENDORED axe-core (tests/e2e/vendor/axe.min.js) — self-hosted so the sweep never loads a lib
    from an external server, mirroring the app's strict no-external-resources CSP."""
    global _AXE_SRC
    if _AXE_SRC is None:
        with open(os.path.join(os.path.dirname(__file__), "vendor", "axe.min.js"), encoding="utf-8") as fh:
            _AXE_SRC = fh.read()
    return _AXE_SRC


def run_axe(page, name):
    """Inject vendored axe-core and run a WCAG 2 A/AA scan on the current page. Injected via
    page.evaluate (CDP main-world eval) so the page's strict script-src CSP doesn't block it — the same
    reason `add_script_tag` would fail here. Returns (critical_count, serious_count) and writes the full
    violations list to results/<label>/axe-<config>.json for triage. The sweep GATES on `critical` +
    `serious` (WCAG AA); anything below (moderate/minor) is not gated."""
    try:
        page.evaluate(axe_source())  # defines window.axe (not subject to page CSP)
        results = page.evaluate(
            "async () => await window.axe.run(document, "
            "{runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa']}, resultTypes: ['violations']})"
        )
    except Exception as e:
        print(f"    axe: {e}")
        return 0, 0
    violations = results.get("violations", [])
    critical = [v for v in violations if v.get("impact") == "critical"]
    serious = [v for v in violations if v.get("impact") == "serious"]
    try:
        with open(f"{OUT}/axe-{name}.json", "w") as fh:
            json.dump(violations, fh, indent=2)
    except Exception as e:
        print(f"    axe write: {e}")
    for v in critical + serious:
        print(f"      !! axe {v.get('impact')}: {v.get('id')} x{len(v.get('nodes', []))} — {v.get('help')}")
    print(f"    axe(wcag2a/aa): {len(violations)} violations — "
          f"{len(critical)} critical + {len(serious)} serious (all gated)")
    return len(critical), len(serious)


# 024 (ADR 0006) replaced the three ADR-0005 accent variants with ONE sourced civic navy/red palette,
# in both light and dark — there is no data-variant axis left to scan. Contrast is still
# scheme-sensitive (light/dark swap --color-primary/-text/-bg/... — the same axe rule that caught fo's
# dark indigo at 3.89:1 under ADR 0005, before it ever shipped), so the matrix collapses to schemes only.
SCHEMES = ("light", "dark")


def set_appearance(page, scheme):
    """Drive the same data-theme attribute the app's own init script + Settings' Appearance control
    write (ui/public/theme-init.js, ui/src/prefs.ts)."""
    page.evaluate(
        "(s) => { document.documentElement.setAttribute('data-theme', s); }",
        scheme,
    )
    page.wait_for_timeout(150)  # let the repaint land before axe reads computed styles


def axe_matrix(page, out, name):
    """Full WCAG scan per colour scheme, with a screenshot of each so the appearance is reviewable and
    not just the pass/fail. Returns summed (critical, serious)."""
    crit = ser = 0
    for scheme in SCHEMES:
        set_appearance(page, scheme)
        try:
            page.screenshot(path=f"{out}/{name}-{scheme}.png")
        except Exception as e:
            print(f"    shot {scheme}: {e}")
        print(f"    -- scheme={scheme}")
        c, s = run_axe(page, f"{name}-{scheme}")
        crit += c
        ser += s
    return crit, ser


def summarize(cons, net):
    """Print the per-config console/network summary; return (model_host_hits, openrouter/401 lines)."""
    errs = [c for c in cons if c[0] in ("error", "pageerror")]
    bad = [n for n in net if (isinstance(n[1], int) and n[1] >= 400) or "FAIL" in str(n[1])]
    mh = model_host_hits(net)
    unf = user_not_found(cons)
    print(f"    console_errors={len(errs)} network>=400/failed={len(bad)} model_host_hits={len(mh)}")
    for c in errs[:4]:
        print("      C", c)
    for n in bad[:6]:
        print("      N", n)
    for h in mh:
        print("      !! MODEL-HOST", h)
    return mh, unf


def close_context(context, browser, page, video):
    vpath = None
    try:
        context.close()  # read video path only AFTER context.close(), BEFORE browser.close()
        vpath = page.video.path() if video else None
    except Exception as e:
        print(f"    close/video: {e}")
    browser.close()
    if vpath:
        print(f"    video={vpath}")


def run_config(pw, name, kw, video):
    """Drive one viewport/device config end to end; return its (model_host_hits, openrouter lines)."""
    print(f"\n=== {LABEL} · {name} ===")
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(**context_kwargs(pw, name, kw, video))
    page = context.new_page()
    cons, net = [], []
    hook(page, cons, net)
    load(page)
    print(f"    title={page.title()!r} viewport={page.viewport_size}")
    flows_ok = sweep(page, OUT, name)
    axe_crit, axe_ser = 0, 0
    if name == "desktop":
        snapshot_a11y(page)
        # Desktop carries the full light/dark scheme matrix; mobile-portrait keeps a single scan so
        # the narrow-viewport layout is still gated without doubling the runtime.
        axe_crit, axe_ser = axe_matrix(page, OUT, name)
    elif name == "mobile-portrait":
        axe_crit, axe_ser = run_axe(page, name)
    mh, unf = summarize(cons, net)
    close_context(context, browser, page, video)
    return mh, unf, flows_ok, axe_crit, axe_ser


def report(model_hits, unf, broken, a11y_crit, a11y_ser):
    ok = True
    if model_hits or unf:
        print(f"FAIL: browser contacted a model host ({len(model_hits)}) / "
              f"openrouter|'user not found' console lines ({len(unf)}) — item-A regression.")
        for h in model_hits:
            print("   MODEL-HOST", h)
        for u in unf:
            print("   CONSOLE", u)
        ok = False
    if broken:
        print(f"FAIL: a corpus flow (flows.json) did not render on: {', '.join(broken)}.")
        ok = False
    if a11y_crit or a11y_ser:
        print(f"FAIL: axe-core found {a11y_crit} critical + {a11y_ser} serious WCAG 2 A/AA "
              f"violation(s) across the desktop light/dark scheme matrix + mobile "
              f"(see results/{LABEL}/axe-<config>.json).")
        ok = False
    if not ok:
        return 1
    print("PASS: no browser→model-host request, no openrouter/401 console line, every corpus flow "
          "rendered, and 0 critical/serious axe violations across light/dark on desktop, plus mobile.")
    return 0


def main():
    print(f"TARGET={TARGET}  LABEL={LABEL}  OUT={OUT}")
    model_hits, unf, broken, a11y_crit, a11y_ser = [], [], [], 0, 0
    with sync_playwright() as pw:
        for name, kw, video in CONFIGS:
            mh, u, flows_ok, axe_crit, axe_ser = run_config(pw, name, kw, video)
            model_hits += mh
            unf += u
            a11y_crit += axe_crit
            a11y_ser += axe_ser
            if not flows_ok:
                broken.append(name)
    print(f"\nARTIFACTS: {OUT}")
    print("=" * 60)
    rc = report(model_hits, unf, broken, a11y_crit, a11y_ser)
    write_summary(rc, model_hits, unf, broken, a11y_crit, a11y_ser)
    append_run_manifest(rc, model_hits, unf, broken, a11y_crit, a11y_ser)
    return rc


def write_summary(rc, model_hits, unf, broken, a11y_crit, a11y_ser):
    """Machine-readable verdict at results/<label>/summary.json — the cross-session handoff artifact
    (a next session reads this instead of re-parsing stdout, and it can carry an in-flight run's state)."""
    summary = {
        "target": TARGET,
        "label": LABEL,
        "ran_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "verdict": "PASS" if rc == 0 else "FAIL",
        "model_host_hits": len(model_hits),
        "openrouter_or_401_lines": len(unf),
        "axe_critical": a11y_crit,
        "axe_serious": a11y_ser,
        "configs": [c[0] for c in CONFIGS],
        "flagship_rendered": [c[0] for c in CONFIGS if c[0] not in broken],
        "flagship_broken": broken,
    }
    with open(os.path.join(OUT, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(f"SUMMARY: {os.path.join(OUT, 'summary.json')} -> {summary['verdict']}")


def append_run_manifest(rc, model_hits, unf, broken, a11y_crit, a11y_ser):
    """Append this run to tests/e2e/runs.jsonl — a COMMITTED, append-only cross-session resume manifest
    (one compact JSON object per line). summary.json holds the full per-run verdict in the gitignored
    results/; this is the durable log a later session reads to see run history + resume an in-flight
    sweep. Committed deliberately (git only records it when you `git add` it), so runs don't churn."""
    record = {
        "ran_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "target": TARGET,
        "label": LABEL,
        "verdict": "PASS" if rc == 0 else "FAIL",
        "model_host_hits": len(model_hits),
        "openrouter_or_401_lines": len(unf),
        "axe_critical": a11y_crit,
        "axe_serious": a11y_ser,
        "flows_broken": broken,
    }
    path = os.path.join(os.path.dirname(__file__), "runs.jsonl")
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
        print(f"MANIFEST: appended run to {path}")
    except Exception as e:
        print(f"    manifest: {e}")


if __name__ == "__main__":
    sys.exit(main())
