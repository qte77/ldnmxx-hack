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

  // P2 (018 #224): accept a bare OUTWARD code when no full postcode is present, so the app's own
  // placeholder ("food hygiene near SE1") resolves. A full postcode must always win.
  it("parses a bare outward code when no full postcode is present (the placeholder bug, #224)", () => {
    expect(normalisePostcode("food hygiene near SE1")).toBe("SE1");
    expect(normalisePostcode("GP near E8")).toBe("E8");
    expect(normalisePostcode("wander near N1")).toBe("N1");
    expect(normalisePostcode("near SW1A")).toBe("SW1A");
  });

  it("upper-cases a lower-case outward code", () => {
    expect(normalisePostcode("food hygiene near se1")).toBe("SE1");
  });

  it("prefers a full postcode over any outward-shaped token elsewhere in the prompt", () => {
    expect(normalisePostcode("try SE1 or properly SE1 7PB")).toBe("SE1 7PB");
  });

  it("does not extract an outward code from inside a longer alphanumeric token", () => {
    expect(normalisePostcode("ref AB123456")).toBeNull();
  });
});
