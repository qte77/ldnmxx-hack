import opportunitiesJson from "../../../data/demo/opportunities.sample.json";
import routeJson from "../../../data/demo/route.sample.json";

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
const route = routeJson as Route;

interface CardSpec {
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
function cardsBatch(cards: CardSpec[]): unknown[] {
  const components: unknown[] = [];
  const rootChildren: string[] = [];
  for (const card of cards) {
    const cardId = `card-${card.key}`;
    const bodyId = `body-${card.key}`;
    const titleId = `t-${card.key}`;
    rootChildren.push(cardId);
    const lineIds: string[] = [titleId];
    components.push(
      { id: cardId, component: { Card: { child: bodyId } } },
      { id: titleId, component: { Text: { text: { literalString: card.title }, usageHint: "h3" } } }
    );
    card.lines.forEach((line, i) => {
      const id = `l-${card.key}-${i}`;
      lineIds.push(id);
      components.push({
        id,
        component: { Text: { text: { literalString: line }, usageHint: "caption" } },
      });
    });
    components.push({
      id: bodyId,
      component: { Column: { children: { explicitList: lineIds } } },
    });
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

// Track B — grant/opportunity cards with a qualify-first eligibility line.
export function buildOpportunityCards(opps: Opportunity[] = opportunities): unknown[] {
  return cardsBatch(
    opps.map((o) => ({
      key: o.id,
      title: o.title,
      lines: [
        `${o.org} · ${o.category}`,
        o.whyItFits,
        `Score ${o.score} · deadline ${o.deadline} · ${
          o.eligibility.qualified
            ? "✓ qualified"
            : `✗ ${o.eligibility.missed[0] ?? "not yet eligible"}`
        }`,
      ],
    }))
  );
}

// Track A — a step-free route: a summary card + one card per leg.
export function buildRouteCards(r: Route = route): unknown[] {
  const summary: CardSpec = {
    key: "summary",
    title: `${r.origin} → ${r.destination}`,
    lines: [
      `Step-free ${r.stepFree ? "✓" : "✗"} · ${r.durationMin} min`,
      ...(r.disruptions.length > 0 ? [`Disruptions: ${r.disruptions.join("; ")}`] : []),
    ],
  };
  const legs: CardSpec[] = r.legs.map((leg, i) => ({
    key: `leg-${i}`,
    title: leg.instruction,
    lines: [`${leg.mode} · step-free ${leg.stepFree ? "✓" : "✗"} · ${leg.durationMin} min`],
  }));
  return cardsBatch([summary, ...legs]);
}
