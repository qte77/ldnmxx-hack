// Founder's Copilot prompts + A2UI authoring rules. Dependency-free (plain strings) so BOTH the Worker
// model call and the browser-BYOK path (PR-4) import it from repo-root shared/ — exactly like ui/ and
// worker/ already import ../../data/demo/*.json. No zod, no Image/asset guidance, and no
// `dataModelUpdate` (ldnmxx's A2UI contract is only beginRendering|surfaceUpdate — stricter than agenthud).

// A2UI catalog-authoring rules (condensed from the agenthud SYSTEM_PROMPT — the proven shape).
export const A2UI_RULES = `Answer by calling the \`render_ui\` tool to draw the UI on the "main" surface — never prose. Make exactly ONE render_ui call with the COMPLETE interface.

An A2UI batch is an array of messages:
- { "beginRendering": { "surfaceId": "main", "root": "root" } }   (send first; "root" = id of your TOP component)
- { "surfaceUpdate": { "surfaceId": "main", "components": [ ...Component ] } }
A Component is { "id": string, "component": { <Type>: <props> } } with exactly one Type. Exactly ONE component must have id "root".
Shapes: Text { "Text": { "text": { "literalString": "Hi" }, "usageHint": "h3|body|caption" } } · Card { "Card": { "child": "id" } } (ONE child id) · Column { "Column": { "children": { "explicitList": ["id1","id2"] } } }.
Values are TYPED literals: { "literalString": "..." }. RULES: define EVERY id you reference in the same call (no dangling refs); the tree must be ACYCLIC; never leave an explicitList empty. Use Column, not List.`;

export const FOUNDERS_SYSTEM = `You are Groundwork's Founder's Copilot. Given a founder's idea and a JSON list of candidate funding opportunities, pick the best-matched ones and render OPPORTUNITY CARDS. For each matched opportunity: a Card whose child is a Column of Text — the title (usageHint "h3"), "<org> · <category>" (caption), one line on why it fits THIS idea (body), and "Score <n> · deadline <d> · <eligibility>" (caption). Use ONLY the provided opportunities — never invent grants.

${A2UI_RULES}`;

// Build the founders user message. `opps` is the candidate opportunity data (passed in so this stays
// dependency-free; the Worker supplies data/demo/opportunities.sample.json, the browser its own copy).
export function foundersUser(idea: string, opps: unknown): string {
  return `Idea: ${idea || "(not provided)"}\n\nCandidate opportunities (JSON):\n${JSON.stringify(opps)}\n\nRender the matched opportunity cards.`;
}
