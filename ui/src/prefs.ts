// prefs.ts (024 P0.2) — the app-shell preference contract: Appearance, text size, high contrast, and
// a default-location borough anchor. Pure, testable functions (storage/root injectable, real browser
// globals by default) — same shape as devmode.ts's readDevMode/writeDevMode.
//
// Appearance deliberately reuses theme-init.js's EXISTING mechanism (the `qte77-theme` localStorage
// key + the `data-theme` attribute on <html>) rather than inventing a parallel one: "system" IS the
// absence of an override, which is already exactly what theme-init.js and tokens.css's
// `@media (prefers-color-scheme: dark)` block do when no attribute is set.

interface AttrElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

const APPEARANCE_KEY = "qte77-theme";
const FONT_SCALE_KEY = "qte77-font-scale";
const HIGH_CONTRAST_KEY = "qte77-high-contrast";
const BOROUGH_KEY = "qte77-borough";

function store(explicit?: Storage): Storage | undefined {
  if (explicit) return explicit;
  return typeof localStorage !== "undefined" ? localStorage : undefined;
}

function root(explicit?: AttrElement): AttrElement | undefined {
  if (explicit) return explicit;
  return typeof document !== "undefined" ? document.documentElement : undefined;
}

export type Appearance = "system" | "light" | "dark";

/** "system" = no override — theme-init.js / the CSS prefers-color-scheme block decides. */
export function readAppearance(explicitRoot?: AttrElement): Appearance {
  const attr = root(explicitRoot)?.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : "system";
}

/** "system" clears the attribute AND the persisted key — the honest "no override" state, not a
 *  third stored value that could drift from what the attribute says. */
export function writeAppearance(v: Appearance, explicitRoot?: AttrElement, storage?: Storage): void {
  const r = root(explicitRoot);
  const s = store(storage);
  if (v === "system") {
    r?.removeAttribute("data-theme");
    try {
      s?.removeItem(APPEARANCE_KEY);
    } catch {
      /* storage disabled — non-fatal */
    }
  } else {
    r?.setAttribute("data-theme", v);
    try {
      s?.setItem(APPEARANCE_KEY, v);
    } catch {
      /* storage disabled — non-fatal */
    }
  }
}

export type FontScale = 1 | 1.25 | 1.5;
const FONT_SCALES: readonly FontScale[] = [1, 1.25, 1.5];
// 1.25 ("Large") matches the app's existing global readability bump (index.css's 106.25% base,
// 020 P4a) and the design's own largeTextDefault: true.
const DEFAULT_FONT_SCALE: FontScale = 1.25;

export function readFontScale(storage?: Storage): FontScale {
  try {
    const raw = store(storage)?.getItem(FONT_SCALE_KEY);
    const n = raw === null || raw === undefined ? NaN : Number(raw);
    return (FONT_SCALES as readonly number[]).includes(n) ? (n as FontScale) : DEFAULT_FONT_SCALE;
  } catch {
    return DEFAULT_FONT_SCALE;
  }
}
export function writeFontScale(v: FontScale, storage?: Storage): void {
  try {
    store(storage)?.setItem(FONT_SCALE_KEY, String(v));
  } catch {
    /* storage disabled — non-fatal */
  }
}

export function readHighContrast(storage?: Storage): boolean {
  try {
    return store(storage)?.getItem(HIGH_CONTRAST_KEY) === "1";
  } catch {
    return false;
  }
}
export function writeHighContrast(v: boolean, storage?: Storage): void {
  try {
    const s = store(storage);
    if (v) s?.setItem(HIGH_CONTRAST_KEY, "1");
    else s?.removeItem(HIGH_CONTRAST_KEY);
  } catch {
    /* storage disabled — non-fatal */
  }
}

/** A default-location ANCHOR for the Home search (prepended to a postcode-less prompt via
 *  shared/places.ts's resolvePlace) — never a within-borough filter. Null = no anchor set. */
export function readBorough(storage?: Storage): string | null {
  try {
    return store(storage)?.getItem(BOROUGH_KEY) ?? null;
  } catch {
    return null;
  }
}
export function writeBorough(v: string | null, storage?: Storage): void {
  try {
    const s = store(storage);
    if (v) s?.setItem(BOROUGH_KEY, v);
    else s?.removeItem(BOROUGH_KEY);
  } catch {
    /* storage disabled — non-fatal */
  }
}
