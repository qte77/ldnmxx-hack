---
title: "Submission — Groundwork (Track B star; workflow engine showcased via Track A)"
type: submission
updated: 2026-07-04
---

# Submission — Groundwork

> **ARCHIVED 2026-07-22 — historical record (Londonmaxxing 003 submission deck, 2026-07-04), no
> longer maintained.** References v1.0.0-era internals (`runStages`, KV, `UsecaseInspector`) that no
> longer exist. Current state: `README.md` + `docs/architecture.md` + ADR 0002; roadmap: plan 015
> (`docs/plans/015-*.md`, tracker #113).

Prefilled deck. **Star = Track B (Groundwork, the founder copilot).** Track A ("On It") is the live proof of
the **modular workflow engine**. `[confirm]` = decide before submitting.

---

## 1 · Cover

# Groundwork
### a founder's first steps, in one place

- **Builder:** `[your name]`
- **Track:** **Build London**  *(the same engine runs a Live-London workflow too — slides 4–5)*

---

## 2 · The Problem / Challenge

> *"The specific challenge I want to address is…"*

An early-stage London founder has to work out — alone — **what stage they're at, which grants might fit,
and how to actually incorporate**, then re-key the same answers into every scheme. No single tool maps the
first steps, and a generic chatbot **invents** the links.

> *"I came across this challenge because…"*

`[your founder story]`. Honest: there's no official "founder demand" list, so we lean on the concrete
time-saving and a **verified (not hallucinated) incorporation path**.

---

## 3 · The Opportunity

A founder copilot on a **modular workflow engine**. Describe your idea once → Groundwork maps your first
steps. The engine is the point: the *same* core serves any use-case by loading a different JSON — so one
build covers more than one problem, and adding a workflow is a config change, not a new app.

---

## 4 · The Solution

- **Groundwork (Build London) — the star:** describe your idea once → **your stage → grants that might fit
  (qualify ✓/⚠️) → the verified steps to incorporate** (real gov.uk / Companies House links). A2UI cards, a
  watch-it-work HUD.
- **The workflow engine — the technical core:** one `POST /run?usecase=<id>` + a ~60-LOC `runStages`
  (plan → tool → render), streamed live to the HUD. Each app is just a declarative `usecases/*.json`; the
  **`UsecaseInspector` shows the live stage-defs**.
- **Same engine, one JSON away — *On It* (Live London):** swap `founders-copilot.json` → `on-it.json` and
  the *same core* runs a **completely different workflow — STT → postcode (postcodes.io) → step-free route
  (TfL) → OSM accessibility map → TTS.** Proof the engine is real, not a one-off.
- Built on Cloudflare **Workers + Pages + KV** · **OpenRouter** via AI Gateway · **Arize** · A2UI/AG-UI.
  Secrets Worker-only.

---

## 5 · Demo

60 seconds, **keyless/offline** (replays = safety net):
1. **[Build — the star]** describe an idea → Groundwork shows your **stage → grants that might fit → the
   verified steps to incorporate** (real links).
2. **[Engine — the proof]** one toggle → the **`UsecaseInspector` shows the stage-defs swap** → *On It* runs
   a different workflow entirely: **speak a destination → step-free route on an OSM map, read back.**
   *"We didn't write a second app — we swapped a JSON, and the same `runStages` engine ran it."*

---

## 6 · Next Steps

- **Groundwork depth:** who-to-talk-to (contacts); live Companies House filing; the grant-application draft;
  eligibility oracle.
- **More workflows on the same engine** (each = one JSON): full Track A (Open311 report + ReportCard →
  council pilot); new civic/founder use-cases.
- **Deferred:** AG Grid, A2A endpoint, ingest cron, D1.

---

## 7 · Thank you

# Groundwork
**a founder's first steps, in one place · one engine, swap a JSON, two Londons.**
Builder: `[name]`

---

### Judging map + open `[confirm]`s

- **Idea validation** → slide 2 (founder friction + the *verified* path). ⚠️ B's soft spot (no
  Londoner-demand list) — counters: the verified path + "a chatbot can't do this safely," plus *On It* nods
  to a validated Live-London need on the same engine.
- **Technical** → slides 4–5 (the modular workflow engine + the live JSON swap + Companies House).
  **Readiness** → slide 5. **UX** → slides 4–5 (the one-run journey, the incorporation payoff).
- **Primary CTA** (app/hero): **"Describe your idea →"**. **Confirm:** builder name(s).
