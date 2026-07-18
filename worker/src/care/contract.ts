// Sort My Care's LOCAL workflow contract. Kept in the workflow's own dir (SOC) — the shared
// `workflow-definition/v1` contract (qte77/protocols) only fixes the stage envelope, not per-workflow
// payloads (single-contract / YAGNI). Care is model-free + fetch-free: a deterministic query over a
// bundled corpus, so this contract describes plain data, not an LLM tool schema.

// One public-service signpost returned to the render. `why` is a short plain-language reason; `officialUrl`
// is the authoritative page to confirm details; `distanceKm` is from the requested postcode; `lastUpdated`
// carries the corpus freshness so the render can be honest about staleness.
export interface CareService {
  id: string;
  name: string;
  why: string;
  officialUrl: string;
  authority: string;
  distanceKm: number;
  lastUpdated: string;
}

// The result threaded from the query stage to the care render. `postcode` is the normalised postcode, or
// null when the input was not a valid/known postcode; `services` is the nearest-N (empty on a null/unknown
// postcode) so the render can show a graceful "enter a valid postcode" / "none nearby" state.
export interface CareQuery {
  postcode: string | null;
  services: CareService[];
}
