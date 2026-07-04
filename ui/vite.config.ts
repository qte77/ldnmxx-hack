import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// vite.config.ts runs in Node; cast process to its typed shape (the browser tsconfig omits @types/node).
const nodeEnv = (process as unknown as { env: Record<string, string | undefined> }).env;

export default defineConfig({
  // GH Pages serves at /<repo>/; the gh-pages workflow sets CI=true. Local dev/build stay at /.
  base: nodeEnv.CI ? "/ldnmxx-hack/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin dev: the SPA fetches /run, Vite proxies it to the local `wrangler dev` worker.
    proxy: { "/run": { target: "http://localhost:8787", changeOrigin: true } },
  },
  build: { target: "es2022" },
  test: {
    // Unit tests here are pure (SSE parser, contract, applyA2UIEvent) — no DOM needed.
    environment: "node",
    globals: true,
  },
});
