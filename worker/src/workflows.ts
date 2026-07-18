import { buildOpportunityCards, buildRouteCards, withIncorporate } from "./a2ui/cards";
import { buildCareCards } from "./care/render";
import { queryCareServices } from "./care/careServices";
import type { CareQuery } from "./care/contract";
import type { RenderMode, StageExec } from "./usecases";

// The general engine's workflow registry: dispatch tables keyed by a usecase's render `mode` and its
// deterministic query `exec`. Adding a corpus workflow (Care now; Wander/Scam next) is register + a JSON —
// runUsecase / renderBatch never change (open/closed).
//
// - `query`  : deterministic, model-free + fetch-free stage execs. The MODEL execs (assess_stage /
//              search_opportunities) are NOT here — they run on the provider chain in runStageModel.
// - `render` : mode → build the A2UI batch. Deterministic modes (route, care) build purely from the query
//              data. `founders` is the ONE model-backed mode; its entry is the deterministic stub/fallback
//              and worker.ts layers the live model render on top (see renderBatch).

export interface QueryInput {
  prompt: string;
}
export type QueryFn = (input: QueryInput) => unknown;
export type RenderFn = (data?: unknown) => unknown[];

export const registry: {
  render: Record<RenderMode, RenderFn>;
  query: Partial<Record<StageExec, QueryFn>>;
} = {
  render: {
    founders: () => withIncorporate(buildOpportunityCards()),
    route: () => buildRouteCards(),
    care: (data) => buildCareCards((data ?? { postcode: null, services: [] }) as CareQuery),
  },
  query: {
    fetch_care_services: (input) => queryCareServices(input.prompt),
  },
};
