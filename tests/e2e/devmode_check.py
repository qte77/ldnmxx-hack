#!/usr/bin/env python3
"""Dev-mode gate check for the SPA (plan 013 · item B).

Asserts the civic-clean default: the AG-UI event console and the ⚙ Key panel are HIDDEN by default,
Ctrl+K toggles them, and `?dev=1` enables dev mode and persists it across a reload without the param.

Run via polyfetch's venv against a built preview or a live URL:
    /workspaces/qte77/polyfetch-scrape/.venv/bin/python tests/e2e/devmode_check.py <url>
Examples:
    ... tests/e2e/devmode_check.py http://localhost:4173     # `npm --prefix ui run preview`
    ... tests/e2e/devmode_check.py https://sortmy.london
"""
import sys

from patchright.sync_api import sync_playwright

TARGET = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173"


def has_console(page):
    return page.get_by_text("AG-UI Events").count() > 0


def has_key(page):
    return page.get_by_role("button", name="Key").count() > 0


def load(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector("text=Run", timeout=15000)
    page.wait_for_timeout(300)


def main():
    fails = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_context(viewport={"width": 1280, "height": 800}).new_page()

        load(page, TARGET)
        print(f"default            console={has_console(page)} key={has_key(page)}  (expect False False)")
        if has_console(page):
            fails.append("AG-UI console visible in the civic default")
        if has_key(page):
            fails.append("⚙ Key visible in the civic default")

        page.keyboard.press("Control+k")
        page.wait_for_timeout(300)
        print(f"after Ctrl+K       console={has_console(page)} key={has_key(page)}  (expect True True)")
        if not has_console(page):
            fails.append("Ctrl+K did not reveal the console")
        if not has_key(page):
            fails.append("Ctrl+K did not reveal ⚙ Key")

        page.keyboard.press("Control+k")
        page.wait_for_timeout(300)
        print(f"after Ctrl+K x2    console={has_console(page)}  (expect False)")
        if has_console(page):
            fails.append("second Ctrl+K did not hide the console")

        sep = "&" if "?" in TARGET else "?"
        load(page, f"{TARGET}{sep}dev=1")
        print(f"?dev=1             console={has_console(page)}  (expect True)")
        if not has_console(page):
            fails.append("?dev=1 did not enable dev mode")

        load(page, TARGET)  # reload WITHOUT the param — must stay on (persisted)
        print(f"reload no-param    console={has_console(page)}  (expect True, persisted)")
        if not has_console(page):
            fails.append("dev mode did not persist across a reload")

        browser.close()

    print("=" * 54)
    if fails:
        for f in fails:
            print("FAIL:", f)
        return 1
    print("PASS: gate hidden by default · Ctrl+K toggles · ?dev=1 persists.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
