---
title: "Plan 011 — benefits-copilot: wayfinder MVP scope"
type: plan
updated: 2026-07-17
status: proposed — depends on plan 010 decision #1 (narrow-to-benefits, wayfinder-first)
refs: ["docs/plans/010-civic-tool-v1.md", "#66 (domain)", "#29 (spend guardrail)"]
---

# Plan 011 — benefits-copilot: wayfinder MVP scope

> The concrete v1 spec for plan 010's "narrow to one workflow" move. **Proposed** — it presumes plan 010
> decision #1 is accepted. Corpus + partner + guardrail are prerequisites for *public launch*, not for the
> first build.

## Principle — wayfinder, not adjudicator

v1 answers by **routing to official channels**. It never computes an eligibility determination or an
amount. Every answer ends at gov.uk / the borough / Citizens Advice. This sidesteps the accuracy,
safeguarding, and liability trap a benefits *calculator* carries — that stays incumbents' job
(entitledto / Turn2us / the official checkers).

## In scope (v1)

- **Input:** free-text situation (household, rough circumstances). No account; **no PII stored.**
- **Output** — A2UI cards, reusing the built-in `Column` / `Card` / `Text` builders:
  - a plain-English **"what to look at"** list — each likely-relevant scheme as a Card: name · a one-line
    *"why this might apply to you"* · a **link to the official checker/claim page**;
  - a **"talk to a human"** Card — local Citizens Advice + council contact;
  - a **persistent disclaimer**: *"Guidance to official sources, not a benefits decision. Confirm on
    gov.uk or with an adviser."*
- **Grounding:** the agent is restricted to a curated corpus; the match stage **rejects anything not in
  corpus** — reuse the `search_opportunities` validator pattern that rejects invented ids. Signpost links
  are **curated + verified, never LLM-generated** (same discipline as the shipped `incorporate` card).
- **Honesty:** reuse the LIVE/DEMO/STUB HUD, but label it so STUB/DEMO reads as *system state*, not
  *"no answer for you."*
- **One measurable win (#6/#9):** *time-to-correct-official-link* — surface the correct official checker
  for a fixed scenario set (target ≥90% on ~20 scenarios) in fewer steps than starting at gov.uk cold.

## Explicitly out (YAGNI + safety)

- No eligibility **calculation** or amount estimate.
- No form-filling, no claim submission, **no storing personal data**, no accounts.
- No tender/support workflows yet (v1 = one workflow).
- No broad live scraping — start from a small **curated seed corpus**; grow ingest incrementally.

## Stage def — `usecases/benefits-copilot.json`

Mirrors `founders-copilot.json` (three JSON stages read at runtime by `runUsecase`):

1. `plan` → *"understand the situation"* → `TEXT`: "Working out what support might apply…"
2. `tool:match_support` (like `search_opportunities`) → match the situation to corpus entries (validator-gated).
3. `tool:signpost` (like `incorporate`) → render official links + a Citizens Advice/council card
   (verified links only). `render.mode: "benefits"`.

## Corpus record (what ingest must produce)

`{ id, name, whoItsFor, officialUrl, authority, lastVerified }` — `whoItsFor` in plain English;
`authority` ∈ gov.uk | council | charity; **verified links only.** Seed ~10–15 high-impact London
schemes: Universal Credit, Council Tax Reduction, PIP, Healthy Start, free school meals, Blue Badge,
Warm Home Discount, Discretionary Housing Payment, …

## Prerequisites before public launch

- Mandatory disclaimer on every render.
- A **named accountable maintainer** (ties to the institutional partner — plan 010).
- Spend guardrail so it degrades to DEMO, not `429` (#29).

## Decisions needed

1. Confirm the wayfinder-not-adjudicator boundary (no calculation in v1)?
2. Seed-corpus scope — which ~10–15 schemes, and who verifies the links?
