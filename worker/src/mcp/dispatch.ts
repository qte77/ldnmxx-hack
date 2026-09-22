// MCP over plain JSON-RPC 2.0 (ADR 0007) — `initialize` / `notifications/initialized` / `tools/list` /
// `tools/call`. Hand-rolled, no `@modelcontextprotocol/sdk` (mirrors sfclarity's own reference
// implementation). Every tool is a thin adapter over an EXISTING deterministic query function
// (`corpus/query.ts`, `scam/query.ts`) — no LLM call inside a tool handler, ever.
import { queryCorpus } from "../corpus/query";
import { queryScam } from "../scam/query";
import { getUsecase } from "../usecases";
import type { Env } from "../worker";
import { mcpTools, usecaseIdForTool } from "./tools";

const SERVER_INFO = { name: "sortmy-london-mcp", version: "1.0.0" } as const;
const PROTOCOL_VERSION = "2026-06-18";

interface ToolContent {
  readonly type: "text";
  readonly text: string;
}
interface ToolResult {
  readonly content: ToolContent[];
  readonly isError?: boolean;
}

function rpcResult(id: unknown, result: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: { ...cors, "content-type": "application/json" },
  });
}

function rpcError(id: unknown, code: number, message: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
    headers: { ...cors, "content-type": "application/json" },
  });
}

function textResult(text: string, isError = false): ToolResult {
  return isError ? { content: [{ type: "text", text }], isError: true } : { content: [{ type: "text", text }] };
}

// Dispatch a tool call to the SAME deterministic query fn workflows.ts's `registry.query` runs for
// the equivalent usecase stage — an MCP tool answers with exactly the data the SPA would render, no
// second query path. `getUsecase` + its stage's `exec`/`corpus` are the single source of truth for
// which query fn + corpus id a tool wraps (never a second, hand-maintained mapping).
async function callTool(name: string, args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const id = usecaseIdForTool(name);
  const def = getUsecase(id);
  const stage = def?.stages.find((s) => s.exec === "query_corpus" || s.exec === "query_scam");
  if (!def || !stage) return textResult(`Unknown tool: ${name}`, true);

  const prompt = typeof args["prompt"] === "string" ? args["prompt"] : "";
  if (prompt.length === 0) return textResult("`prompt` is required.", true);

  if (stage.exec === "query_scam") {
    const result = await queryScam({ prompt });
    return textResult(JSON.stringify(result));
  }
  const result = await queryCorpus({ prompt, corpus: stage.corpus }, { db: env.DB });
  return textResult(JSON.stringify(result));
}

interface JsonRpcRequestBody {
  readonly id?: unknown;
  readonly method?: string;
  readonly params?: { readonly name?: string; readonly arguments?: Record<string, unknown> };
}

export async function handleMcp(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: JsonRpcRequestBody;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error", cors);
  }
  const { id, method, params } = body;

  if (method === "initialize") {
    return rpcResult(
      id,
      { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO },
      cors
    );
  }
  if (method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: cors });
  }
  if (method === "tools/list") {
    return rpcResult(id, { tools: mcpTools() }, cors);
  }
  if (method === "tools/call") {
    const name = params?.name;
    if (typeof name !== "string") return rpcError(id, -32602, "Missing tool name", cors);
    const known = mcpTools().some((t) => t.name === name);
    if (!known) return rpcError(id, -32602, `Unknown tool: ${name}`, cors);
    const args = params?.arguments ?? {};
    return rpcResult(id, await callTool(name, args, env), cors);
  }
  return rpcError(id, -32601, `Method not found: ${String(method)}`, cors);
}
