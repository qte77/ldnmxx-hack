// Anti-FOUC: apply explicit prefs before first paint (else follow system/default). Kept as an
// external file (not an inline <script>) so the page's Content-Security-Policy can stay strict —
// script-src 'self', no 'unsafe-inline'. Loaded blocking in <head>, so it still runs before paint.
//
// 024 P3: extended beyond Appearance (data-theme) to also pre-apply the Settings "Text size"
// (--fs, consumed by index.css's `calc(var(--fs) * 85%)`, see ui/src/textSize.ts) and "High
// contrast" (data-high-contrast, see ui/src/index.css) prefs — so a RETURNING visitor who set either
// sees them from first paint, not only after screens/Settings.tsx mounts/re-applies them. The
// storage key names below must match prefs.ts's FONT_SCALE_KEY/HIGH_CONTRAST_KEY constants (this
// file already duplicates "qte77-theme" the same way, for the same CSP reason — it cannot import
// prefs.ts, a bundled ES module, since it runs before any bundle).
(function () {
  try {
    var url = new URLSearchParams(location.search).get("theme");
    var ls = localStorage.getItem("qte77-theme");
    var m = [url, ls].find(function (v) {
      return v === "light" || v === "dark";
    });
    if (m) document.documentElement.setAttribute("data-theme", m);
    else document.documentElement.removeAttribute("data-theme");
  } catch (e) {
    /* private mode / storage disabled — non-fatal */
  }

  try {
    var fs = Number(localStorage.getItem("qte77-font-scale"));
    if (fs === 1 || fs === 1.25 || fs === 1.5) {
      document.documentElement.style.setProperty("--fs", String(fs));
    }
  } catch (e) {
    /* private mode / storage disabled — non-fatal; index.css's --fs default applies */
  }

  try {
    if (localStorage.getItem("qte77-high-contrast") === "1") {
      document.documentElement.setAttribute("data-high-contrast", "true");
    }
  } catch (e) {
    /* private mode / storage disabled — non-fatal */
  }
})();
