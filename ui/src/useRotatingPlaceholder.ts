import { useEffect, useState } from "react";

const ROTATE_MS = 3000;

// Pure: should the placeholder rotation TIMER be running right now? Extracted so the decision is
// unit-testable without mocking timers/matchMedia (same pattern as devmode.ts's matchesToggle).
export function shouldRotate(opts: { paused: boolean; reducedMotion: boolean; count: number }): boolean {
  return !opts.paused && !opts.reducedMotion && opts.count > 1;
}

// Cycles `examples` every ROTATE_MS while NOT paused and NOT prefers-reduced-motion; always starts on
// examples[0] (the "static first example" the reduced-motion case never leaves). `paused` should be true
// whenever the input has focus OR non-empty content — rotating a placeholder the user is actively
// looking at / typing into is disorienting, not helpful. Pass a STABLE `examples` reference (e.g. a
// module-scope array) so the effect re-runs only when `paused` flips, not on every render.
export function useRotatingPlaceholder(examples: readonly string[], paused: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!shouldRotate({ paused, reducedMotion, count: examples.length })) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % examples.length);
    }, ROTATE_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [paused, examples]);
  return examples[index] ?? "";
}
