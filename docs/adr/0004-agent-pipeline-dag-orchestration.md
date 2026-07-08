# ADR-0004: Agent pipeline DAG orchestration

## Status

Accepted

## Context

Busara's 33 agents run across 7 pipeline stages:

| Stage | # | Purpose |
|---|---|---|
| 0 | Ingest | Parse, validate, profile raw data |
| 1 | Engineer | Clean, transform, engineer features |
| 2 | Detect | Anomaly detection, ML, clustering, fraud |
| 3 | Forecast | Time-series decomposition, seasonality |
| 4 | Infer | Causal inference, explainability, AutoML |
| 5 | Cluster | Clustering, segmentation, funnel analysis |
| 6 | Report | Insights, narratives, NLQ, recommendations |

Each agent declares:

- `metadata.dependencies` — IDs of agents that **must** run first
- `metadata.softDependencies` — IDs of agents that **should** run first
  if they're enabled
- `metadata.stage` and `metadata.stageNumber` — for visualization and
  coarse ordering

We needed an orchestrator that could:

1. Resolve the dependency graph at startup (fail fast on cycles).
2. Run independent agents in parallel within a stage.
3. Pass each agent's output to its dependents via a `previousResults`
   map.
4. Handle timeouts, retries, and circuit breakers per agent.
5. Stream progress to the UI (SSE) as agents start and complete.
6. Record a `Trajectory` for every agent execution (per ADR-0003).
7. Apply verification gates between stages (per ADR-0007).
8. Support both **single-agent execution** (the `/api/v2/analyze`
   endpoint) and **multi-agent streaming execution** (the
   `/api/v2/analyze-stream` endpoint).

## Decision

Implement a **DAG-based orchestrator** in
`packages/agents/src/orchestrator.ts` (the `DAGOrchestrator` class):

### Topology

- At construction, the orchestrator walks every agent's `dependencies`
  and builds a directed acyclic graph. A dependency on an agent that
  isn't registered throws `AgentDependencyError` immediately.
- Cycle detection runs at construction (Tarjan's SCC). A cycle throws
  `AgentDependencyCycleError` listing the cycle.
- The graph is *partitioned* by stage — agents in stage 0 must all
  complete before any agent in stage 1 starts. This is a coarse
  barrier; within a stage, agents run in parallel.

### Execution model

- **Single-agent execution** (`executeOne(agentId, ctx)`): instantiates
  the agent, wraps it with `withTrajectory()` (per ADR-0003), calls
  `execute(ctx)`, and returns the result. Used by
  `POST /api/v2/analyze`.
- **Multi-agent streaming execution** (`executeStream(agentIds, ctx,
  onProgress)`): iterates the requested agent IDs in topological order,
  executes each one (with trajectory wrapping), and emits progress
  events via the `onProgress` callback. The Next.js route handler
  converts these into Server-Sent Events. Used by
  `POST /api/v2/analyze-stream`.

### Resilience

Each agent gets:

- A **timeout** (from `metadata.timeoutMs`, default 30 s). On timeout,
  the agent's execution is aborted and the result is `failed` with
  `error: 'TIMEOUT'`.
- A **retry policy** (from `metadata.maxRetries`, default 3). Retries
  are exponential with jitter: 100 ms, 200 ms, 400 ms.
- A **circuit breaker** per agent. Three consecutive failures open the
  circuit for 60 s; further calls short-circuit to `failed` without
  invoking the agent.

### Caching

A `SmartCache` (also in `orchestrator.ts`) memoizes agent results by
`(agentId, dataframeHash, configHash)`. A cache hit returns the cached
result without re-executing. The cache has a TTL (default 5 min) and a
size cap (default 1000 entries, LRU eviction).

### Context propagation

Every agent receives an `AgentContext` containing:

- `analysisId`, `executionId`, `attempt` — for trajectory correlation
- `dataframe` — the input data
- `config` — merged with the agent's `configSchema.defaults`
- `previousResults: Map<agentId, AgentResult>` — outputs of every agent
  that ran before this one in the current analysis
- `metadata` — free-form bag (file name, user info, etc.)
- `startedAt`, `options`, `logger`, `metrics`, `cache` — injected by
  the orchestrator

### Verification gates

Between stages, the orchestrator optionally runs verification gates on
each agent's output (per ADR-0007). A gate that fails triggers
replanning — the agent is retried with adjusted config, or skipped
entirely.

## Consequences

**Positive:**

- The 7-stage DAG is easy to reason about. New agents declare their
  dependencies and the orchestrator handles ordering.
- Parallel execution within a stage gives a ~3× speedup over a
  sequential pipeline on a typical 10-agent run.
- The `previousResults` map means an agent can read another agent's
  output without coupling to it at compile time.
- Circuit breakers prevent one flaky agent from taking down the whole
  pipeline.
- The cache is a huge win for the wizard UI — re-running the same
  analysis with a slightly different config skips 80% of the work.

**Negative:**

- The stage barrier is coarse. An agent in stage 2 that doesn't depend
  on any stage-1 agent still waits for all stage-1 agents to finish.
  Finer-grained per-agent scheduling would help, but adds complexity.
- The cache key includes the dataframe hash, which is expensive to
  compute for large dataframes. We hash a sample (first 100 rows) to
  keep it cheap.
- The circuit breaker is per-process. In a multi-instance deployment,
  one instance's breaker doesn't know about another's failures. A
  shared Redis-backed breaker would be more correct.
- Trajectory recording adds ~5-10% overhead per agent execution. We
  accept this — the learning data is worth it.
- SSE streaming doesn't backpressure cleanly. If the client is slow,
  the buffer grows. In production, we'd add a `signal` abort.

## Alternatives Considered

- **Sequential execution.** Simplest, but wastes time. The 7-stage
  pipeline with 10 agents in stage 2 would take 7× longer.
- **Free-for-all parallelism (no stages).** Agents would race — the
  orchestrator couldn't guarantee that `data_ingestion` finishes before
  `schema_inference` starts. The stage barrier is a small price for
  correctness.
- **LangGraph.** Excellent library, but it imposes its own state model
  and tracing. We already have trajectories (ADR-0003); adding
  LangGraph's tracing on top would duplicate.
- **Mastra / Inngest.** Similar story — great for general-purpose
  workflows, but our pipeline is data-flow-centric, not control-flow-
  centric. The DAG is the natural shape.
- **Temporal.** Durable execution would be nice for long-running
  analyses, but it's a heavy dependency. We can add it later for the
  "checkpoint and resume" feature (on the roadmap).
- **No orchestrator — agents call each other directly.** Rejected.
  This couples agents at compile time and makes the dependency graph
  implicit. The orchestrator makes it explicit and inspectable.
- **Dynamic stage assignment.** Considered — let the orchestrator
  infer stages from dependencies. Rejected because the stage number is
  also a UI affordance (the wizard shows "Stage 2 of 6"). Explicit is
  better.
