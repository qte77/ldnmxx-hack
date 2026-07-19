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
import json
import os
import sys
from datetime import datetime, timezone
from patchright.sync_api import sync_playwright

TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://sortmy.london"
LABEL = sys.argv[2] if len(sys.argv) > 2 else "remote"
OUT = os.path.join(os.path.dirname(__file__), "results", LABEL)
os.makedirs(OUT, exist_ok=True)

# A model host must never be contacted from the browser (item-A invariant).
MODEL_HOSTS = ("openrouter.ai", "api.openai.com", "generativelanguage", "api.anthropic.com")

CONFIGS = [  # (name, context_kwargs, record_video)
    ("desktop", {"viewport": {"width": 1440, "height": 900}}, True),
    ("mobile-portrait", {"device": "iPhone 13"}, False),
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


def sweep(page, out, tag):
    def shot(n):
        try:
            page.screenshot(path=f"{out}/{tag}-{n}.png")
        except Exception as e:
            print(f"    shot {n}: {e}")

    shot("01-load")
    (click(page, "☾", exact=True) or click(page, "☀", exact=True)) and shot("02-theme")
    # Progressive-disclosure civic flows (014·U): switch to On It, then back to the Care flagship.
    click(page, "Step-free journeys") and shot("03-onit")
    click(page, "Care services near you") and shot("04-care")
    if click(page, "Find care services", t=3000):  # the flagship CTA (was "Run")
        page.wait_for_timeout(6000)
        shot("05-after-run")


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
    sweep(page, OUT, name)
    if name == "desktop":
        snapshot_a11y(page)
    mh, unf = summarize(cons, net)
    close_context(context, browser, page, video)
    return mh, unf


def report(model_hits, unf):
    if model_hits or unf:
        print(f"FAIL: browser contacted a model host ({len(model_hits)}) / "
              f"openrouter|'user not found' console lines ({len(unf)}) — item-A regression.")
        for h in model_hits:
            print("   MODEL-HOST", h)
        for u in unf:
            print("   CONSOLE", u)
        return 1
    print("PASS: no browser→model-host request and no openrouter/401 console line across all configs.")
    return 0


def main():
    print(f"TARGET={TARGET}  LABEL={LABEL}  OUT={OUT}")
    model_hits, unf = [], []
    with sync_playwright() as pw:
        for name, kw, video in CONFIGS:
            mh, u = run_config(pw, name, kw, video)
            model_hits += mh
            unf += u
    print(f"\nARTIFACTS: {OUT}")
    print("=" * 60)
    rc = report(model_hits, unf)
    write_summary(rc, model_hits, unf)
    return rc


def write_summary(rc, model_hits, unf):
    """Machine-readable verdict at results/<label>/summary.json — the cross-session handoff artifact
    (a next session reads this instead of re-parsing stdout, and it can carry an in-flight run's state)."""
    summary = {
        "target": TARGET,
        "label": LABEL,
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "verdict": "PASS" if rc == 0 else "FAIL",
        "model_host_hits": len(model_hits),
        "openrouter_or_401_lines": len(unf),
        "configs": [c[0] for c in CONFIGS],
    }
    with open(os.path.join(OUT, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(f"SUMMARY: {os.path.join(OUT, 'summary.json')} -> {summary['verdict']}")


if __name__ == "__main__":
    sys.exit(main())
