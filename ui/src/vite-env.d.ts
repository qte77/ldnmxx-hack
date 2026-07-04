/// <reference types="vite/client" />

// DEV-only local config (see ui/.env.example). Vite embeds VITE_* into the client bundle, so a real
// key must only ever live in the gitignored ui/.env for local convenience — never committed. In prod
// the dashboard BYOK field (held in memory) is the way to supply a key.
interface ImportMetaEnv {
  // Dev override for the Worker /run base (e.g. a remote `wrangler dev`); empty in dev = Vite proxy.
  readonly VITE_WORKER_BASE?: string;
  // Optional dev prefill for the BYOK field.
  readonly VITE_BYOK_API_KEY?: string;
  readonly VITE_BYOK_MODEL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
