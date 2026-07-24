// UK postcode validate + normalise. This is the security boundary for the corpus workflows: the postcode
// is the only user-derived string that reaches a query, and it is used solely to key a bundled lookup +
// a distance calc — there is NO external fetch, so no SSRF surface. The regex bounds the input to a
// postcode shape; anything else returns null (the caller falls back to a graceful "empty" result).
// Dependency-free + repo-root so any workflow (Worker or future browser path) can reuse it.

// Matches a UK postcode anywhere in the input (so "near SW9 9SL please" works), tolerant of a missing
// space between the outward + inward codes. Outward = 1-2 letters, a digit, an optional letter/digit;
// inward = a digit + 2 letters.
const UK_POSTCODE = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/i;

// P2 (018 #224): a bare OUTWARD code (SE1, E8, N1, SW1A — no inward part), tried ONLY when the full
// regex above misses. `\b` on both sides bounds the match to a whole token shaped exactly like an
// outward code — never a fragment of a longer alphanumeric run ("AB123456" has no internal boundary to
// land on) and never a slice of a run-together full postcode (that is consumed by UK_POSTCODE first).
const UK_OUTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\b/i;

// Return the canonical "OUTWARD INWARD" upper-cased postcode, the upper-cased OUTWARD code alone when no
// full postcode is present, or null if neither is found. A full postcode ALWAYS wins (checked first,
// unconditionally). The outcode token keys the SAME gazetteer (bundled JSON + the D1 `postcodes` table)
// a full postcode keys, so no caller branches on which shape it got — extending the data is enough.
export function normalisePostcode(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const full = UK_POSTCODE.exec(raw);
  const outward = full?.[1];
  const inward = full?.[2];
  if (outward !== undefined && inward !== undefined) {
    return `${outward.toUpperCase()} ${inward.toUpperCase()}`;
  }
  const outcode = UK_OUTCODE.exec(raw)?.[1];
  return outcode !== undefined ? outcode.toUpperCase() : null;
}
