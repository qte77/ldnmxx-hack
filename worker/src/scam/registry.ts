// The scam-check dataset: fictional firms with their FCA-register status + Companies House number.
//
// Scam is a MATCH shape (name/number lookup), NOT the geo nearest-N corpus — a firm has no meaningful
// lat/lng, so it deliberately does not fit the frozen `CorpusRecord extends Coords` and lives in its
// own module rather than `corpus/registry.ts`. The record holds only FACTS; every honest display
// string (status label, "verify" guidance, official link) is derived in reviewed code (query.ts /
// render.ts), never authored here — so a data slip can never introduce a verdict.
//
// Synthetic + committed + fictional (naming a real firm as a clone is a defamation risk). Real FCA /
// Companies House data is keyed (Worker secrets) and lands at W4; the request path stays fetch-free.
import firmsJson from "../../../data/scam/firms.sample.json";
import type { CorpusLabels } from "../corpus/contract";

export interface ScamRecord {
  id: string;
  name: string;
  frn: string | null; // FCA reference number; null when the firm is NOT on the register
  chNumber: string; // Companies House number (a registration fact)
  fcaStatus: string; // "authorised" | "no-longer-authorised" | "not-on-register" (validated by a test)
  lastUpdated: string; // ISO YYYY-MM-DD
}

// Uncast, like the corpus registry: the bundled JSON is structurally CHECKED against ScamRecord here,
// so a malformed row is a compile error. fcaStatus stays a plain string (a union would not survive the
// JSON widening); a test asserts every sample row uses a known status.
export const scamFirms: ScamRecord[] = firmsJson;

// Presentation strings reused from the corpus contract (geo-agnostic). The officialLink is CURATED +
// verified and lives here in reviewed TS — the FCA Register is the authoritative "is this firm actually
// authorised?" signpost, which is what keeps "flag, not verdict" honest.
export const scamLabels: CorpusLabels = {
  noun: "firm",
  summaryLine: "Register records matching your search",
  officialLink: {
    text: "Check the FCA Financial Services Register",
    url: "https://register.fca.org.uk/",
  },
  emptyInvalidHint: "Enter a firm name or its FCA reference (FRN) to check.",
  emptyUnknownHint: "We don't have that firm in our sample — check the FCA register directly.",
  // P1 (#182): empty while the corpus serves the bundled synthetic sample (FCA register data is
  // redistribute_ok: "no" — see data/sources.json — so real attribution never lands here).
  attribution: [],
};
