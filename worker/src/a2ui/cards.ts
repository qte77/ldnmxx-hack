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
    const id = `l-${card.key}-${i}`;
    lineIds.push(id);
    components.push({
      id,
      component: { Text: { text: { literalString: line }, usageHint: "caption" } },
    });
  });
  components.push({ id: bodyId, component: { Column: { children: { explicitList: lineIds } } } });
  return { cardId, components };
}

function cardsBatch(cards: CardSpec[]): unknown[] {
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

// Track B — the incorporate "how-to pack": a static, verified set of gov.uk / Companies House links
// (curated, NEVER LLM-generated — the hard rule in #12). A2UI Text renders markdown, so `[label](url)`
// lines are clickable anchors — no Button.onAction (unwired) needed. Verified 2026-07 (see
// docs/usecase-workflows.md). This is the how-to pack, NOT a live filing (that stays deferred, #12).
function incorporateSpec(): CardSpec {
  return {
    key: "incorporate",
    title: "✓ Ready to incorporate",
    lines: [
      "Your verified path to register a UK limited company — real gov.uk / Companies House links, not a filing.",
      "[Check the name is available](https://find-and-update.company-information.service.gov.uk)",
      "[Find your SIC code](https://resources.companieshouse.gov.uk/sic/)",
      "[Verify your identity — GOV.UK One Login (now required)](https://identity.company-information.service.gov.uk)",
      "[Register online (£50)](https://www.gov.uk/limited-company-formation/register-your-company)",
      "[Full set-up steps](https://www.gov.uk/set-up-limited-company)",
    ],
  };
}

// Append the deterministic incorporate card to a founders batch (stub OR model). Both are
// self-contained batches whose "root" is a Column with an explicitList; the incorporate card id + its
// components are pushed in. If the root shape is unexpected, the batch is returned unchanged.
export function withIncorporate(batch: unknown[]): unknown[] {
  const msgs = batch as { surfaceUpdate?: { components?: { id: string; component: Record<string, unknown> }[] } }[];
  const update = msgs.find((m) => m.surfaceUpdate)?.surfaceUpdate;
  if (!update || !Array.isArray(update.components)) return batch;
  const root = update.components.find((c) => c.id === "root");
  const col = root?.component.Column as { children?: { explicitList?: string[] } } | undefined;
  const list = col?.children?.explicitList;
  if (!Array.isArray(list)) return batch;
  const { cardId, components } = cardComponents(incorporateSpec());
  list.push(cardId);
  update.components.push(...(components as { id: string; component: Record<string, unknown> }[]));
  return batch;
}
