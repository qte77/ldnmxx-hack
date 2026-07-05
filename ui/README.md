# ui/ — SPA (Cloudflare Pages)

Vite + React + TS, built on top of `qte77/agenthud-agui-a2ui` per `docs/plans/001-build-plan.md`.
Calls `POST /run?usecase=<id>` (SSE), renders the A2UI HUD (built-in cards) + event log; header toggle
swaps Track B ⇄ A. Tests in `ui/tests/`.

**Built + deployed:** live at <https://qte77.github.io/ldnmxx-hack/>. Key files: `src/App.tsx` (shell +
usecase toggle), `src/agent/useAgentSSE.ts` (SSE transport), `src/A2UISurface.tsx` (render seam),
`src/catalog.ts`/`src/CatalogViewer.tsx` (live A2UI component catalog), `src/EventStream.tsx` (live
event log).

**Run:** `npm run dev` (or `make dev-ui`). Scripts: `dev`, `build`, `typecheck`, `lint`, `test`.
