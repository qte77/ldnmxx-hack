// Dev-mode gate. The civic default hides all dev chrome (the AG-UI event console + the ⚙ Key panel);
// dev mode reveals it. Toggled by Ctrl+K / Ctrl+I or `?dev=1`, and persisted in localStorage under
// `qte77-dev` — mirrors the anti-FOUC theme trick in index.html (`qte77-theme` + `?theme=`).

const DEV_KEY = "qte77-dev";

function store(explicit?: Storage): Storage | undefined {
  if (explicit) return explicit;
  return typeof localStorage !== "undefined" ? localStorage : undefined;
}

/** The dev-mode toggle chord: Ctrl+K or Ctrl+I (case-insensitive). Not Cmd/meta — avoids hijacking
 *  macOS browser shortcuts. */
export function matchesToggle(e: { ctrlKey: boolean; key: string }): boolean {
  const k = e.key.toLowerCase();
  return e.ctrlKey && (k === "k" || k === "i");
}

/** Effective dev-mode on load: `?dev=1` forces on, `?dev=0` forces off, else the persisted flag. */
export function readDevMode(search = "", storage?: Storage): boolean {
  try {
    const dev = new URLSearchParams(search).get("dev");
    if (dev === "1") return true;
    if (dev === "0") return false;
    return store(storage)?.getItem(DEV_KEY) === "1";
  } catch {
    return false; // private mode / storage disabled — default to the civic (non-dev) view
  }
}

/** Persist dev-mode so it survives a reload without the `?dev` param. */
export function writeDevMode(on: boolean, storage?: Storage): void {
  try {
    const s = store(storage);
    if (on) s?.setItem(DEV_KEY, "1");
    else s?.removeItem(DEV_KEY);
  } catch {
    /* storage disabled — non-fatal */
  }
}
