# User stories

Two users, one engine. (Distilled from the track briefs in the sibling `ldnmxx` repo.)

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

## Why one engine

Both are agents doing real work across fragmented systems. The same `runUsecase` core serves both by
swapping a JSON — the modularity is the moat against one-off builds. See [`architecture.md`](architecture.md).
