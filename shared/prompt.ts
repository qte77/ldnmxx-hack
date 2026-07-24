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

// Phase-2 stage prompts. Each drives a forced tool (assess_stage / search_opportunities); the model's
// `reasoning` streams to the HUD and its structured output feeds the next stage / the render.

export const ASSESS_STAGE_SYSTEM = `You are Groundwork's Founder's Copilot. Given a founder's idea, classify their CURRENT stage and the 1-2 concrete things that unlock the next stage. Call the \`assess_stage\` tool with: a one-sentence \`reasoning\`, a \`stage\` (one of "idea", "prototype", "pre-incorporation", "incorporated"), and an \`unlock\` array of the next concrete steps. Base the stage on evidence in the idea; when unsure, pick the earlier stage.`;

export function assessUser(idea: string): string {
  return `Idea: ${idea || "(not provided)"}\n\nAssess the founder's current stage.`;
}

export const SEARCH_SYSTEM = `You are Groundwork's Founder's Copilot. Given a founder's idea and a JSON list of candidate funding opportunities, pick and RANK the best-matched ones. Call the \`search_opportunities\` tool with a one-sentence \`reasoning\` and a \`matches\` array. For each match: the opportunity's \`id\` copied VERBATIM from a candidate (never invent an id), a \`score\` 0-100 for how well it fits THIS idea, a one-line \`whyItFits\`, and a short \`stageFit\` (how it suits the founder's stage). Omit opportunities that don't genuinely fit; return the strongest first.`;

// `opps` is the candidate corpus (passed in to stay dependency-free, same as foundersUser).
export function searchUser(idea: string, opps: unknown): string {
  return `Idea: ${idea || "(not provided)"}\n\nCandidate opportunities (JSON):\n${JSON.stringify(opps)}\n\nRank the matches, using only these ids.`;
}

// Auto-router (017 P2). Only reached when the keyless keyword heuristic is unsure, so the model is the
// tie-breaker, not the first line. It must copy an id VERBATIM or answer "none" — never invent a route;
// the routerTool validator enforces this, but instructing it up front avoids wasted fallbacks.
export const CLASSIFY_SYSTEM = `You are the router for sortmy.london, a free assistant that signposts Londoners to official public services. Given a user's free-text request and a JSON list of available workflows (each with an id, a title, and example keywords), call the \`route_query\` tool with a one-sentence \`reasoning\` and the single best-matching workflow \`id\`, copied VERBATIM. If none genuinely fits, set \`usecase\` to "none" — choose "none" rather than a weak or guessed match. Return exactly one id.`;

// `catalog` is the routable workflow list (id/title/keywords), passed in to stay dependency-free like
// searchUser. `hasPostcode` reuses shared/sanitize.normalisePostcode's signal — a UK postcode is a
// strong hint the ask is a location lookup (care / wander / food-hygiene) rather than a firm check.
export function classifyUser(prompt: string, catalog: unknown, hasPostcode: boolean): string {
  return `User request: ${prompt || "(empty)"}\nContains a UK postcode: ${hasPostcode ? "yes" : "no"}\n\nAvailable workflows (JSON):\n${JSON.stringify(catalog)}\n\nChoose the single best workflow id, or "none".`;
}
