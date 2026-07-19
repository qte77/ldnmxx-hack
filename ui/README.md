# ui/ — SPA (Cloudflare Pages)

Vite + React + TS, built on top of `qte77/agenthud-agui-a2ui`. The civic landing for
**sortmy.london**: a task-first, progressive-disclosure page — **Sort My Care** is the flagship
(a London postcode → nearby NHS & care services), **On It** (step-free routes) is revealed on demand.
Calls `POST /api/run?usecase=<id>` (SSE) and renders the A2UI cards (Column / Card / Text). Dev chrome
(event log, ⚙ Key) is gated behind `?dev` / Ctrl+K. Tests in `ui/tests/`.

**Live:** <https://sortmy.london>. Key files: `src/App.tsx` (landing hero + progressive disclosure),
`src/usecase.ts` (`?usecase=` routing, tested), `src/agent/useAgentSSE.ts` (SSE transport),
`src/A2UISurface.tsx` (render seam), `src/EventStream.tsx` (dev-only event log).

**Run:** `npm run dev` (or `make dev-ui`). Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `size`.
