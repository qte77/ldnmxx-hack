import { useState } from "react";
import {
  readAppearance,
  writeAppearance,
  type Appearance,
  readFontScale,
  writeFontScale,
  type FontScale,
  readHighContrast,
  writeHighContrast,
  readBorough,
  writeBorough,
} from "../prefs";
import { boroughLabels } from "../boroughs";
import { FONT_SCALE_OPTIONS } from "../textSize";

const APPEARANCE_OPTIONS: { id: Appearance; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const BOROUGHS = boroughLabels();

// Shared control styling — same 44px touch-target + focus-ring pattern as Home.tsx's CONTROL_CLASS/
// CHIP_CLASS (WCAG 2.5.5 / 2.4.7), duplicated here rather than imported so Settings stays
// self-contained (AHA — a shared module for two call sites isn't worth the coupling yet).
const FOCUS_RING_CLASS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const SEG_WRAP_CLASS = "inline-flex rounded border border-border-strong overflow-hidden";
// 024 P6 (design-match): the design's .seg-opt:has(input:checked) never fills — an inset 1px ring in
// the accent colour marks the active option, text switches to the accent colour. Never bg-primary.
function segOptClass(active: boolean): string {
  return `min-h-[44px] px-4 text-sm font-semibold ${FOCUS_RING_CLASS} ${
    active ? "text-primary shadow-[inset_0_0_0_1px_var(--color-primary)]" : "text-text-muted hover:text-text"
  }`;
}

// A segmented control (role="group" + aria-pressed buttons) — the SAME visual/aria pattern for
// Appearance AND Text size, mirroring the Claude Design system's .seg/.seg-opt pattern reimplemented
// in this app's own Tailwind-v4 + tokens.css stack (not that system's literal plain-CSS classes).
function SegmentedControl<T extends string | number>({
  legendId,
  legend,
  options,
  value,
  onChange,
}: {
  legendId: string;
  legend: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mt-6">
      <p id={legendId} className="text-sm text-text-muted mb-2">
        {legend}
      </p>
      <div role="group" aria-labelledby={legendId} className={SEG_WRAP_CLASS}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              onChange(o.id);
            }}
            aria-pressed={value === o.id}
            className={segOptClass(value === o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// A labelled toggle switch (role="switch") — button hit-area kept at the app's 44x44 minimum even
// though the visual track is smaller, per the same pattern SegmentedControl's buttons use.
function HighContrastSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <div>
        <p id="hc-label" className="text-sm font-semibold text-text">
          High contrast
        </p>
        <p id="hc-desc" className="text-sm text-text-muted">
          Stronger borders and darker text
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-labelledby="hc-label"
        aria-describedby="hc-desc"
        onClick={onToggle}
        className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded ${FOCUS_RING_CLASS}`}
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 rounded-full border border-border-strong transition-colors ${
            value ? "bg-primary" : "bg-surface"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface-lift transition-transform ${
              value ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
    </div>
  );
}

// The borough <select> — a default-location ANCHOR for Home's search (shared/places.ts's
// resolvePlace), never a within-borough filter (prefs.ts's readBorough/writeBorough doc comment).
function BoroughSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="mt-6">
      <label htmlFor="borough-select" className="block text-sm font-semibold text-text mb-2">
        Your area
      </label>
      <select
        id="borough-select"
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value === "" ? null : e.target.value);
        }}
        className={`min-h-[44px] w-full px-3 rounded border border-border-strong bg-bg text-text ${FOCUS_RING_CLASS}`}
      >
        <option value="">Not set</option>
        {BOROUGHS.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <p className="mt-1 text-sm text-text-muted">
        Used as a starting point for your searches when you don&apos;t type a postcode or place.
      </p>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <p className="text-sm text-text-muted">
        sortmy.london is a free tool that helps you find official London public services. We find it,
        you sort it — a signpost to the official record, not advice. No account, no cookies.
      </p>
      <p className="mt-2 text-sm text-text-muted">
        <span title="deployed release" className="font-mono">
          v{__APP_VERSION__}
        </span>
      </p>
    </div>
  );
}

function applyFontScale(v: FontScale): void {
  document.documentElement.style.setProperty("--fs", String(v));
}
function applyHighContrast(v: boolean): void {
  if (v) document.documentElement.setAttribute("data-high-contrast", "true");
  else document.documentElement.removeAttribute("data-high-contrast");
}

// 024 P0.2 shipped a MINIMAL Appearance-only Settings screen (the 1:1 header-ThemeToggle
// replacement). 024 P3 (this file) adds the rest of the design's screen: Text size, High contrast,
// Your area (borough), About. Notifications (bin day / service updates) are DELIBERATELY dropped —
// no backend exists and the CSP blocks push notifications. "Send feedback" is left in Home's footer
// only (already a GitHub-issues link) rather than duplicated here — see the PR description.
//
// public/theme-init.js applies a RETURNING visitor's persisted Text-size/High-contrast prefs before
// first paint (mirroring how it already does this for Appearance); the state below only needs to
// read the same persisted values to sync these controls' initial display, and each handler re-applies
// live on change so every screen reflects a change immediately, not just after a reload.
export function Settings() {
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearance());
  const [fontScale, setFontScale] = useState<FontScale>(() => readFontScale());
  const [highContrast, setHighContrast] = useState<boolean>(() => readHighContrast());
  const [borough, setBorough] = useState<string | null>(() => readBorough());

  const pickAppearance = (id: Appearance) => {
    writeAppearance(id);
    setAppearance(id);
  };
  const pickFontScale = (v: FontScale) => {
    writeFontScale(v);
    applyFontScale(v);
    setFontScale(v);
  };
  const toggleHighContrast = () => {
    const next = !highContrast;
    writeHighContrast(next);
    applyHighContrast(next);
    setHighContrast(next);
  };
  const pickBorough = (v: string | null) => {
    writeBorough(v);
    setBorough(v);
  };

  return (
    <div className="pt-6 sm:pt-10 pb-6">
      <h2 className="text-xl font-bold text-text">Settings</h2>

      <SegmentedControl
        legendId="appearance-label"
        legend="Appearance"
        options={APPEARANCE_OPTIONS}
        value={appearance}
        onChange={pickAppearance}
      />

      <SegmentedControl
        legendId="text-size-label"
        legend="Text size"
        options={FONT_SCALE_OPTIONS}
        value={fontScale}
        onChange={pickFontScale}
      />

      <HighContrastSwitch value={highContrast} onToggle={toggleHighContrast} />

      <BoroughSelect value={borough} onChange={pickBorough} />

      <AboutSection />
    </div>
  );
}
