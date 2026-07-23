---
title: "ADR 0003 — no agent framework: a single LLM call with structured output"
status: proposed
date: 2026-07-23
---

# ADR 0003 — No agent framework

## Status

Proposed (2026-07-23), to be accepted with **plan 017 · P2** (the query-driven auto-router). Scope:
every model call this app makes — the founders assess/search stages and the new intent classifier.

## Context

Plan 017 adds an **intent classifier** so one free-text ask picks its workflow. That is the first
time the app has needed "agent-ish" behaviour beyond a per-stage tool call, which raised: should we
adopt an agent framework (Pydantic-AI, Vercel AI SDK, Cloudflare Agents SDK) rather than keep the
bespoke path?

Constraints that decide it:

- **Runtime:** a single **TypeScript Cloudflare Worker** (V8 isolate). No Node, no `process.env`.
- **Keyless-first:** a free provider chain (Workers AI → OpenRouter `:free`) with BYOK optional;
  secrets are Worker-only. Bundle size matters (currently ~80 KiB).
- **Self-host everything** (js/css/fonts); strict CSP `'self'`.
- **Actual workload:** deterministic corpus lookups + two forced-tool-call stages + one 1-shot
  classification. **No multi-step agent loop, no durable agent state, no memory.**

## Decision

Keep the **bespoke minimal path**: one LLM call with **forced tool-call + zod-validated structured
output**, over the existing provider chain. Concretely `worker/src/agent/model.ts` `callModelTool<T>`
together with `worker/src/agent/providers.ts` `buildProviders`/`runChain`/`Provider.tryCall<T>`, and
a tool spec per call site (`shared/assessTool.ts`, `shared/searchTool.ts`, and now `shared/routerTool.ts`).
**No agent framework is adopted.**

Alternatives considered:

- **Pydantic-AI** — Python. Reaching a TS Worker means Python-Workers/Pyodide (Wasm) with cold-start
  and bundle cost, and a second runtime in one Worker. Non-starter here.
- **Vercel AI SDK** — TS and edge-capable (Workers AI ships as a community provider), and
  `generateObject` covers structured output. But it assumes `process.env` (Workers have none →
  explicit `create*` factories), and it adds a dependency + bundle for behaviour we already have in
  ~60 LOC. It buys multi-step tool-loop and streaming DX we do not use.
- **Cloudflare Agents SDK** — TS and Workers-native; the right tool **if** we wanted durable,
  stateful agents. Overkill for a stateless one-shot classifier.

## Consequences

**Plus.** No new dependency, no bundle growth, no `process.env` impedance mismatch. The keyless
free-chain and its per-provider fallback stay exactly as they are (a framework would fight them).
Self-host and CSP are unaffected. The classifier reuses a pattern already proven in production by
`runStageModel` (`worker/src/worker.ts:254-280`).

**Minus.** If the roadmap later needs genuine multi-step agent loops, tool-calling loops with
retries, or durable agent state, we will have to build or adopt that then — this ADR does not
pre-build for it (deliberately: YAGNI).

**Revisit trigger.** Plan 017 P2 adds an **Arize span per route** recording `{routed_to, source:
heuristic|model|none}`. If telemetry shows the model tier routinely deciding routes (i.e. real
multi-signal reasoning), or a roadmap item needs durable state / multi-step loops, reopen this ADR —
and then the candidates are **Vercel AI SDK** or **Cloudflare Agents SDK**, never a Python runtime.
