# ADR-0006: OpenTelemetry GenAI export

## Status

Accepted

## Context

Busara trajectories (per ADR-0003) are the substrate on which the data
proxy, the evolution control plane, the reward model, and the
verification gates all operate. But trajectories are also valuable to
**external** observability and evaluation tools:

- **Langfuse** — for prompt analytics, cost tracking, and per-prompt
  iteration.
- **Arize Phoenix** — for drift detection across agent versions.
- **MLflow** — for experiment tracking when fine-tuning.
- **Honeycomb** — for production tracing alongside other backend
  services.
- **Datadog LLM Observability** — for alerting on LLM-call latency and
  error rates.

Each of these tools has its own data model. Writing a custom exporter
for each would be a maintenance nightmare. We needed a **standard
format** that every tool could consume.

In parallel, the OpenTelemetry community has been developing
**GenAI semantic conventions** — a standard vocabulary for LLM calls,
agent steps, and tool calls. The conventions reached stability in
v1.37 of the OTel specification (mid-2025).

The question was: should we adopt OTel GenAI as the export format for
trajectories, or define our own?

## Decision

Adopt **OpenTelemetry GenAI semantic conventions v1.37+** as the
canonical export format for trajectories. Every trajectory can be
serialized to a `OTelGenAITrace` (a list of `OTelGenAISpan`s) and
shipped to any OTel-compatible backend.

### Implementation

`packages/agents/src/trajectory/otel.ts` provides:

- `trajectoryToOTel(trajectory): OTelGenAITrace` — convert one
  trajectory to a single OTel trace. Each step becomes a span; LLM
  calls and tool calls become nested spans with GenAI attributes.
- `trajectoriesToOTel(trajectories): OTelGenAITrace[]` — batch
  converter.
- `toOTLPJSON(traces): unknown` — serialize to OTLP/JSON, the wire
  format that OTel collectors accept.

### Attribute coverage

Every span includes the GenAI v1.37 attributes where applicable:

- `gen_ai.system` — `glm` | `openai` | `anthropic` | `google`
- `gen_ai.request.model` — e.g. `glm-4.6`, `gpt-4o`
- `gen_ai.request.temperature`
- `gen_ai.request.max_tokens`
- `gen_ai.response.id`
- `gen_ai.response.model`
- `gen_ai.response.finish_reason`
- `gen_ai.usage.input_tokens`
- `gen_ai.usage.output_tokens`
- `gen_ai.token.cost` (custom extension; not in the spec yet but
  consistent with the cost-tracking convention)
- `busara.trajectory.id` (custom — links the span back to our store)
- `busara.agent.id`, `busara.agent.version`, `busara.agent.stability`
- `busara.step.causal_parents` (custom — the AReaL paper's causal link)

### Span structure

A trajectory maps to a trace like this:

```
trace (trajectory)
├── span: step 0 (observation)
│   └── span: gen_ai invocation (LLM call)
│       attributes: gen_ai.system, gen_ai.request.model, tokens, cost
├── span: step 1 (tool_call)
│   └── span: tool invocation
│       attributes: tool.name, tool.input.size, tool.output.size
├── span: step 2 (output)
└── span: reward (event on the trace)
    attributes: reward.type, reward.source, reward.value
```

### Export destinations

The web app exposes the OTel export via two endpoints:

- `GET /api/v2/trajectory/:id?format=otel` — returns the trajectory as
  an OTel trace JSON. The dashboard's "Export → OTel" button uses this.
- `POST /api/v2/observability/export` — bulk export. Forwards to a
  configured OTel collector (Langfuse, Honeycomb, etc.) via OTLP/HTTP.

The collector endpoint is configured via the `OTEL_EXPORTER_OTLP_ENDPOINT`
env var. If unset, exports are no-ops (dev mode).

## Consequences

**Positive:**

- One export format works with every major LLM observability tool. New
  tools that adopt OTel GenAI work without us writing any code.
- The semantic conventions are stable (v1.37+) and well-documented.
  We're not betting on a niche format.
- The OTel collector ecosystem is mature — batch, retry, redact,
  route to multiple backends. We don't have to reinvent any of that.
- Custom attributes (prefixed `busara.*`) let us carry information the
  spec doesn't cover (trajectory ID, causal parents) without
  forking the spec.
- Trajectories and OTel traces share the same mental model (trace →
  span → attributes). The conversion is mechanical.

**Negative:**

- The GenAI conventions are still evolving. v1.37 is stable but v2.0
  is being drafted. We'll need to track breaking changes.
- Some attributes we care about (`busara.token.cost`, causal parents)
  aren't in the spec. Tools that strictly enforce the spec will ignore
  them. Most tools (Langfuse, Phoenix) accept arbitrary attributes.
- OTLP/JSON is verbose. A single trajectory with 5 steps and 5 LLM
  calls is ~10 KB of JSON. For high-volume deployments, OTLP/protobuf
  would be more efficient. We support JSON for now; protobuf is on
  the roadmap.
- The collector adds an operational component. In dev, we skip it
  (no-op exporter). In prod, we recommend running the otel-collector
  as a sidecar or standalone service.
- Tooling support is uneven. Langfuse and Phoenix are excellent.
  MLflow's GenAI support is newer. Datadog's LLM Observability uses a
  proprietary format (we'd write a small adapter).

## Alternatives Considered

- **Custom JSON format.** We'd control the schema, but we'd write a
  separate exporter for every tool. The maintenance cost is high.
- **Langfuse native format.** Locks us into Langfuse. Langfuse is great
  but we don't want to be unable to switch.
- **JSON Lines with our schema.** Better than custom JSON, but still
  requires per-tool adapters.
- **Wait for the spec to stabilize further.** The GenAI conventions
  have been in draft for ~18 months. v1.37 is stable enough to bet on.
  Waiting means more tools build proprietary exporters in the
  meantime.
- **Use OpenInference (Arize's format).** OpenInference is essentially
  a subset of OTel GenAI. Adopting OTel GenAI gives us OpenInference
  compatibility for free.
- **Use OpenLLMetry (Traceloop).** OpenLLMetry is a great library that
  implements OTel GenAI instrumentation for popular LLM libraries. We
  don't use their library because we're not instrumenting an LLM
  client — we're exporting our own trajectory data. But our format is
  compatible, so OpenLLMetry-backed tools can consume our exports.
