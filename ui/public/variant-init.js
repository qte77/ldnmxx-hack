// Anti-FOUC for the accent variant, mirroring theme-init.js: apply the chosen London accent before
// first paint so the page never flashes the default teal on its way to indigo/green. Kept as an
// external file (not an inline <script>) so the Content-Security-Policy can stay strict —
// script-src 'self', no 'unsafe-inline'. Loaded blocking in <head>, so it still runs before paint.
//
// Resolution order matches the theme: ?variant= › localStorage["qte77-variant"] › default (thames).
// "thames" is the default and has no [data-variant] rule in tokens.css — the @theme literals already
// ARE thames — but the attribute is still set so the cycle control can read the current state.
(function () {
  try {
    var url = new URLSearchParams(location.search).get("variant");
    var ls = localStorage.getItem("qte77-variant");
    var m = [url, ls].find(function (v) {
      return v === "thames" || v === "indigo" || v === "green";
    });
    document.documentElement.setAttribute("data-variant", m || "thames");
  } catch (e) {
    /* private mode / storage disabled — non-fatal, the default accent paints */
  }
})();
