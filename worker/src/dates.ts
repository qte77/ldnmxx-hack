// Freshness-date hygiene for the "data as of …" trust claim. The corpus/scam queries advertise the
// OLDEST `lastUpdated` across the shown rows as their freshness; that is only chronological when the
// dates are ISO `YYYY-MM-DD`. Today's samples are ISO, but W4's real ingest could introduce another
// format and silently break the claim — so validate the format here, at the boundary, before W4 (#128).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// True iff `s` is a strict ISO calendar date YYYY-MM-DD that round-trips (so 2026-13-01 / 2026-02-30
// are rejected, not silently rolled over).
export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const parsed = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s;
}

// The chronologically OLDEST valid ISO date — the conservative freshness to advertise. Non-ISO values
// are EXCLUDED (not sorted as raw strings), so a malformed date can never become a falsely-early/late
// "data as of". Null when no value is a valid ISO date, so the caller makes NO freshness claim rather
// than a wrong one.
export function oldestIsoDate(dates: readonly string[]): string | null {
  const valid = dates.filter(isIsoDate);
  if (valid.length === 0) return null;
  return valid.reduce((min, d) => (d < min ? d : min));
}
