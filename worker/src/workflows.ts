import { buildOpportunityCards, buildRouteCards, withIncorporate } from "./a2ui/cards";
import { buildCorpusCards } from "./corpus/render";
import { queryCorpus } from "./corpus/query";
import type { CorpusQuery } from "./corpus/contract";
import { buildScamCards } from "./scam/render";
import { queryScam, type ScamQuery } from "./scam/query";
import type { RenderMode, StageExec } from "./usecases";

// The general engine's workflow registry: dispatch tables keyed by a usecase's render `mode` and its
// deterministic query `exec`. Both are now GENERIC over a corpus id, so adding a deterministic corpus
// workflow (Care now; Wander/Scam next) is a corpus/registry.ts entry + a JSON + a UI entry —
// runUsecase / renderBatch / cardsBatch never change (open/closed).
//
// - `query`  : deterministic, model-free + fetch-free stage execs, returning a Promise so a D1-backed
//              corpus can slot in at W4 without touching the seam. The MODEL execs (assess_stage /
//              search_opportunities) are NOT here — they run on the provider chain in runStageModel.
// - `render` : mode → build the A2UI batch. Deterministic modes (route, corpus) build purely from the
//              query data. `founders` is the ONE model-backed mode; its entry is the deterministic
//              stub/fallback and worker.ts layers the live model render on top (see renderBatch).

export interface QueryInput {
  prompt: string;
  // Which registered corpus a query_corpus stage reads; carried on the stage def (usecases.ts).
  corpus?: string | undefined;
}
export type QueryFn = (input: QueryInput) => Promise<unknown>;
export type RenderFn = (data?: unknown) => unknown[];

export const registry: {
  render: Record<RenderMode, RenderFn>;
  query: Partial<Record<StageExec, QueryFn>>;
} = {
  render: {
    founders: () => withIncorporate(buildOpportunityCards()),
    route: () => buildRouteCards(),
    corpus: (data) => buildCorpusCards(data as CorpusQuery),
    scam: (data) => buildScamCards(data as ScamQuery),
  },
  query: {
    query_corpus: (input) => queryCorpus(input),
    query_scam: (input) => queryScam(input),
  },
};
