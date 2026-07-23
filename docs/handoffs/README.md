# Handoffs

Session-to-session resume points (newest first). **Start at the resume point below.**

## ▶ Resume point: [016 — keyless real data](016-keyless-real-data.md) — CLOSED (P0–P5 shipped)

Arc 016 is complete: five real corpora live in D1 (postcodes · NHLE · OS Greenspace · CQC · FHRS),
v1.5.0/1.6.0/1.7.0 released + deployed + swept, the ingest cron batched under the subrequest cap.
**Next-session first action + backlog are in [016](016-keyless-real-data.md)'s "ARC CLOSED" block**
(verify the real 04:47 UTC edge cron; then #185 gazetteer widening is the highest-ROI next arc).

## Index

| # | Handoff | State |
|---|---|---|
| 016 | [Keyless real data — pipeline + 3 real corpora](016-keyless-real-data.md) | **CLOSED** — P0–P5 shipped |
| 015 | [Civic usecase expansion + real data](015-civic-usecase-expansion.md) | closed (≈90%; remainder → 016) |
| 014 | [Civic landing + strictness + perf](014-civic-landing-strictness-perf.md) | superseded |
| 013 | [UI pivot + security + brand + e2e](013-ui-pivot-security-brand-e2e.md) | superseded |
| 012 | [CF deploy + Care](012-cf-deploy-and-care.md) | superseded |
| 008 | [PR-3: HUD status bar](008-hud-status-bar.md) | superseded |
| 007 | [Phase 2 model-driven pipeline (#18)](007-phase2-model-pipeline.md) | superseded |
| 006 | [Two-path model access shipped (#37)](006-two-path-shipped.md) | superseded |
| 005 | [Two-path model access (#37)](005-two-path-model-access.md) | superseded |
| 004 | [Post-MVP priorities](004-post-mvp-priorities.md) | superseded |
| 003 | [Phase 1 done](003-phase1-done.md) | superseded |
| 002 | [Phase 1 first E2E](002-phase1-first-e2e-handoff.md) | superseded |
| 001 | [Onboarding](001-onboarding-handoff.md) | superseded |

_Convention: each new session adds `NNN-slug.md` (+ a paired `docs/plans/NNN-slug.md`) and updates the
resume-point line above. The root `README.md` links here, not to a specific handoff, so it never churns._

## Making an arc e2e-runnable (unattended-execution checklist)

Distilled from arc 016 — each item is a friction that cost real time when a plan/handoff omitted it.
A plan+handoff pair that carries all six runs hands-off with only the owner-gated merge go-ahead.

1. **Expected magnitudes per source in the source-map** — carry "expected ~N rows" for each data
   source so swap-gate floors are data-derived, not guessed (016 discovered them empirically).
2. **Recency-marker method as a done-when** — for any real-data swap, state that e2e markers are
   computed with the APP's own origin + metric (its geocoder, its distance fn), never an offline
   approximation. (016 hit a false FAIL from sample-coords markers 330 m off.)
3. **Explicit per-phase live-prove recipe** (checklist, not prose): deploy → hash-asserting MIME
   pre-flight (browser headers) → cron/job fire → poll the LAST target's completion stamp → sweep →
   commit the run-history line. Include the platform's on-demand trigger recipe (e.g. Workers:
   `--test-scheduled` is absent in `--remote`; fire via local dev + `remote = true` D1 binding).
4. **"Working tree freezes during a long fire"** — a `wrangler dev` fire holds the tree via its
   file-watch; PRE-STAGE every edit before firing, and run fires detached/backgrounded.
5. **Merge-gate line in the handoff** — the exact command and that it needs ONE owner go-ahead per
   session (`gh pr merge N --squash --admin --delete-branch` here; the classifier gates `--admin`).
6. **Honest-FAIL budget** — keeping deploy-race / marker / data FAILs in the run history is EXPECTED
   (each fixed in a follow-up), not a defect to be hidden by a later session.
