import { useState } from "react";
import { readAppearance, writeAppearance, type Appearance } from "../prefs";

const OPTIONS: { id: Appearance; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

// 024 P0.2: a MINIMAL, functional Appearance control — it replaces the old header ThemeToggle 1:1
// (same qte77-theme/data-theme mechanism, via prefs.ts) so dropping that header icon is not a
// regression. Row 6 (Settings screen) restyles this into the design's .seg/.seg-opt segmented-control
// look and adds the rest of the screen: text size, high contrast, borough, notifications-dropped,
// about — this file is that row's starting point, not its finished state.
export function Settings() {
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearance());
  const pick = (id: Appearance) => {
    writeAppearance(id);
    setAppearance(id);
  };
  return (
    <div className="pt-6 sm:pt-10">
      <h2 className="text-xl font-bold text-text">Settings</h2>
      <div className="mt-4">
        <p id="appearance-label" className="text-sm text-text-muted mb-2">
          Appearance
        </p>
        <div
          role="group"
          aria-labelledby="appearance-label"
          className="inline-flex rounded border border-border-strong overflow-hidden"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                pick(o.id);
              }}
              aria-pressed={appearance === o.id}
              className={`min-h-[44px] px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                appearance === o.id ? "bg-primary text-primary-on" : "text-text-muted hover:text-text"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
