import opportunitiesJson from "../../../data/demo/opportunities.sample.json";
import routeJson from "../../../data/demo/route.sample.json";
import { appendIncorporate } from "../../../shared/incorporate";
import type { CatalogEntry } from "../usecases";

interface Opportunity {
  id: string;
  title: string;
  org: string;
  deadline: string;
  category: string;
  score: number;
  whyItFits: string;
  eligibility: { qualified: boolean; met: string[]; missed: string[] };
}
interface RouteLeg {
  mode: string;
  instruction: string;
  stepFree: boolean;
  durationMin: number;
}
interface Route {
  origin: string;
  destination: string;
  stepFree: boolean;
  durationMin: number;
  legs: RouteLeg[];
  disruptions: string[];
}

const opportunities = opportunitiesJson as Opportunity[];
const route = routeJson;

export interface CardSpec {
  key: string;
  title: string;
  lines: string[];
}

/**
 * Build a self-contained A2UI v0_8 batch: a root `Column` of `Card`s, each Card's single `child` a
 * `Column` of `Text`s. Every referenced id is defined here; the graph is acyclic; values are typed
 * literals. This is exactly what `contract.ts` validates and `@a2ui/react` renders — one builder,
 * both workflows (DRY). See the v0_8 index.d.ts / agenthud SYSTEM_PROMPT for the shape.
 */
// Build one card's components (Card → body Column → title + line Texts); returns the card's root id.
function cardComponents(card: CardSpec): { cardId: string; components: unknown[] } {
  const cardId = `card-${card.key}`;
  const bodyId = `body-${card.key}`;
  const titleId = `t-${card.key}`;
  const lineIds: string[] = [titleId];
  const components: unknown[] = [
    { id: cardId, component: { Card: { child: bodyId } } },
    { id: titleId, component: { Text: { text: { literalString: card.title }, usageHint: "h3" } } },
  ];
  card.lines.forEach((line, i) => {
    const id = `l-${card.key}-${String(i)}`;
    lineIds.push(id);
    components.push({
      id,
      component: { Text: { text: { literalString: line }, usageHint: "caption" } },
    });
  });
  components.push({ id: bodyId, component: { Column: { children: { explicitList: lineIds } } } });
  return { cardId, components };
}

export function cardsBatch(cards: CardSpec[]): unknown[] {
  const components: unknown[] = [];
  const rootChildren: string[] = [];
  for (const card of cards) {
    const { cardId, components: cc } = cardComponents(card);
    rootChildren.push(cardId);
    components.push(...cc);
  }
  return [
    { beginRendering: { surfaceId: "main", root: "root" } },
    {
      surfaceUpdate: {
        surfaceId: "main",
        components: [
          { id: "root", component: { Column: { children: { explicitList: rootChildren } } } },
          ...components,
        ],
      },
    },
  ];
}

// Append one extra card to a self-contained batch built by cardsBatch (root = a Column explicitList).
// Mirrors shared/incorporate.ts's appendIncorporate for Worker-built batches, reusing cardComponents so
// the appended card renders identically. Unexpected root shape ⇒ the batch is returned unchanged (guard).
function appendCard(batch: unknown[], spec: CardSpec): unknown[] {
  const msgs = batch as {
    surfaceUpdate?: { components?: { id: string; component: Record<string, unknown> }[] };
  }[];
  const update = msgs.find((m) => m.surfaceUpdate)?.surfaceUpdate;
  if (!update || !Array.isArray(update.components)) return batch;
  const root = update.components.find((c) => c.id === "root");
  const col = (root?.component as { Column?: { children?: { explicitList?: string[] } } } | undefined)?.Column;
  const list = col?.children?.explicitList;
  if (!Array.isArray(list)) return batch;
  const { cardId, components } = cardComponents(spec);
  list.push(cardId);
  update.components.push(...(components as { id: string; component: Record<string, unknown> }[]));
  return batch;
}

