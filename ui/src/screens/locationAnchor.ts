// 024 P1: a default-location ANCHOR for a Home submission — never a within-borough filter. Appends the
// user's saved borough (Settings, prefs.ts's readBorough) to a submitted ask ONLY when the ask names no
// location of its own, so the Worker's existing place-resolution still has a starting point when the
// user typed none. Reuses the two real location-detection primitives verbatim (DRY, not reimplemented):
// shared/sanitize.normalisePostcode (the Worker's own postcode check) and shared/places.resolvePlace
// (the borough/landmark alias resolver) — both already fetch-free and already tested at their own layer.
import { normalisePostcode } from "../../../shared/sanitize";
import { resolvePlace } from "../../../shared/places";

export function withLocationAnchor(text: string, borough: string | null): string {
  if (!borough) return text;
  // An empty/whitespace-only ask is not an ask — anchoring it would turn "" into ", Camden", which
  // could reach the router as a non-empty prompt and make it guess a workflow instead of correctly
  // seeing an empty ask (ADR: one input, no silent mount-time/default fallback).
  if (!text.trim()) return text;
  if (normalisePostcode(text) !== null) return text;
  if (resolvePlace(text) !== null) return text;
  return `${text}, ${borough}`;
}
