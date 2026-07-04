import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../src/worker";

interface Component {
  id: string;
  component: Record<string, { child?: string; children?: { explicitList?: string[] } }>;
}
interface Batch {
  beginRendering?: { surfaceId: string; root: string };
  surfaceUpdate?: { surfaceId: string; components: Component[] };
}
interface Frame {
  type: string;
  text?: string;
  a2uiMessages?: Batch[];
}

const env = { ALLOWED_ORIGINS: "https://qte77.github.io,http://localhost:5173" };
const ctx = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

function post(usecase: string): Request {
  return new Request(`https://w.example/run?usecase=${usecase}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://qte77.github.io" },
    body: JSON.stringify({ prompt: "test idea" }),
  });
}

function parseFrames(text: string): Frame[] {
  return text
    .split("\n\n")
    .filter((c) => c.startsWith("data:"))
    .map((c) => JSON.parse(c.slice(5).trim()) as Frame);
}

// Structural self-containment check (contract.ts re-expressed dependency-free — keeps worker/ tests
// decoupled from ui/): root defined, every referenced child id defined, Card.child a single string.
function assertSelfContained(batch: Batch[]): void {
  const begin = batch.find((m) => m.beginRendering)?.beginRendering;
  const update = batch.find((m) => m.surfaceUpdate)?.surfaceUpdate;
  expect(begin).toBeTruthy();
  expect(update).toBeTruthy();
  if (!begin || !update) return;
  const ids = new Set(update.components.map((c) => c.id));
  expect(ids.has(begin.root)).toBe(true);
  for (const comp of update.components) {
    const props = Object.values(comp.component)[0];
    const card = comp.component.Card;
    if (card) {
      expect(typeof card.child).toBe("string");
      if (card.child) expect(ids.has(card.child)).toBe(true);
    }
    const list = props?.children?.explicitList;
    if (Array.isArray(list)) {
      for (const id of list) expect(ids.has(id)).toBe(true);
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("worker /run", () => {
  it("streams a self-contained founders-copilot batch + RUN_FINISHED + CORS", async () => {
    const res = await worker.fetch(post("founders-copilot"), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://qte77.github.io");
    const frames = parseFrames(await res.text());
    expect(frames.at(-1)?.type).toBe("RUN_FINISHED");
    const batch = frames.find((f) => f.a2uiMessages)?.a2uiMessages;
    expect(batch).toBeTruthy();
    if (batch) assertSelfContained(batch);
  });

  it("streams a self-contained on-it route batch (same engine, different JSON)", async () => {
    const res = await worker.fetch(post("on-it"), env, ctx);
    const batch = parseFrames(await res.text()).find((f) => f.a2uiMessages)?.a2uiMessages;
    expect(batch).toBeTruthy();
    if (batch) assertSelfContained(batch);
  });

  it("emits one Arize span per stage (run/plan/tool/render)", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await worker.fetch(post("founders-copilot"), env, ctx).then((r) => r.text());
    const spans = spy.mock.calls.filter((c) => c[0] === "⌁ span").map((c) => c[1]);
    expect(spans).toEqual(["run", "plan", "tool:search_opportunities", "render"]);
  });

  it("rejects an unknown usecase with 400", async () => {
    const res = await worker.fetch(post("nope"), env, ctx);
    expect(res.status).toBe(400);
  });

  it("rejects a non-POST with 405", async () => {
    const req = new Request("https://w.example/run?usecase=founders-copilot", { method: "GET" });
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(405);
  });

  it("answers an OPTIONS preflight with 204 + CORS", async () => {
    const req = new Request("https://w.example/run?usecase=founders-copilot", {
      method: "OPTIONS",
      headers: { origin: "https://qte77.github.io" },
    });
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
