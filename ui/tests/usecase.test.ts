import { describe, it, expect } from "vitest";
import { readUsecase } from "../src/usecase";

const IDS = ["sort-my-care", "on-it", "founders-copilot"] as const;
const FALLBACK = "sort-my-care";

describe("readUsecase", () => {
  it("falls back to the flagship when there is no ?usecase param", () => {
    expect(readUsecase("", IDS, FALLBACK)).toBe("sort-my-care");
    expect(readUsecase("?dev=1", IDS, FALLBACK)).toBe("sort-my-care");
  });

  it("returns a known requested usecase, including the non-civic demo", () => {
    expect(readUsecase("?usecase=on-it", IDS, FALLBACK)).toBe("on-it");
    expect(readUsecase("?usecase=founders-copilot", IDS, FALLBACK)).toBe("founders-copilot");
  });

  it("ignores an unknown or empty usecase and falls back to the flagship", () => {
    expect(readUsecase("?usecase=nope", IDS, FALLBACK)).toBe("sort-my-care");
    expect(readUsecase("?usecase=", IDS, FALLBACK)).toBe("sort-my-care");
  });

  it("finds the param among other query params", () => {
    expect(readUsecase("?dev=1&usecase=on-it&theme=dark", IDS, FALLBACK)).toBe("on-it");
  });
});
