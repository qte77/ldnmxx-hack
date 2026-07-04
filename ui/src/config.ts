// Single source of truth for the Worker /run base URL.
// - Dev: empty string → the SPA fetches same-origin "/run", which Vite proxies to the local
//   `wrangler dev` worker on :8787 (override with VITE_WORKER_BASE in ui/.env for a remote worker).
// - Prod (GitHub Pages): the deployed Worker, called cross-origin. Bake the exact subdomain in after
//   the first `wrangler deploy` (worker CORS allowlists the Pages origin).
export const WORKER_BASE: string = import.meta.env.DEV
  ? (import.meta.env.VITE_WORKER_BASE ?? "")
  : "https://ldnmxx-hack-worker.cloudflare-driveway392.workers.dev";
