// HTTP-level contract test for /api/mcp (plan 025 row 6). Spawns a REAL `wrangler dev` process and
// drives it over REAL HTTP — deliberately NOT another in-process call to `handleMcp()` (that is
// dispatch.test.ts's job, 13 tests). This test exists to catch what an in-process call structurally
// cannot: a wrong route pattern in worker.ts's `fetch()`/`mcpRoute`, the ACTUAL CORS headers
// wrangler/workerd puts on the wire, and the local `[[ratelimits]]` MCP_RATE_LIMITER binding's real
// PRESENCE (dispatch.test.ts's `ENV = {} as Env` never binds it, so `respondMcp`'s rate-limit branch in
// worker.ts is never even reached by that suite — every request here goes through it for real).
//
// Uses wrangler.live-test.toml (same directory), not the real wrangler.toml: the real config's [ai]
// binding proxies to REMOTE Workers AI even in local `wrangler dev`, which fails in this credential-free
// devcontainer with "necessary to set a CLOUDFLARE_API_TOKEN". /api/mcp's 4 tools never touch `env.AI`
// (they wrap corpus/query.ts + scam/query.ts only), so dropping [ai] is safe for this test only — see
// that file's own header comment for the full rationale. Local D1 is bound but unmigrated here, so this
// exercises the D1-absent/failing -> bundled-sample-corpus fallback path, not a seeded D1 read.
//
// Excluded from the default `npm test` (package.json: `vitest run --exclude '**/*.live.test.ts'`) since
// spawning a real dev server is slow (cold esbuild + workerd + local-D1 init) — run explicitly via
// `npm run test:live`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WRANGLER_BIN = join(WORKER_ROOT, "node_modules", ".bin", "wrangler");
// Fixed + uncommon so a concurrent `make dev` (8787/9229) or another session's wrangler never collides.
const PORT = 18789;
const INSPECTOR_PORT = 18790;
const BASE_URL = `http://localhost:${String(PORT)}/api/mcp`;
const READY_TIMEOUT_MS = 60_000;
const READY_POLL_MS = 500;

interface JsonRpcResponseBody {
  result?: {
    serverInfo?: { name?: string };
    tools?: { name: string }[];
    content?: { text: string }[];
  };
}

let child: ChildProcess | undefined;
let bootLog = "";

function rpc(body: unknown): Promise<Response> {
  return fetch(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Poll `initialize` — not a bare TCP connect, since wrangler's local proxy can bind the port before
// workerd has finished compiling the Worker, which would otherwise 503 the very first real request.
async function waitUntilReady(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await rpc({ jsonrpc: "2.0", id: 0, method: "initialize" });
      if (response.ok) return;
    } catch {
      // connection refused while wrangler/workerd is still booting — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  throw new Error(
    `wrangler dev never became ready within ${String(READY_TIMEOUT_MS)}ms.\n--- boot log ---\n${bootLog}`
  );
}

beforeAll(async () => {
  child = spawn(
    WRANGLER_BIN,
    ["dev", "--config", "wrangler.live-test.toml", "--port", String(PORT), "--inspector-port", String(INSPECTOR_PORT)],
    {
      cwd: WORKER_ROOT,
      detached: true, // own process group, so afterAll can kill wrangler + the workerd it spawns together
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" },
    }
  );
  child.stdout?.on("data", (chunk: Buffer) => {
    bootLog += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    bootLog += chunk.toString();
  });
  await waitUntilReady();
}, 90_000);

afterAll(() => {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM"); // negative pid = the whole process group (pass or fail teardown)
  } catch {
    // already exited
  }
}, 15_000);

describe("POST /api/mcp — real HTTP against a real wrangler dev process", () => {
  it("answers initialize with the real CORS header over the wire", async () => {
    const response = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toMatch(/application\/json/u);
    const body: JsonRpcResponseBody = await response.json();
    expect(body.result?.serverInfo?.name).toBe("sortmy-london-mcp");
  });

  it("answers tools/list with exactly the 4 real tool names", async () => {
    const response = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const body: JsonRpcResponseBody = await response.json();
    const names = (body.result?.tools ?? []).map((t) => t.name);
    expect(names).toEqual(["sort_my_care", "sort_my_wander", "sort_my_scam_check", "sort_my_food_hygiene"]);
  });

  it("tools/call sort_my_care returns real rows for a known sample postcode", async () => {
    const response = await rpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "sort_my_care", arguments: { prompt: "SW9 9SL" } },
    });
    expect(response.status).toBe(200);
    const body: JsonRpcResponseBody = await response.json();
    const text = body.result?.content?.[0]?.text;
    if (!text) throw new Error(`expected tool content, got: ${JSON.stringify(body)}`);
    const payload = JSON.parse(text) as { query: string | null; rows: { officialUrl: string }[] };
    expect(payload.query).toBe("SW9 9SL");
    expect(payload.rows.length).toBeGreaterThan(0);
    expect(payload.rows[0]).toHaveProperty("officialUrl");
  });

  it("preflights OPTIONS with a real 204 + CORS methods header", async () => {
    const response = await fetch(BASE_URL, { method: "OPTIONS" });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });

  it("rejects a non-POST/OPTIONS method with a real 405 + CORS header (worker.ts's mcpRoute, not reachable from dispatch.test.ts)", async () => {
    const response = await fetch(BASE_URL, { method: "GET" });
    expect(response.status).toBe(405);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
