import foundersJson from "../../usecases/founders-copilot.json";
import onitJson from "../../usecases/on-it.json";

// A usecase is pure data: the plan/tool stage choreography (played verbatim over SSE) plus a render
// `mode` naming which code path builds the final A2UI card batch. Prompts, card builders and the model
// call stay in worker.ts — referenced by mode, not embedded as config.
export interface AgentEvent {
  type: string;
  text?: string;
  a2uiMessages?: unknown[];
}
export interface StageDef {
  span: string;
  kind: string;
  events: AgentEvent[];
}
export type RenderMode = "founders" | "route";
export interface RenderDef {
  mode: RenderMode;
}
export interface UsecaseDef {
  id: string;
  title: string;
  render: RenderDef;
  stages: StageDef[];
}

const RENDER_MODES: RenderMode[] = ["founders", "route"];

// Tiny load-time guard. Usecases are trusted, build-time JSON (bundled like data/demo/*.json), so this
// is not external-input validation — it just turns an authoring slip into a clear startup error.
export function assertUsecaseDef(x: unknown): asserts x is UsecaseDef {
  const d = x as Partial<UsecaseDef>;
  if (!d || typeof d.id !== "string" || typeof d.title !== "string") {
    throw new Error("usecase: id and title must be strings");
  }
  if (!d.render || !RENDER_MODES.includes(d.render.mode as RenderMode)) {
    throw new Error(`usecase ${String(d.id)}: render.mode must be one of ${RENDER_MODES.join(", ")}`);
  }
  if (!Array.isArray(d.stages) || d.stages.length === 0) {
    throw new Error(`usecase ${d.id}: stages must be a non-empty array`);
  }
  for (const s of d.stages) {
    if (typeof s?.span !== "string" || typeof s.kind !== "string" || !Array.isArray(s.events)) {
      throw new Error(`usecase ${d.id}: every stage needs span, kind and an events array`);
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
};

export const usecaseIds: string[] = Object.keys(registry);

export function getUsecase(id: string): UsecaseDef | undefined {
  return registry[id];
}
