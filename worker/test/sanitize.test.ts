import { describe, it, expect } from "vitest";
import { normalisePostcode } from "../../shared/sanitize";

describe("normalisePostcode", () => {
  it("canonicalises a well-formed postcode (upper-case, single space)", () => {
    expect(normalisePostcode("sw9 9sl")).toBe("SW9 9SL");
    expect(normalisePostcode("SW9 9SL")).toBe("SW9 9SL");
  });

  it("inserts the missing space between outward and inward codes", () => {
    expect(normalisePostcode("sw99sl")).toBe("SW9 9SL");
  });

  it("handles the longer outward form (letter+digit+letter)", () => {
    expect(normalisePostcode("ec1a 1bb")).toBe("EC1A 1BB");
    expect(normalisePostcode("W1A0AX")).toBe("W1A 0AX");
  });

  it("extracts a postcode embedded in a longer prompt", () => {
    expect(normalisePostcode("find services near SW9 9SL please")).toBe("SW9 9SL");
  });

  it("returns null for anything that is not a postcode", () => {
    expect(normalisePostcode("")).toBeNull();
    expect(normalisePostcode("hello world")).toBeNull();
    expect(normalisePostcode("12345")).toBeNull();
    expect(normalisePostcode(undefined as unknown as string)).toBeNull();
  });
});
