import { describe, it, expect } from "vitest";
import { shouldRotate } from "../src/useRotatingPlaceholder";

// 018 P5 (g): the one load-bearing decision — whether the placeholder rotation timer should run —
// extracted pure so it is testable without mocking timers/matchMedia (mirrors devmode.ts's matchesToggle).
describe("shouldRotate", () => {
  it("rotates when not paused, motion is not reduced, and there is more than one example", () => {
    expect(shouldRotate({ paused: false, reducedMotion: false, count: 4 })).toBe(true);
  });
  it("never rotates under prefers-reduced-motion", () => {
    expect(shouldRotate({ paused: false, reducedMotion: true, count: 4 })).toBe(false);
  });
  it("never rotates while paused (input focused or has content)", () => {
    expect(shouldRotate({ paused: true, reducedMotion: false, count: 4 })).toBe(false);
  });
  it("never rotates with 0 or 1 example (nothing to cycle to)", () => {
    expect(shouldRotate({ paused: false, reducedMotion: false, count: 1 })).toBe(false);
    expect(shouldRotate({ paused: false, reducedMotion: false, count: 0 })).toBe(false);
  });
});
