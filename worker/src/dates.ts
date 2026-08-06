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

// How a corpus's `asOf` (its oldest lastUpdated) should be WORDED — honest to what that date actually
// means for the source (P3, #225). A record's own age (a heritage listing year) must never be dressed
// up as data freshness; a corpus whose "oldest date" mixes record-ages sets "omit" rather than mislead.
export type DateLabelMode = "asOf" | "listedYear" | "inspected" | "omit";

// The per-corpus date CLAIM for the summary line. "" = no claim at all; the caller (render.ts) must
// drop the " · " separator too, never print a dangling "summaryLine · ". Static/editorial per corpus —
// never inferred from ingested row data (the repo-wide data-honesty rule).
// 023: the floor below which an "inspected" date cannot be real. FHRS stamps un-inspected venues with a
// placeholder (1900-01-01 AND 1901-01-01 — the ingest guard matched only the first, so 6,361 live rows
// told Londoners a venue was "inspected 1901-01-01"). The parser now drops them at ingest; this is the
// last line of defence for rows ALREADY stored, or a placeholder a future source invents. Scoped to
// `inspected` on purpose: `listedYear` dates are legitimately old (NHLE listings from 1949).
const MIN_PLAUSIBLE_INSPECTION_DATE = "2000-01-01";

export function formatDateLabel(mode: DateLabelMode, isoDate: string | null): string {
  if (mode === "omit" || isoDate === null) return "";
  if (mode === "listedYear") return `listed ${isoDate.slice(0, 4)}`;
  // No claim beats a false one: an implausible inspection date is a placeholder, not an inspection.
  if (mode === "inspected") {
    return isoDate < MIN_PLAUSIBLE_INSPECTION_DATE ? "" : `inspected ${isoDate}`;
  }
  return `data as of ${isoDate}`; // mode === "asOf"
}
