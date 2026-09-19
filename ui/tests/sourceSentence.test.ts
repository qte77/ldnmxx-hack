import { describe, it, expect } from "vitest";
import { sourceSentence } from "../src/sheet/sourceSentence";

describe("sourceSentence", () => {
  it("combines source and date into one sentence when both are present", () => {
    expect(sourceSentence("Care Quality Commission", "2026-09-09")).toBe(
      "This is the same information Care Quality Commission publishes, updated 2026-09-09.",
    );
  });

  it("drops the date clause when only source is present", () => {
    expect(sourceSentence("Care Quality Commission", null)).toBe(
      "This is the same information Care Quality Commission publishes.",
    );
  });

  it("falls back to a bare date sentence when only asOf is present", () => {
    expect(sourceSentence(undefined, "2026-09-09")).toBe("Updated 2026-09-09.");
  });

  it("returns null when neither is present (nothing honest to say)", () => {
    expect(sourceSentence(undefined, null)).toBeNull();
  });
});
