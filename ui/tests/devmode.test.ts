import { describe, it, expect } from "vitest";
import { matchesToggle, readDevMode, writeDevMode } from "../src/devmode";

// A Map-backed Storage stand-in (the ui test env is node — no real localStorage).
function fakeStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe("matchesToggle", () => {
  it("is true for Ctrl+K / Ctrl+I (either case)", () => {
    expect(matchesToggle({ ctrlKey: true, key: "k" })).toBe(true);
    expect(matchesToggle({ ctrlKey: true, key: "K" })).toBe(true);
    expect(matchesToggle({ ctrlKey: true, key: "i" })).toBe(true);
    expect(matchesToggle({ ctrlKey: true, key: "I" })).toBe(true);
  });

  it("is false without Ctrl, or for any other key", () => {
    expect(matchesToggle({ ctrlKey: false, key: "k" })).toBe(false);
    expect(matchesToggle({ ctrlKey: true, key: "j" })).toBe(false);
    expect(matchesToggle({ ctrlKey: true, key: "Enter" })).toBe(false);
  });
});

describe("readDevMode / writeDevMode", () => {
  it("?dev=1 forces on and ?dev=0 forces off, overriding storage", () => {
    expect(readDevMode("?dev=1", fakeStorage())).toBe(true);
    expect(readDevMode("?dev=0", fakeStorage({ "qte77-dev": "1" }))).toBe(false);
  });

  it("falls back to the qte77-dev localStorage flag when no ?dev param", () => {
    expect(readDevMode("", fakeStorage({ "qte77-dev": "1" }))).toBe(true);
    expect(readDevMode("", fakeStorage())).toBe(false);
  });

  it("writeDevMode persists on and clears off (round-trips through readDevMode)", () => {
    const s = fakeStorage();
    writeDevMode(true, s);
    expect(readDevMode("", s)).toBe(true);
    writeDevMode(false, s);
    expect(readDevMode("", s)).toBe(false);
  });
});
