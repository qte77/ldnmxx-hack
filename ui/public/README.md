# sortmy.london

A free civic wayfinder for London public services. Ask a question in your own words (plus a
postcode or place) and it signposts you to the official public-service record — never advice,
never a fabricated answer, always a date and a link back to the official source so you can
confirm it yourself.

**We find it. You sort it.** No account, no cookies, no tracking beyond anonymous page-view
counts.

## What it covers

- **Sort My Care** — NHS and public health services near a postcode (GPs, pharmacies,
  hospitals, dentists). Source: Care Quality Commission.
- **Sort My Wander** — parks, green spaces and listed heritage sites near a postcode. Source:
  Historic England & Ordnance Survey.
- **Sort My Food Hygiene** — official food hygiene ratings for restaurants and takeaways near a
  postcode. Source: Food Standards Agency.
- **Sort My Scam Check** — whether a firm is on the FCA's register of authorised financial
  businesses. Source: Financial Conduct Authority. *Sample data only — not a live regulatory
  lookup.*

Two further workflows exist as demos only (never auto-routed — reachable only via an explicit
link): **Sort My Route** (a canned step-free transport route planner) and **Founder's Copilot**
(a canned funding/incorporation copilot for London startups).

## How current the data is

Results are a weekly-to-daily snapshot of official registers, not a live search. Every result
carries its own date and a link to the official page. `GET /api/freshness` returns the exact
ingest date and row count behind every workflow, machine-readably.

## For developers and agents

- API: `POST /api/run`, `GET /api/freshness` — described at
  [`/openapi.json`](https://sortmy.london/openapi.json) and
  [`/.well-known/api-catalog`](https://sortmy.london/.well-known/api-catalog).
- Workflow catalog: [`/.well-known/agent-skills/index.json`](https://sortmy.london/.well-known/agent-skills/index.json).
- Auth: none required — see [`/auth.md`](https://sortmy.london/auth.md).
- Agent-facing overview: [`/llms.txt`](https://sortmy.london/llms.txt).
- Source, and each workflow's real definition (`usecases/*.json`): [github.com/qte77/ldnmxx-hack](https://github.com/qte77/ldnmxx-hack).
