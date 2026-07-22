# User stories

The users the one engine serves (distilled from the sibling `ldnmxx` briefs): the two hackathon demos
(Founder's Copilot, Sort My Route), the four shipped civic flows — **Sort My Care** (flagship), **Sort My Route**
(step-free routes), **Sort My Wander** (free heritage + green space), **Sort My Scam Check** (clone-firm
flag) — and **Benefits Copilot**, the v1 productization target (plans 010/011, proposed).

## Founder's Copilot — the early-stage London founder *(Build London)*

**Who:** an early-stage London founder — an idea or working prototype, pre- or just-incorporated, no
grant-writing expertise, no budget for a consultant.

**Pain:** funding discovery is fragmented (no single API); qualifying is guesswork; the first real steps
(incorporate, who to talk to) are a maze; re-keying the same answers into each scheme costs 4–8h.

**Job:** *"Where am I, what funding fits, who do I talk to, and get me incorporated — fast, one click."*

**Joy:** describe the idea once → the copilot assesses the stage, surfaces matched grants with a
qualify-first gate, suggests who to talk to, and produces a one-click **incorporation-ready** pack.

## Sort My Route (formerly "On It") — the mobility-constrained Londoner *(Live London)*

**Who:** a Londoner with a mobility constraint (wheelchair, buggy, temporary injury) navigating the city
daily.

**Pain:** broken infrastructure (lifts out, blocked step-free routes) forces context-switching across 3+
apps. Routing and reporting are the *same moment*, but nothing joins them — TfL, mySociety and boroughs
can't unify without multi-year inter-agency agreement (a **structural** gap, not a technical one).

**Job:** *"Get me there step-free, hands-free."* (Full vision: report the fault in the same breath.)

**Joy:** speak an origin + destination → a step-free route with live disruption appears in a
watch-it-work HUD; voice = accessible by default.

## Both — an honest demo vs live

**Who:** anyone watching the HUD — a judge, a teammate, or the founder themselves.

**Pain:** the deterministic demo stub and the live agent now produce visibly different output, but the
screen gives no way to tell which you're seeing — or to choose.

**Job:** *"Tell me whether this is the canned demo or the real agent, and let me switch."*

**Joy:** a **Demo⇄Live toggle** picks the next run's mode; an honest chip reports what the last run actually
did — `LIVE · <model> · ~N tok`, `DEMO · deterministic`, or `STUB · fell back` — never claiming "live" when
the model path degraded to canned.

## Benefits Copilot — the Londoner who might be entitled *(Claim London)*

*(Post-hackathon productization target — see plans [010](plans/010-civic-tool-v1.md) /
[011](plans/011-benefits-copilot-wayfinder.md); proposed, not yet accepted.)*

**Who:** a Londoner who may qualify for support (Universal Credit, Council Tax Reduction, PIP, Healthy
Start, free school meals, Blue Badge…) — stressed, time-poor, unsure what they're entitled to or where to
start, and with real stakes if the answer is wrong.

**Pain:** entitlements are scattered across gov.uk, the borough, and charities; the language is
bureaucratic; "am I even eligible?" is guesswork; a confident-but-wrong answer costs real money or wasted
effort; Citizens Advice lines are overloaded.

**Job:** *"Tell me plainly what I might be entitled to and exactly where to claim it — without pretending
to be the official decision."*

**Joy:** describe the situation once → the copilot signposts the **official** eligibility checkers and the
**local** Citizens Advice / council contact, in plain English with a "why this might apply to you" line and
an honest *"this is guidance, not a determination"* frame — a trustworthy signpost, never a fake adjudicator.

## Sort My Care — the Londoner who needs a nearby service *(shipped)*

**Who:** any Londoner (or someone helping a relative) needing a nearby GP, pharmacy, urgent-care, dentist or
mental-health service — new to the area, or with a service that closed.

**Pain:** "which services near me, and are these the official ones?" is scattered across the NHS site, the
borough, and search results; it's easy to land on a wrong or stale listing, and health queries carry real
stakes.

**Job:** *"Show me the nearest official services for my postcode, and be honest about how current this is —
don't pretend to be a diagnosis or a booking."*

**Joy:** enter a postcode → the nearest public services appear as cards with distance, a plain-language
"why", the **official** page to confirm, a "data as of …" freshness line, and a clear "signpost, not advice"
disclaimer. Deterministic (no model, no live fetch) so it's fast and can't hallucinate a service.

## Sort My Wander — the Londoner who wants a free thing to do nearby *(shipped)*

**Who:** any Londoner (or visitor) with an hour spare who wants somewhere free and nearby worth a walk —
not another paid attraction, not a generic "things to do" list.

**Pain:** free, obscure heritage sites and green spaces are invisible to apps because no one earns a
commission on a blue plaque — the real listings (Historic England, OSM, Wikidata) are scattered and
easy to miss.

**Job:** *"Show me a free, nearby place worth a walk — with the real listing, not marketing copy."*

**Joy:** enter a postcode → nearby heritage sites and green spaces appear as cards with distance, a
plain-language "why", the curated **Historic England** listing to confirm, a "data as of …" freshness
line, and the same "signpost, not advice" disclaimer. Deterministic and **register-only** on the corpus
engine (same seam as Sort My Care — proof the engine generalises).

## Sort My Scam Check — the Londoner checking a firm before they trust it *(shipped)*

**Who:** a Londoner asked to trust or pay a firm they don't recognise — approached about an investment,
or just cautious before handing over money or details.

**Pain:** clone firms copy a real, authorised firm's name and FCA reference number; checking the FCA
register or Companies House takes know-how most people don't have — and a tool that renders a confident
"safe"/green-check would be worse than nothing.

**Job:** *"Tell me what the register actually says about this firm — and never pretend that's a
clearance."*

**Joy:** enter a firm name or its FCA reference (FRN) → its register status appears as a card (authorised
/ no longer authorised / not on the register) with a plain-language "why", a deterministic note if a
look-alike appears among the same search's results, and a mandatory link to **verify on the FCA
register** — a **flag to investigate, never a green check** or a verdict.

## Why one engine

These are agents doing real work across fragmented systems. The same `runUsecase` core serves them all by
swapping a JSON — the modularity is the moat against one-off builds, and the general registry
(`worker/src/workflows.ts`) means a new corpus workflow is register + a JSON. See
[`architecture.md`](architecture.md) and ADR [`0001`](adr/0001-general-workflow-engine.md).