// The generic "signpost, not advice" caveat card for the deterministic corpus workflows (Care now;
// Wander/Scam next). The official link is supplied PER CORPUS from its curated, verified labels
// (corpus/registry.ts) — never hardcoded here and never generated. Freshness ("as of <date>") is
// shown per-workflow in its own summary card, from the corpus lastUpdated.
// P1 (#182): `attribution` = the corpus's licence-obligation strings (OGL/CQC/FHRS), supplied from
// its curated labels (corpus/registry.ts) like the link — never from ingested data. Empty ⇒ the
// card renders exactly as before (bundled-sample corpora carry no attribution).
const disclaimerCard = (link: { text: string; url: string }, attribution: string[]): CardSpec => ({
  key: "disclaimer",
  title: "ℹ️ Always confirm with the official source",
  lines: [
    "A signpost to public services — not advice, a referral, or a booking. Details can change.",
    `[${link.text}](${link.url})`,
    ...attribution,
  ],
});

// Append the deterministic disclaimer card to a corpus-workflow batch.
export function appendDisclaimer(
  batch: unknown[],
  link: { text: string; url: string },
  attribution: string[] = []
): unknown[] {
  return appendCard(batch, disclaimerCard(link, attribution));
}

// Founder's Copilot — grant/opportunity cards with a qualify-first eligibility line.
export function buildOpportunityCards(opps: Opportunity[] = opportunities): unknown[] {
  return cardsBatch(
    opps.map((o) => ({
      key: o.id,
      title: o.title,
      lines: [
        `${o.org} · ${o.category}`,
        o.whyItFits,
        `Score ${String(o.score)} · deadline ${o.deadline} · ${
          o.eligibility.qualified
            ? "✓ qualified"
            : `✗ ${o.eligibility.missed[0] ?? "not yet eligible"}`
        }`,
      ],
    }))
  );
}

// Sort My Route (formerly On It) — a step-free route: a summary card + one card per leg.
export function buildRouteCards(r: Route = route): unknown[] {
  const summary: CardSpec = {
    key: "summary",
    title: `${r.origin} → ${r.destination}`,
    lines: [
      `Step-free ${r.stepFree ? "✓" : "✗"} · ${String(r.durationMin)} min`,
      ...(r.disruptions.length > 0 ? [`Disruptions: ${r.disruptions.join("; ")}`] : []),
    ],
  };
  const legs: CardSpec[] = r.legs.map((leg, i) => ({
    key: `leg-${String(i)}`,
    title: leg.instruction,
    lines: [`${leg.mode} · step-free ${leg.stepFree ? "✓" : "✗"} · ${String(leg.durationMin)} min`],
  }));
  return cardsBatch([summary, ...legs]);
}

// The no-match card (017 P2, ADR 0004): when the router can't confidently place a free-text ask, we
// NEVER fall back to a flagship — we render a deterministic "here's what I can help with" card + the
// discovery list, so a first-time visitor learns the app's scope instead of getting a wrong answer.
// The catalog is register-derived (usecaseCatalog()) and INCLUDES founders/route as explicit suggestions.
//
// 018 P5b: TWO affordances, honest to reachability. A ROUTABLE workflow (has keywords) invites TYPING —
// it shows its own working `example`, since the single input can route to it. A NEVER-auto-routed one
// (founders/route, no keywords) instead gets an "open →" `?usecase=` link: typing its example would
// no-match (it carries no keywords ON PURPOSE — the SE1 trap), so a typed hint there would be a lie.
// Each option leads with its own `blurb` (018 P4). Pure data — a new workflow appears here automatically.
export function buildNoMatchCards(catalog: CatalogEntry[]): unknown[] {
  const header: CardSpec = {
    key: "nomatch",
    title: "I didn't understand that",
    lines: ["Here's what sortmy.london can help with:"],
  };
  const options: CardSpec[] = catalog.map((u) => ({
    key: `opt-${u.id}`,
    title: u.title,
    lines:
      u.keywords.length > 0
        ? [u.blurb, `Try typing: "${u.example}"`]
        : [u.blurb, `[Open ${u.title} →](?usecase=${u.id})`],
  }));
  return cardsBatch([header, ...options]);
}

// Founder's Copilot — the incorporate "how-to pack" now lives in dependency-free shared/incorporate.ts so the
// browser-BYOK founders render appends the SAME verified card. withIncorporate stays the Worker's entry
// point (re-export): append the deterministic incorporate card to a founders batch (stub OR model).
export const withIncorporate = appendIncorporate;
