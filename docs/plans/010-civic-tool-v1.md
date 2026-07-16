---
title: "Plan 010 — Civic tool v1: findings + outlook (narrow to a benefits wayfinder)"
type: plan
updated: 2026-07-16
status: proposed — strategy + findings, not yet accepted
refs: ["#66 (domain)", "#67 (NPM token)", "#18 (Phase 2)", "#29 (AI Gateway)"]
---

# Plan 010 — Civic tool v1: findings + outlook

> Direction: take `ldnmxx-hack` past the hackathon into a **real, free civic tool for Londoners**,
> hosted on Cloudflare (Pages + Worker, one custom domain) on Workers AI's free tier. This doc records
> what a value-proposition analysis (Strategyzer 10-characteristic scan + an adversarial red-team)
> found, and the honest v1 shape it points to. **Proposed, not accepted** — "Decisions needed" is the gate.

## Context (why this doc)

The model path runs live and the HUD makes demo-vs-live honest (PR-3, #64). The user wants to serve
**actual Londoner workflows** (benefits / tenders / support) on a real domain. Before building the
capstone usecases, we stress-tested the value proposition. This doc = the findings + the outlook.

## Findings (the honest reality)

- **The civic product isn't built.** Only `founders-copilot` + `on-it` exist; `benefits-copilot` /
  `tender-finder` / `support-finder` are one unbuilt roadmap line (plan 007, "0% built"). The
  "authoritative corpus" is **3 synthetic hard-coded records**; the ingest pipeline is "Not built yet"
  (`ingest/README.md`).
- **Value prop — strong core, weak defense.** Real, under-served pain (benefits complexity,
  advice-desert pressure on Citizens Advice, the dignity/stress of bureaucracy) makes Strategyzer
  **#2/#3/#5** the promising ground, reinforced by the shipped honesty HUD (#5). **Genuinely weak:**
  **#1** no business model (free, no funder/succession); **#6** no user-outcome metric (telemetry
  measures tokens, not "did the Londoner get help"); **#8/#9** differentiators are dev/auditor-facing,
  not what a user in crisis values; **#10 no moat** — public data + commodity corpus-RAG + Apache-2.0
  hand the one differentiator (the honesty chip) to incumbents (Turn2us / entitledto / Policy-in-Practice)
  who already occupy the gap.
- **"Free + graceful degradation" is aspirational.** No neuron-budget logic exists; overflow is a hard
  20 req/60s → bare `429` (an outage on success, for people with urgent needs). AI Gateway / spend cap
  not configured (#29).
- **Doc-integrity gap (fixed in this PR):** `demo-script.md` narrated the synthetic sample as
  "real … not hallucinated" — the exact conflation ("not LLM-hallucinated" ≠ "true real-world") a
  benefits tool cannot make. Reconciled with `data/README.md` (synthetic).

## Outlook — the honest v1 shape

Turn a clonable free tool into a defensible civic service with four moves:

1. **Narrow to ONE workflow — `benefits-copilot`.** Deepest civic pain; do one thing well (#4).
2. **Wayfinder, not adjudicator (v1).** Answer by *routing* — the official gov.uk calculator + the
   local Citizens Advice number — with a plain-language "this is not benefits advice" disclaimer and a
   mandatory link-out. Sidesteps the accuracy/safeguarding/liability trap until a real corpus + a named
   accountable maintainer exist. STUB/DEMO stays honest, but it is a *system-state* label, not a
   safeguarding mechanism.
3. **Secure ONE institutional partner** (a borough digital team, the GLA, Turn2us, or Citizens Advice).
   The single move that creates a business model (#1, partner-funded), a moat (#10, org-embeddedness a
   copier can't re-scrape), *and* a maintenance budget for yearly rule changes.
4. **Build the real corpus** (the ingest pipeline) before claiming "grounded."

**Delivery (locked, sound):** CF Pages (SPA) + Worker (API) under one custom domain (`claimldn.uk`,
#66), same-origin `/api`; Workers AI free tier primary (10k Neurons/day, no secret needed); degrade to
DEMO honestly at the ceiling — which needs the spend guardrail (#29) first.

## Actionable next steps

| # | Step | Owner | Ref |
|---|------|-------|-----|
| 1 | Fix synthetic-vs-"real" claim in `demo-script.md` | ✅ this PR | — |
| 2 | Register `claimldn.uk` (+ optional claim/check/find trio) | user | #66 |
| 3 | Shortlist + approach one institutional partner | user | this plan |
| 4 | Write `benefits-copilot` UserStory (Who/Pain/Job/Joy) + define the wayfinder MVP: disclaimer, link-out targets, one measurable win (e.g. time-to-official-answer) | — | this plan |
| 5 | Build ingest for one authoritative benefits corpus | — | `ingest/` |
| 6 | Add spend/rate guardrail — AI Gateway or neuron cap; degrade to DEMO, not `429` | — | #29 |
| 7 | Unblock P5 shared-package adoption (parallel infra track) | user | #67 |

## Decisions needed (the gate)

1. Accept the **narrow-to-benefits, wayfinder-first** framing for v1 (vs. keeping the 3-workflow scope)?
2. Which partner to approach first?
3. Confirm `claimldn.uk` as the domain?

## References

- Strategyzer — [10 Characteristics of Great Value Propositions](https://www.strategyzer.com/library/10-characteristics-of-great-value-propositions)
- Cloudflare — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) (10,000 Neurons/day free; $0.011/1k beyond)
- Prior: plan 007 (Phase 2), plan/handoff 008 (HUD), issues #18, #29
