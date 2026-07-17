// Single source of truth for the Worker /api base URL.
// - Dev: "" → the SPA fetches same-origin "/api/*", which Vite proxies to the local `wrangler dev`
//   worker on :8787 (override with VITE_WORKER_BASE in ui/.env for a remote worker).
// - Prod (CF Pages on sortmy.london): "" → same-origin "/api/*", served by a Worker route on the Pages
//   domain (no CORS). Override with VITE_WORKER_BASE for a cross-origin Worker if ever needed.
export const WORKER_BASE: string = import.meta.env.VITE_WORKER_BASE ?? "";
