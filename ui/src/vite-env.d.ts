/// <reference types="vite/client" />

// DEV-only local config (see ui/.env.example). Vite embeds VITE_* into the client bundle, so NO secret
// may ever live in a VITE_* var. There is deliberately no key-holding env var: a model key is supplied
// at runtime via the ⚙ Key panel (held in memory) and forwarded to the Worker, resolved server-side.
interface ImportMetaEnv {
  // Dev override for the Worker /api base (e.g. a remote `wrangler dev`); empty in dev = Vite proxy.
  readonly VITE_WORKER_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
