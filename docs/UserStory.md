# User stories

Two demo users, one engine (distilled from the sibling `ldnmxx` track briefs) — plus **Track C**, the v1
productization target (plans 010/011, proposed).

## Track B — the early-stage London founder *(Build London)*

**Who:** an early-stage London founder — an idea or working prototype, pre- or just-incorporated, no
grant-writing expertise, no budget for a consultant.

**Pain:** funding discovery is fragmented (no single API); qualifying is guesswork; the first real steps
(incorporate, who to talk to) are a maze; re-keying the same answers into each scheme costs 4–8h.

**Job:** *"Where am I, what funding fits, who do I talk to, and get me incorporated — fast, one click."*

**Joy:** describe the idea once → the copilot assesses the stage, surfaces matched grants with a
qualify-first gate, suggests who to talk to, and produces a one-click **incorporation-ready** pack.

## Track A — the mobility-constrained Londoner *(Live London)*

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

## Track C — the Londoner who might be entitled *(Claim London)*

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

## Why one engine

Both are agents doing real work across fragmented systems. The same `runUsecase` core serves both by
swapping a JSON — the modularity is the moat against one-off builds. See [`architecture.md`](architecture.md).
