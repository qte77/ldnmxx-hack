import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// vite.config.ts runs in Node; cast process to its typed shape (the browser tsconfig omits @types/node).
const nodeEnv = (process as unknown as { env: Record<string, string | undefined> }).env;

export default defineConfig({
  // CF Pages serves at the domain root (sortmy.london). Override with VITE_BASE if ever needed.
  base: nodeEnv.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin dev: the SPA fetches /api/*, Vite proxies it to the local `wrangler dev` worker.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        // Perf: vendor deps (react/react-dom/@a2ui/react/zod) change far less often than ui/src/, so
        // splitting them into their own chunk lets Cloudflare's edge cache keep serving it unchanged
        // across most releases instead of invalidating everything (one hashed bundle) on every deploy.
        // Vite 8's bundler (Rolldown) requires the function form — the plain-object shorthand throws.
        manualChunks(id: string) {
          if (/node_modules\/(?:react|react-dom|@a2ui\/react|zod)\//.test(id)) return "vendor";
        },
      },
    },
  },
  // Footer version: injected at build time from the npm-run env (`make bump` stamps package.json);
  // falls back to "dev" outside an npm script so a bare `vite` run stays honest.
  define: { __APP_VERSION__: JSON.stringify(nodeEnv.npm_package_version ?? "dev") },
  test: {
    // Unit tests here are pure (SSE parser, contract, applyA2UIEvent) — no DOM needed.
    environment: "node",
    globals: true,
  },
});
