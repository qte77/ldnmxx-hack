import { describe, it, expect } from "vitest";
import { readUsecase } from "../src/usecase";

// P3 (017): readUsecase shrinks to the ?usecase= BYPASS only. No more mount-time flagship fallback —
// an absent/unknown param returns null so the router (server-side) decides from the typed prompt
// instead of the UI silently forcing a default workflow.
const IDS = ["sort-my-care", "sort-my-route", "founders-copilot"] as const;

describe("readUsecase (?usecase= bypass)", () => {
  it("returns null when there is no ?usecase param (→ let the router decide)", () => {
    expect(readUsecase("", IDS)).toBeNull();
    expect(readUsecase("?dev=1", IDS)).toBeNull();
  });

  it("returns a known requested usecase (deep link / founders demo bypass)", () => {
    expect(readUsecase("?usecase=sort-my-route", IDS)).toBe("sort-my-route");
    expect(readUsecase("?usecase=founders-copilot", IDS)).toBe("founders-copilot");
  });

  it("returns null for an unknown or empty usecase (never a forced flagship)", () => {
    expect(readUsecase("?usecase=nope", IDS)).toBeNull();
    expect(readUsecase("?usecase=", IDS)).toBeNull();
  });

  it("finds the param among other query params", () => {
    expect(readUsecase("?dev=1&usecase=sort-my-route&theme=dark", IDS)).toBe("sort-my-route");
  });
});
