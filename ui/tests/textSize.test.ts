import { describe, it, expect } from "vitest";
import { fontScalePercent, FONT_SCALE_OPTIONS } from "../src/textSize";

describe("fontScalePercent", () => {
  it("maps the default scale (1.25, Large) to exactly 106.25% — the app's pre-024 fixed readability bump (020 P4a), unchanged for anyone who never opens Settings", () => {
    expect(fontScalePercent(1.25)).toBeCloseTo(106.25);
  });
  it("maps Standard (1) below the default and X-large (1.5) above it, linearly", () => {
    expect(fontScalePercent(1)).toBeCloseTo(85);
    expect(fontScalePercent(1.5)).toBeCloseTo(127.5);
  });
});

describe("FONT_SCALE_OPTIONS", () => {
  it("has exactly the three design labels, in Standard -> Large -> X-large order, matching prefs.ts's FontScale domain (1 | 1.25 | 1.5)", () => {
    expect(FONT_SCALE_OPTIONS.map((o) => o.id)).toEqual([1, 1.25, 1.5]);
    expect(FONT_SCALE_OPTIONS.map((o) => o.label)).toEqual(["Standard", "Large", "X-large"]);
  });
});
