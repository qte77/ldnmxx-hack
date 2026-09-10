import { describe, it, expect } from "vitest";
import { categoryCards } from "../src/screens/categoryCards";

// Local fixtures (mirrors prefs.test.ts's fakeStorage/fakeRoot convention) rather than depending on
// the real usecases/*.json content, which can change independently of this ordering rule.
const care = { id: "sort-my-care", title: "Sort My Care", keywords: ["gp"], example: "GP near E8 3GT", blurb: "care" };
const wander = {
  id: "sort-my-wander",
  title: "Sort My Wander",
  keywords: ["wander"],
  example: "parks near SW9 9SL",
  blurb: "wander",
};
const scam = {
  id: "sort-my-scam-check",
  title: "Sort My Scam Check",
  keywords: ["scam"],
  example: "is X a scam",
  blurb: "scam",
  sampleData: true,
};
const route = { id: "sort-my-route", title: "Sort My Route", keywords: [], example: "step-free route", blurb: "route" };
const founders = {
  id: "founders-copilot",
  title: "Founder's Copilot",
  keywords: [],
  example: "an AI copilot",
  blurb: "founders",
};

// 024 P1: Home's "Common questions" card order. Pure so the ordering + flags are unit-tested directly
// (rendering itself stays e2e's job, per this repo's convention).
describe("categoryCards", () => {
  it("orders routable (real) usecases before the never-auto-routed demo pair, each in catalog order", () => {
    const out = categoryCards([founders, route, care, wander, scam]);
    expect(out.map((c) => c.id)).toEqual([
      "sort-my-care",
      "sort-my-wander",
      "sort-my-scam-check",
      "founders-copilot",
      "sort-my-route",
    ]);
  });

  it("preserves the sampleData flag through reordering (never dropped or mutated)", () => {
    const out = categoryCards([scam, care]);
    expect(out.find((c) => c.id === "sort-my-scam-check")?.sampleData).toBe(true);
    expect(out.find((c) => c.id === "sort-my-care")?.sampleData).toBeUndefined();
  });
});
