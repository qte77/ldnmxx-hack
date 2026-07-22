// The corpus registry: corpus id -> its records, postcode gazetteer, and presentation labels.
//
// This is the ONLY file a new deterministic corpus usecase touches on the engine side (plus its
// usecases/<id>.json and a UI entry) — the render mode and query exec are already generic, so no
// union, guard, registry-dispatch or interpreter code changes. Static imports are required because
// the Worker bundles JSON at build time.
//
// W6 (#13, ADR 0002) landed the CorpusSource seam (source.ts): a corpus with a `d1View` reads the
// D1 store when a database is bound; the bundled JSON stays as the fallback, and labels stay here
// either way.
import servicesJson from "../../../data/care/services.sample.json";
import postcodesJson from "../../../data/care/postcodes.sample.json";
import wanderPlacesJson from "../../../data/wander/places.sample.json";
import wanderPostcodesJson from "../../../data/wander/postcodes.sample.json";
import type { CorpusLabels, CorpusRecord } from "./contract";
import type { Coords } from "../geo";

export interface CorpusDef {
  records: CorpusRecord[];
  postcodes: Record<string, Coords>;
  labels: CorpusLabels;
  // W6 (ADR 0002): the D1 view this corpus reads when a database is bound (worker/migrations/*).
  // Absent ⇒ bundled-only. The bundled sample stays committed as the offline/outage fallback.
  d1View?: string;
}

const corpora: Record<string, CorpusDef> = {
  care: {
    // W6: reads the care_signposts D1 view when env.DB is bound; else the bundled sample below.
    d1View: "care_signposts",
    // No cast: the bundled JSON is structurally CHECKED against CorpusRecord/Coords here, so a
    // malformed sample row is a compile error rather than a silently-asserted shape.
    records: servicesJson,
    postcodes: postcodesJson,
    labels: {
      noun: "service",
      summaryLine: "Nearest public-service signposts",
      // Curated + verified, NEVER generated.
      officialLink: { text: "Search official NHS services", url: "https://www.nhs.uk/service-search" },
      emptyInvalidHint: "Try a London postcode like E8 3GT.",
      emptyUnknownHint:
        "We don't have sample data for that postcode yet — try E8 3GT, SW9 9SL or N1 9GU.",
    },
  },
  wander: {
    // Uncast, like `care` above: the bundled JSON is structurally checked against CorpusRecord/Coords,
    // so a malformed sample row is a compile error rather than a silently-asserted shape.
    records: wanderPlacesJson,
    postcodes: wanderPostcodesJson,
    labels: {
      noun: "place",
      summaryLine: "Free places to wander near you",
      // Curated + verified, NEVER generated: Historic England's statutory List is an authoritative,
      // keyless register the user can verify each place against — signpost, not adjudicator.
      officialLink: {
        text: "Historic England — The List",
        url: "https://historicengland.org.uk/listing/the-list/",
      },
      emptyInvalidHint: "Try a London postcode like E8 3GT.",
      emptyUnknownHint:
        "We don't have sample data for that postcode yet — try E8 3GT, SW9 9SL or N1 9GU.",
    },
  },
};

export function getCorpus(id: string): CorpusDef | undefined {
  return corpora[id];
}

// The registered ids — the usecase load-guard validates a stage's `corpus` against these, so an
// authoring typo is a startup error rather than a silently empty batch.
export const corpusIds: string[] = Object.keys(corpora);
