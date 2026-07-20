// The forced `assess_stage` tool schema + a dependency-free validator for its structured output. Shared
// (repo-root, no deps) so BOTH the Worker free-chain path and — later — the browser path validate
// identically, exactly like renderTool.ts. The model classifies the founder's current stage and the 1–2
// concrete things that unlock the next one; its `reasoning` streams to the HUD as one message.

export const STAGES = ["idea", "prototype", "pre-incorporation", "incorporated"] as const;
export type FounderStage = (typeof STAGES)[number];

export const ASSESS_STAGE_TOOL = {
  type: "function",
  function: {
    name: "assess_stage",
    description:
      "Classify the founder's current stage from their idea, and list the 1-2 concrete things that unlock the next stage.",
    parameters: {
      type: "object",
      properties: {
        reasoning: { type: "string", description: "One or two sentences explaining the classification." },
        stage: { type: "string", enum: [...STAGES] },
        unlock: { type: "array", items: { type: "string" } },
      },
      required: ["reasoning", "stage", "unlock"],
    },
  },
};

export interface AssessResult {
  reasoning: string;
  stage: FounderStage;
  unlock: string[];
}

// Narrow to unknown[], not the any[] Array.isArray infers (which would defeat the type-safety lints).
// Same pattern as worker/src/usecases.ts.
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

// Structural guard: reasoning + a known stage + a string[] of unlock steps. Reject anything else so the
// caller falls back to the canned stage text (never worse than today).
export function isValidAssessResult(value: unknown): value is AssessResult {
  // Narrow to a plain object, then read every property as `unknown`. Casting straight to
  // Partial<AssessResult> would assert the very field types this function exists to VERIFY —
  // circular, and it convinces the type-checker the runtime guards are redundant when the input
  // is untrusted parsed model JSON.
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.reasoning === "string" &&
    typeof v.stage === "string" &&
    (STAGES as readonly string[]).includes(v.stage) &&
    isArray(v.unlock) &&
    v.unlock.every((u) => typeof u === "string")
  );
}
