import foundersJson from "../../usecases/founders-copilot.json";
import onitJson from "../../usecases/on-it.json";
import sortMyCareJson from "../../usecases/sort-my-care.json";

// A usecase is pure data: the plan/tool stage choreography (played verbatim over SSE) plus a render
// `mode` naming which code path builds the final A2UI card batch. Prompts, card builders and the model
// call stay in worker.ts — referenced by mode, not embedded as config.
export interface AgentEvent {
  type: string;
  text?: string;
  a2uiMessages?: unknown[];
}
// A stage's `exec` names the operation it runs (absent ⇒ the stage's events play canned). Two kinds,
// dispatched by the workflows.ts registry in runUsecase: MODEL execs (assess_stage/search_opportunities)
// run a forced tool on the keyless free-chain — any miss falls back to the canned events; QUERY execs
// (fetch_care_services) run a deterministic corpus query regardless of whether a model provider exists.
export type StageExec = "assess_stage" | "search_opportunities" | "fetch_care_services";
export const STAGE_EXECS: StageExec[] = ["assess_stage", "search_opportunities", "fetch_care_services"];

export interface StageDef {
  name: string;
  kind: string;
  events: AgentEvent[];
  exec?: StageExec;
}
export type RenderMode = "founders" | "route" | "care";
export interface RenderDef {
  mode: RenderMode;
}
export interface UsecaseDef {
  id: string;
  title: string;
  render: RenderDef;
  stages: StageDef[];
}

const RENDER_MODES: RenderMode[] = ["founders", "route", "care"];

// Tiny load-time guard. Usecases are trusted, build-time JSON (bundled like data/demo/*.json), so this
// is not external-input validation — it just turns an authoring slip into a clear startup error.
// Checks the shared workflow-definition/v1 contract core first (id, non-empty ordered stages[].name —
// see qte77/protocols), then the TS engine's own stricter extras (title, render.mode, stage.kind/events).
export function assertUsecaseDef(x: unknown): asserts x is UsecaseDef {
  const d = x as Partial<UsecaseDef>;
  if (!d || typeof d.id !== "string" || d.id.length === 0) {
    throw new Error("usecase: id must be a non-empty string");
  }
  if (!Array.isArray(d.stages) || d.stages.length === 0) {
    throw new Error(`usecase ${d.id}: stages must be a non-empty array`);
  }
  for (const s of d.stages) {
    if (typeof s?.name !== "string" || s.name.length === 0) {
      throw new Error(`usecase ${d.id}: every stage needs a non-empty name`);
    }
  }
  if (typeof d.title !== "string") {
    throw new Error(`usecase ${d.id}: title must be a string`);
  }
  if (!d.render || !RENDER_MODES.includes(d.render.mode as RenderMode)) {
    throw new Error(`usecase ${d.id}: render.mode must be one of ${RENDER_MODES.join(", ")}`);
  }
  for (const s of d.stages) {
    if (typeof s.kind !== "string" || !Array.isArray(s.events)) {
      throw new Error(`usecase ${d.id}: every stage needs kind and an events array`);
    }
    if (s.exec !== undefined && !STAGE_EXECS.includes(s.exec)) {
      throw new Error(`usecase ${d.id}: stage.exec must be one of ${STAGE_EXECS.join(", ")}`);
    }
  }
}

function load(json: unknown): UsecaseDef {
  assertUsecaseDef(json);
  return json;
}

const registry: Record<string, UsecaseDef> = {
  "founders-copilot": load(foundersJson),
  "on-it": load(onitJson),
  "sort-my-care": load(sortMyCareJson),
};

export const usecaseIds: string[] = Object.keys(registry);

export function getUsecase(id: string): UsecaseDef | undefined {
  return registry[id];
}
