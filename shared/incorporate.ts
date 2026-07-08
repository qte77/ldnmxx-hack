// The incorporate "how-to pack": a static, verified set of gov.uk / Companies House links (curated,
// NEVER LLM-generated — the hard rule in #12). A2UI Text renders markdown, so `[label](url)` lines are
// clickable anchors — no Button.onAction (unwired) needed. Verified 2026-07 (see docs/usecase-workflows.md).
// The how-to pack, NOT a live filing (deferred, #12). Dependency-free + repo-root so BOTH the Worker
// (cards.ts withIncorporate) and the browser-BYOK founders render append the SAME card.

const INCORPORATE_TITLE = "✓ Ready to incorporate";
const INCORPORATE_LINES = [
  "Your verified path to register a UK limited company — real gov.uk / Companies House links, not a filing.",
  "[Check the name is available](https://find-and-update.company-information.service.gov.uk)",
  "[Find your SIC code](https://resources.companieshouse.gov.uk/sic/)",
  "[Verify your identity — GOV.UK One Login (now required)](https://identity.company-information.service.gov.uk)",
  "[Register online (£50)](https://www.gov.uk/limited-company-formation/register-your-company)",
  "[Full set-up steps](https://www.gov.uk/set-up-limited-company)",
];

// Build the incorporate card's A2UI components (Card → body Column → title + line Texts). Mirrors the
// worker cards.ts card shape so the appended card renders identically on both paths.
function incorporateComponents(): { cardId: string; components: unknown[] } {
  const key = "incorporate";
  const cardId = `card-${key}`;
  const bodyId = `body-${key}`;
  const titleId = `t-${key}`;
  const lineIds: string[] = [titleId];
  const components: unknown[] = [
    { id: cardId, component: { Card: { child: bodyId } } },
    { id: titleId, component: { Text: { text: { literalString: INCORPORATE_TITLE }, usageHint: "h3" } } },
  ];
  INCORPORATE_LINES.forEach((line, i) => {
    const id = `l-${key}-${i}`;
    lineIds.push(id);
    components.push({ id, component: { Text: { text: { literalString: line }, usageHint: "caption" } } });
  });
  components.push({ id: bodyId, component: { Column: { children: { explicitList: lineIds } } } });
  return { cardId, components };
}

// Append the incorporate card to a founders batch (stub OR model). The batch's "root" must be a Column
// with an explicitList; the incorporate card id + its components are pushed in. Unexpected root shape ⇒
// the batch is returned unchanged (guard).
export function appendIncorporate(batch: unknown[]): unknown[] {
  const msgs = batch as {
    surfaceUpdate?: { components?: { id: string; component: Record<string, unknown> }[] } }[];
  const update = msgs.find((m) => m.surfaceUpdate)?.surfaceUpdate;
  if (!update || !Array.isArray(update.components)) return batch;
  const root = update.components.find((c) => c.id === "root");
  const col = root?.component.Column as { children?: { explicitList?: string[] } } | undefined;
  const list = col?.children?.explicitList;
  if (!Array.isArray(list)) return batch;
  const { cardId, components } = incorporateComponents();
  list.push(cardId);
  update.components.push(...(components as { id: string; component: Record<string, unknown> }[]));
  return batch;
}
