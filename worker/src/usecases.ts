import foundersJson from "../../usecases/founders-copilot.json";
import onitJson from "../../usecases/on-it.json";
import sortMyCareJson from "../../usecases/sort-my-care.json";
import { corpusIds } from "./corpus/registry";

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
export type StageExec = "assess_stage" | "search_opportunities" | "query_corpus";
export const STAGE_EXECS: StageExec[] = ["assess_stage", "search_opportunities", "query_corpus"];

export interface StageDef {
  name: string;
  kind: string;
  events: AgentEvent[];
  exec?: StageExec;
  // Which registered corpus a `query_corpus` stage reads (see corpus/registry.ts). Required for that
  // exec, unused by the others — validated at load time so a typo fails loudly at startup.
  corpus?: string;
}
export type RenderMode = "founders" | "route" | "corpus";
export interface RenderDef {
  mode: RenderMode;
}
export interface UsecaseDef {
  id: string;
  title: string;
  render: RenderDef;
  stages: StageDef[];
}

const RENDER_MODES: RenderMode[] = ["founders", "route", "corpus"];

// Allow-lists for the strict load guard below. Keep in sync with UsecaseDef / StageDef.
const USECASE_KEYS: readonly string[] = ["id", "title", "render", "stages"];
const STAGE_KEYS: readonly string[] = ["name", "kind", "events", "exec", "corpus"];

// Narrow to unknown[] (not the any[] that Array.isArray infers, which would defeat the type-safety lints).
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

// Reject unknown keys so a misspelled OPTIONAL field (e.g. `exex` — which would otherwise leave `exec`
// undefined and silently play canned events instead of running the query) fails loudly at load. This is
// the TS engine's OWN strictness — adopting azure-doc-workflows' pydantic extra="forbid" (their ADR-0012).
// The SHARED workflow-definition/v1 schema stays additionalProperties:true so cross-engine extras pass;
// our own usecases only ever carry TS fields, so forbidding unknown keys here can't reject a valid one.
function assertNoUnknownKeys(id: string, label: string, obj: object, allowed: readonly string[]): void {
  const unknown = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    throw new Error(`usecase ${id}: unknown ${label} key(s): ${unknown.join(", ")}`);
  }
}

// Contract core: every stage needs a non-empty name (played verbatim over SSE).
function assertStageNames(id: string, stages: unknown[]): void {
  for (const s of stages) {
    const name = (s as { name?: unknown }).name;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(`usecase ${id}: every stage needs a non-empty name`);
    }
  }
}

// A `query_corpus` stage must name a REGISTERED corpus. Without this a typo'd id would surface as a
// silently empty card batch at request time; here it is a clear startup error instead.
function assertStageCorpus(id: string, exec: unknown, corpus: unknown): void {
  if (exec !== "query_corpus") return;
  if (typeof corpus !== "string" || !corpusIds.includes(corpus)) {
    throw new Error(
      `usecase ${id}: a query_corpus stage needs corpus to be one of ${corpusIds.join(", ")}`
    );
  }
}

// TS-engine extras: each stage needs a kind + an events array; exec, if present, must be a known op.
function assertStageShapes(id: string, stages: unknown[]): void {
  for (const s of stages) {
    const stage = s as { kind?: unknown; events?: unknown; exec?: unknown; corpus?: unknown };
    assertNoUnknownKeys(id, "stage", s as object, STAGE_KEYS);
    if (typeof stage.kind !== "string" || !isArray(stage.events)) {
      throw new Error(`usecase ${id}: every stage needs kind and an events array`);
    }
    if (stage.exec !== undefined && !STAGE_EXECS.includes(stage.exec as StageExec)) {
      throw new Error(`usecase ${id}: stage.exec must be one of ${STAGE_EXECS.join(", ")}`);
    }
    assertStageCorpus(id, stage.exec, stage.corpus);
  }
}

function assertRenderMode(id: string, render: unknown): void {
  const mode = (render as { mode?: unknown } | null)?.mode;
  if (typeof mode !== "string" || !RENDER_MODES.includes(mode as RenderMode)) {
    throw new Error(`usecase ${id}: render.mode must be one of ${RENDER_MODES.join(", ")}`);
  }
}

// Tiny load-time guard. Usecases are trusted, build-time JSON (bundled like data/demo/*.json), so this
// is not external-input validation — it just turns an authoring slip into a clear startup error.
// Checks the shared workflow-definition/v1 contract core first (id, non-empty ordered stages[].name —
// see qte77/protocols), then the TS engine's own stricter extras (title, render.mode, stage.kind/events).
export function assertUsecaseDef(x: unknown): asserts x is UsecaseDef {
  if (typeof x !== "object" || x === null) {
    throw new Error("usecase: must be an object");
  }
  const d = x as { id?: unknown; title?: unknown; render?: unknown; stages?: unknown };
  if (typeof d.id !== "string" || d.id.length === 0) {
    throw new Error("usecase: id must be a non-empty string");
  }
  const id = d.id;
  assertNoUnknownKeys(id, "top-level", d, USECASE_KEYS);
  if (!isArray(d.stages) || d.stages.length === 0) {
    throw new Error(`usecase ${id}: stages must be a non-empty array`);
  }
  assertStageNames(id, d.stages);
  if (typeof d.title !== "string") {
    throw new Error(`usecase ${id}: title must be a string`);
  }
  assertRenderMode(id, d.render);
  assertStageShapes(id, d.stages);
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
