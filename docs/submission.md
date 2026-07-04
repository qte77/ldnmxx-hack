---
title: "Submission — Groundwork (one workflow engine; two example workflows)"
type: submission
updated: 2026-07-04
---

# Submission — Groundwork

- Prefilled deck. **Star = the engine** (Groundwork): swap a JSON, swap the app; the agent renders the UI.
- **Founder's Copilot** = flagship example (Build London). **On It** = interchange proof (Live London).
- `[confirm]` = decide before submitting.

---

## 1 · Cover

# Groundwork
### one workflow engine · swap a JSON, swap the app · the agent renders the UI

- **Flagship — Founder's Copilot:** a founder's first steps, in one place.
- **Interchange proof — On It:** step-free London routes — same engine, one JSON away.
- **Builder:** `[your name]` · **Track:** **Build London**.
- **Live:** <https://qte77.github.io/ldnmxx-hack> · **Code:** <https://github.com/qte77/ldnmxx-hack>

---

## 2 · The Problem / Challenge

> *"The specific challenge I want to address is…"*

We prove the engine on a real London problem first — the **flagship, Founder's Copilot**:

- An early-stage founder works out — **alone** — their stage, which grants fit, and how to incorporate, then **re-keys** the same answers into every scheme.
- No single tool maps the first steps; a generic chatbot **invents** the links.

> *"I came across this challenge because…"*

- `[your founder story]`.
- No official "founder-demand" list → we lean on concrete **time-saving** + a **verified (not hallucinated)** incorporation path.

---

## 3 · The Opportunity

- **Who it's for:** *builders* who want agent apps as **config, not code** — serving real Londoners (founders; step-free travellers).
- A **modular workflow engine**: describe once → the engine runs a workflow → the agent renders the UI.
- Each workflow is **one JSON** — adding one is a **config change, not a new app**.
- Output is **generative UI** — interactive A2UI cards, not a wall of text.

---

## 4 · The Solution

**The loop** — every workflow runs the same cycle, user back to user. **One toggle swaps the JSON; the same engine runs a different example:**

```text
              ┌─ Founder's Copilot · founders-copilot.json
   swap JSON ─┤  one toggle, same engine
              └─ On It · on-it.json
              │
              ▼
User ─▶ UI ─▶ Workflow ─▶ Agent ─▶ Generative UI ──┐
▲       AG-UI runStages   OpenRtr  A2UI + HUD       │
└────────────── renders back to user ──────────────┘
```

- **The engine (the product):** one `POST /run?usecase=<id>` + a small `runStages` (**plan → tool → render**); one **toggle** swaps the workflow on the same engine (stage-defs externalize to `usecases/*.json` next).
- **Generative UI:** the agent (OpenRouter) **generates the A2UI cards live**, not text — streamed to a watch-it-work HUD (a deterministic stub renders when no key is set).
- **Flagship — Founder's Copilot (Build London):** describe your idea → the model generates **grant cards** matched to it, qualify-first (✓/✗), each with a source link. *(Stage assessment + Companies House incorporation = next.)*
- **Interchange proof — On It (Live London):** one toggle → a different workflow: a **step-free London route** (canned demo data), same engine, not a one-off. *(Live TfL + voice = next.)*
- **Stack — why:** **Cloudflare** (edge + trust boundary, secrets Worker-only) · **OpenRouter** (real model renders the cards; swap the LLM, BYOK) · **Arize** (one span/stage in `wrangler tail`; dashboard export next).

---

## 5 · Demo

60 seconds, **keyless** (a deterministic stub renders if no model key is set):

1. **[Flagship]** describe an idea → the model generates **grant cards** matched to it (qualify-first, source links) — watch it stream into the HUD.
2. **[Swap the workflow]** one toggle → *On It* runs a different workflow on the same engine: a **step-free London route**.

> *"We didn't write a second app — we swapped a JSON, and the same `runStages` engine ran it."*

---

## 6 · Next Steps

- **Flagship depth (Founder's Copilot):** who-to-talk-to → **grab a coffee** (A2UI contact cards + one-tap intro); live Companies House filing; grant-application draft; eligibility oracle.
- **More example workflows** (each = one JSON): full On It / Track A (Open311 + ReportCard → council pilot); new civic/founder use-cases.
- **Deferred:** stage assessment + Companies House incorporation + contact cards (flagship depth); voice / TfL / map (On It depth); real Arize dashboard export; KV-backed data; `usecases/*.json` engine; AG Grid; A2A; ingest cron; D1.

---

## 7 · Thank you

# Groundwork
**one workflow engine · swap a JSON, swap the app · the agent renders the UI · two example workflows, two Londons.**
Builder: `[name]`

- **Live:** <https://qte77.github.io/ldnmxx-hack> · **Code:** <https://github.com/qte77/ldnmxx-hack>

---

### Judging map + open `[confirm]`s

- **Idea validation** → slide 2: real founder friction + a *verified* path. Soft spot (no Londoner-demand list) → counter with the verified path + *On It* (validated Live-London need, same engine).
- **Technical** → slides 3–4: swappable engine + **generative UI** + live JSON swap + Companies House.
- **Readiness / UX** → slide 5 + slides 4–5: the one-run journey, the incorporation payoff.
- **Primary CTA** (app): **"Describe your idea →"**. **Engine takeaway:** swap a JSON, add a workflow — no new app.
- **Confirm:** builder name(s).
