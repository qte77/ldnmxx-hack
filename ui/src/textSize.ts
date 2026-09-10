// ui/src/textSize.ts (024 P3) — pure Text-size mapping for the Settings segmented control:
// prefs.ts's FontScale (1 | 1.25 | 1.5, the persisted/applied multiplier) <-> the design's
// Standard/Large/X-large labels, plus the root font-size percentage each scale resolves to.
//
// index.css's `:root { --fs: 1.25; font-size: calc(var(--fs) * 85%); }` is the ONE place the 85
// multiplier is consumed. 85 is chosen so the EXISTING default (FontScale 1.25, "Large" — matching
// prefs.ts's DEFAULT_FONT_SCALE and the app's pre-024 fixed 106.25% readability bump, 020 P4a)
// resolves to EXACTLY 106.25% (1.25 * 85 = 106.25): a user who never opens Settings sees no change.
// This deviates from the Claude Design mockup's own literal `calc(18px * var(--fs))` (an absolute
// px base) — see the PR description for the resolved px values at each scale and the rationale.
import type { FontScale } from "./prefs";

export const FONT_SCALE_OPTIONS: { id: FontScale; label: string }[] = [
  { id: 1, label: "Standard" },
  { id: 1.25, label: "Large" },
  { id: 1.5, label: "X-large" },
];

const ROOT_FONT_SIZE_PERCENT_PER_SCALE_UNIT = 85;

/** The root font-size percentage a scale resolves to (mirrors index.css's calc(var(--fs) * 85%)). */
export function fontScalePercent(scale: FontScale): number {
  return scale * ROOT_FONT_SIZE_PERCENT_PER_SCALE_UNIT;
}
