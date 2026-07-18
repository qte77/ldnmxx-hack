// UK postcode validate + normalise. This is the security boundary for the corpus workflows: the postcode
// is the only user-derived string that reaches a query, and it is used solely to key a bundled lookup +
// a distance calc — there is NO external fetch, so no SSRF surface. The regex bounds the input to a
// postcode shape; anything else returns null (the caller falls back to a graceful "empty" result).
// Dependency-free + repo-root so any workflow (Worker or future browser path) can reuse it.

// Matches a UK postcode anywhere in the input (so "near SW9 9SL please" works), tolerant of a missing
// space between the outward + inward codes. Outward = 1-2 letters, a digit, an optional letter/digit;
// inward = a digit + 2 letters.
const UK_POSTCODE = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/i;

// Return the canonical "OUTWARD INWARD" upper-cased postcode (single space), or null if none is found.
export function normalisePostcode(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(UK_POSTCODE);
  const outward = m?.[1];
  const inward = m?.[2];
  if (outward === undefined || inward === undefined) return null;
  return `${outward.toUpperCase()} ${inward.toUpperCase()}`;
}
