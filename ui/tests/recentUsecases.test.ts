import { describe, it, expect } from "vitest";
import { pushRecent } from "../src/screens/recentUsecases";

// 026 row 5: "Recently looked up" ring buffer — pure so dedup/max-3/most-recent-first is unit-tested
// directly (rendering stays e2e's job, mirroring categoryCards.ts's own pure/tested split).
describe("pushRecent", () => {
  it("prepends a new id, most-recent-first", () => {
    expect(pushRecent([], "a")).toEqual(["a"]);
    expect(pushRecent(["a"], "b")).toEqual(["b", "a"]);
  });

  it("moves an already-present id to the front without duplicating it", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("evicts the oldest id once a 4th distinct id is pushed (max stays 3)", () => {
    const withThree = pushRecent(pushRecent(pushRecent([], "a"), "b"), "c");
    expect(withThree).toEqual(["c", "b", "a"]);
    expect(pushRecent(withThree, "d")).toEqual(["d", "c", "b"]);
  });
});
