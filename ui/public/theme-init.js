// Anti-FOUC: apply an explicit theme before first paint (else follow system preference). Kept as an
// external file (not an inline <script>) so the page's Content-Security-Policy can stay strict —
// script-src 'self', no 'unsafe-inline'. Loaded blocking in <head>, so it still runs before paint.
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
})();
