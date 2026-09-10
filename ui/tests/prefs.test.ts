import { describe, it, expect } from "vitest";
import {
  readAppearance,
  writeAppearance,
  readFontScale,
  writeFontScale,
  readHighContrast,
  writeHighContrast,
  readBorough,
  writeBorough,
} from "../src/prefs";

// Map-backed Storage + element stand-ins (the ui test env is node — no real localStorage/DOM).
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
function fakeRoot(initAttr: string | null = null) {
  let attr = initAttr;
  return {
    getAttribute: (name: string) => (name === "data-theme" ? attr : null),
    setAttribute: (name: string, value: string) => {
      if (name === "data-theme") attr = value;
    },
    removeAttribute: (name: string) => {
      if (name === "data-theme") attr = null;
    },
  };
}

describe("readAppearance / writeAppearance — reuses theme-init.js's data-theme/qte77-theme mechanism", () => {
  it("reads 'system' when no data-theme attribute is set", () => {
    expect(readAppearance(fakeRoot())).toBe("system");
  });
  it("reads the explicit attribute when present", () => {
    expect(readAppearance(fakeRoot("light"))).toBe("light");
    expect(readAppearance(fakeRoot("dark"))).toBe("dark");
  });
  it("writeAppearance('light'/'dark') sets the attribute + persists the key", () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    writeAppearance("dark", root, storage);
    expect(readAppearance(root)).toBe("dark");
    expect(storage.getItem("qte77-theme")).toBe("dark");
  });
  it("writeAppearance('system') clears the attribute + the persisted key (no override = CSS decides)", () => {
    const root = fakeRoot("dark");
    const storage = fakeStorage({ "qte77-theme": "dark" });
    writeAppearance("system", root, storage);
    expect(readAppearance(root)).toBe("system");
    expect(storage.getItem("qte77-theme")).toBeNull();
  });
});

describe("readFontScale / writeFontScale", () => {
  it("defaults to 1.25 (Large — matches the app's existing readability bump) when unset", () => {
    expect(readFontScale(fakeStorage())).toBe(1.25);
  });
  it("round-trips a valid scale", () => {
    const s = fakeStorage();
    writeFontScale(1, s);
    expect(readFontScale(s)).toBe(1);
    writeFontScale(1.5, s);
    expect(readFontScale(s)).toBe(1.5);
  });
  it("falls back to the default on a corrupt/unknown stored value", () => {
    expect(readFontScale(fakeStorage({ "qte77-font-scale": "9" }))).toBe(1.25);
    expect(readFontScale(fakeStorage({ "qte77-font-scale": "not-a-number" }))).toBe(1.25);
  });
});

describe("readHighContrast / writeHighContrast", () => {
  it("defaults to false when unset", () => {
    expect(readHighContrast(fakeStorage())).toBe(false);
  });
  it("round-trips true and false", () => {
    const s = fakeStorage();
    writeHighContrast(true, s);
    expect(readHighContrast(s)).toBe(true);
    writeHighContrast(false, s);
    expect(readHighContrast(s)).toBe(false);
  });
});

describe("readBorough / writeBorough", () => {
  it("defaults to null (no location anchor) when unset", () => {
    expect(readBorough(fakeStorage())).toBeNull();
  });
  it("round-trips a borough name, and clears back to null", () => {
    const s = fakeStorage();
    writeBorough("Camden", s);
    expect(readBorough(s)).toBe("Camden");
    writeBorough(null, s);
    expect(readBorough(s)).toBeNull();
  });
});
