# Submission — ldnmxx-hack

Prefilled markdown deck for **Londonmaxxing 003**, mirroring the official 7-slide template.
`[confirm]` = fill/decide before submitting. Judging criteria mapped at the end.

---

## 1 · Cover

# ldnmxx-hack
### *one agent core, two Londons*

- **Builder:** `[your name]` (qte77)
- **Track:** **Live London** `[confirm — or flip to Build London; see note at end]`

---

## 2 · The Problem / Challenge

> *"The specific challenge I want to address is…"*

Mobility-constrained Londoners (wheelchair, buggy, injury) hit broken infrastructure daily — lifts out,
step-free routes blocked — and must juggle 3+ siloed apps to reroute **and** report. Routing and reporting
are the **same moment**, but nothing joins them.

> *"I came across this challenge because…"*

It's a **structural** gap, not a technical one: TfL, FixMyStreet and boroughs can't unify without
multi-year inter-agency agreement — incumbents are *barred* from closing it. `[confirm it's on
Londonmaxxing's "What Londoners are asking for" list and mirror the wording — cheapest idea-validation
point]`

---

## 3 · The Opportunity

One **modular agent core — "one core, three seams"** — that swaps its entire use-case by loading a
different JSON. The **same engine serves both** London tracks, so the modularity itself is the moat
against one-off builds. Keyless civic APIs (postcodes.io, TfL) make the cross-agency join buildable by an
independent **in a day** — exactly what incumbents structurally can't ship.

---

## 4 · The Solution

- **On It (Live London):** speak a step-free request → postcodes.io (borough) → TfL Journey (step-free
  route + disruption) → a **RouteCard** in a watch-it-work HUD. **Voice = accessible by default.**
- **Founder's Copilot (Build London) — same engine:** describe an idea once → a **one-click journey** in
  A2UI cards: **assess stage → matched grants → who to talk to → get incorporation-ready** (Companies House).
- **The reveal:** one toggle flips `?usecase=` — *same endpoint, same `runStages`, swap the JSON.* Built on
  Cloudflare **Workers + Pages + KV** · **OpenRouter** via AI Gateway · **Arize** · A2UI/AG-UI. Secrets
  Worker-only.

---

## 5 · Demo

60 seconds, **keyless/offline** (pre-baked replay = safety net):
1. **[Live]** speak *"step-free from E8 3GT to Westminster"* → the step-free route renders live on an **OSM map** in the HUD.
2. **[toggle]** → `UsecaseInspector` shows the JSON swap.
3. **[Build]** describe an idea → stage → matched grants → contacts → **incorporation-ready in one click**
   (the joy moment).

*One core, two Londons, proven live.*

---

## 6 · Next Steps

- **Full civic action:** Open311 `file_report` + `ReportCard` — report the broken lift, get a reference id
  → **council pilot**.
- **Founder-copilot depth:** real Companies House filing (auth + fee); eligibility oracle across more
  programs; the grant-application draft.
- **Deferred backlog:** AG Grid data grid, ElevenLabs TTS, A2A endpoint, ingest cron.

---

## 7 · Thank you

# ldnmxx-hack
**one agent core, two Londons.**
Builder: `[name]` · Reuse: `qte77/agenthud-agui-a2ui` + `qte77/polyfetch-scrape`

---

### Judging map + open `[confirm]`s

- **Idea validation** → slide 2 · **Technical approach** → slide 4 · **Project readiness** → slide 5 ·
  **UX/design** → slides 4–5.
- **Track decision:** *Live London* wins idea-validation (real Londoner demand); *Build London* has the
  fully-built copilot + the joy moment. **Recommended: Live London primary**, with the Build-London copilot
  as the demo's second-act reveal (so its one-click incorporation lands as "the same engine also does *this*").
- **Confirm:** project name · builder name(s) · primary track · the Track-A ask is on the demand list.
